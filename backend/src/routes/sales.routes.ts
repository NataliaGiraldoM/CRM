import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../config/db';
import { transaction } from '../services/access.service';
import { authMiddleware, adminOnly, AuthRequest } from '../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

router.get('/sales', async (req, res, next) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : null;
    const to = typeof req.query.to === 'string' ? req.query.to : null;
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    if (status !== 'all' && !['completed', 'cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid sale status' });
    const result = await pool.query(`SELECT s.id,s.customer_id,c.full_name AS customer_name,c.company AS customer_company,s.created_by,u.full_name AS seller_name,s.sale_date,s.status,s.subtotal,s.tax_total,s.total,s.notes,s.created_at,
      (SELECT count(*)::integer FROM sale_items si WHERE si.sale_id=s.id) AS item_count
      FROM sales s JOIN customers c ON c.id=s.customer_id JOIN users u ON u.id=s.created_by
      WHERE ($1::text IS NULL OR s.sale_date >= $1::date) AND ($2::text IS NULL OR s.sale_date < ($2::date + interval '1 day')) AND ($3='all' OR s.status=$3)
      ORDER BY s.sale_date DESC LIMIT 500`, [from, to, status]);
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.get('/sales/summary', async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT count(*) FILTER (WHERE status='completed')::integer AS sales_count,
      COALESCE(sum(total) FILTER (WHERE status='completed'),0)::numeric(14,2) AS revenue,
      COALESCE(avg(total) FILTER (WHERE status='completed'),0)::numeric(14,2) AS average_sale,
      count(*) FILTER (WHERE status='cancelled')::integer AS cancelled_count FROM sales`);
    const monthly = await pool.query(`SELECT to_char(date_trunc('month',sale_date),'YYYY-MM') AS month, COALESCE(sum(total),0)::numeric(14,2) AS revenue, count(*)::integer AS sales_count FROM sales WHERE status='completed' AND sale_date >= date_trunc('month',now()) - interval '5 months' GROUP BY 1 ORDER BY 1`);
    const best = await pool.query(`SELECT si.product_name, sum(si.quantity)::integer AS quantity_sold, sum(si.total)::numeric(14,2) AS revenue FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.status='completed' GROUP BY si.product_id,si.product_name ORDER BY quantity_sold DESC,revenue DESC LIMIT 5`);
    res.json({ ...result.rows[0], monthly: monthly.rows, best_products: best.rows });
  } catch (error) { next(error); }
});

router.get('/sales/:id', async (req, res, next) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid sale ID' });
  try {
    const sale = await pool.query(`SELECT s.*,c.full_name AS customer_name,c.company AS customer_company,u.full_name AS seller_name FROM sales s JOIN customers c ON c.id=s.customer_id JOIN users u ON u.id=s.created_by WHERE s.id=$1`, [req.params.id]);
    if (!sale.rows[0]) return res.status(404).json({ message: 'Sale not found' });
    const items = await pool.query('SELECT * FROM sale_items WHERE sale_id=$1 ORDER BY created_at,id', [req.params.id]);
    res.json({ ...sale.rows[0], items: items.rows });
  } catch (error) { next(error); }
});

router.post('/sales', adminOnly, async (req: AuthRequest, res, next) => {
  const { customer_id, items, notes = '' } = req.body || {};
  if (!validId(customer_id) || !Array.isArray(items) || items.length < 1 || items.length > 100 || typeof notes !== 'string' || notes.length > 500) return res.status(400).json({ message: 'Invalid sale data' });
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!validId(item?.product_id) || !Number.isSafeInteger(item?.quantity) || item.quantity < 1 || item.quantity > 1000000) return res.status(400).json({ message: 'Each item needs a valid product and positive quantity' });
    quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + item.quantity);
  }
  if ([...quantities.values()].some(q => q > 1000000)) return res.status(400).json({ message: 'Quantity exceeds allowed limit' });
  try {
    const sale = await transaction(req.user!.id, 'Sale registered', async db => {
      const customer = (await db.query("SELECT id FROM customers WHERE id=$1 AND status='active' FOR SHARE", [customer_id])).rows[0];
      if (!customer) return { status: 404, body: { message: 'Active customer not found' } };
      const products: any[] = [];
      for (const [productId, quantity] of [...quantities.entries()].sort(([a],[b])=>a.localeCompare(b))) {
        const p = (await db.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [productId])).rows[0];
        if (!p || !p.active) return { status: 400, body: { message: 'Product not found or inactive' } };
        let stock = 0;
        if (p.kind === 'product' && p.tracks_inventory) {
          const last = (await db.query('SELECT after_stock FROM inventory_movements WHERE product_id=$1 ORDER BY movement_order DESC LIMIT 1', [productId])).rows[0];
          stock = Number(last?.after_stock || 0);
          if (stock < quantity) return { status: 409, body: { message: `Insufficient stock for ${p.name}. Available: ${stock}` } };
        }
        products.push({ p, quantity, stock });
      }
      let subtotal = 0, taxTotal = 0;
      const calculated = products.map(({p,quantity,stock}) => {
        const lineSubtotal = Math.round(Number(p.base_price) * quantity * 100) / 100;
        const tax = p.tax_treatment === 'taxed' ? Math.round(lineSubtotal * Number(p.vat_rate) / 100 * 100) / 100 : 0;
        subtotal += lineSubtotal; taxTotal += tax;
        return { p, quantity, stock, lineSubtotal, tax, total: lineSubtotal + tax };
      });
      subtotal = Math.round(subtotal*100)/100; taxTotal = Math.round(taxTotal*100)/100;
      const total = Math.round((subtotal+taxTotal)*100)/100;
      const inserted = (await db.query('INSERT INTO sales(customer_id,created_by,subtotal,tax_total,total,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [customer_id,req.user!.id,subtotal,taxTotal,total,notes.trim()])).rows[0];
      for (const line of calculated) {
        await db.query(`INSERT INTO sale_items(sale_id,product_id,product_name,product_code,quantity,unit_price,tax_treatment,vat_rate,subtotal,tax_amount,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [inserted.id,line.p.id,line.p.name,line.p.code,line.quantity,line.p.base_price,line.p.tax_treatment,line.p.vat_rate,line.lineSubtotal,line.tax,line.total]);
        if (line.p.kind === 'product' && line.p.tracks_inventory) {
          await db.query(`INSERT INTO inventory_movements(id,product_id,actor_user_id,movement_type,quantity,before_stock,after_stock,reason) VALUES($1,$2,$3,'exit',$4,$5,$6,$7)`, [randomUUID(),line.p.id,req.user!.id,line.quantity,line.stock,line.stock-line.quantity,`Sale ${inserted.id}`]);
        }
      }
      return { status: 201, body: inserted };
    });
    res.status(sale.status).json(sale.body);
  } catch (error) { next(error); }
});

router.post('/sales/:id/cancel', adminOnly, async (req: AuthRequest, res, next) => {
  const id = String(req.params.id); const reason = req.body?.reason;
  if (!validId(id) || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500) return res.status(400).json({ message: 'A valid sale ID and cancellation reason are required' });
  try {
    const result = await transaction(req.user!.id, reason.trim(), async db => {
      const sale = (await db.query('SELECT * FROM sales WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!sale) return { status: 404, body: { message: 'Sale not found' } };
      if (sale.status === 'cancelled') return { status: 409, body: { message: 'Sale is already cancelled' } };
      const items = (await db.query('SELECT si.*,p.kind,p.tracks_inventory FROM sale_items si JOIN products p ON p.id=si.product_id WHERE si.sale_id=$1 ORDER BY si.product_id FOR UPDATE OF p', [id])).rows;
      for (const item of items) if (item.kind === 'product' && item.tracks_inventory) {
        const last = (await db.query('SELECT after_stock FROM inventory_movements WHERE product_id=$1 ORDER BY movement_order DESC LIMIT 1', [item.product_id])).rows[0];
        const before = Number(last?.after_stock || 0); const after = before + Number(item.quantity);
        await db.query(`INSERT INTO inventory_movements(id,product_id,actor_user_id,movement_type,quantity,before_stock,after_stock,reason) VALUES($1,$2,$3,'entry',$4,$5,$6,$7)`, [randomUUID(),item.product_id,req.user!.id,item.quantity,before,after,`Restock cancelled sale ${id}: ${reason.trim()}`]);
      }
      const updated = (await db.query("UPDATE sales SET status='cancelled',updated_at=now() WHERE id=$1 RETURNING *", [id])).rows[0];
      return { status: 200, body: updated };
    });
    res.status(result.status).json(result.body);
  } catch (error) { next(error); }
});
export default router;
