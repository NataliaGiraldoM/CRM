import { Request } from 'express';
import { pool } from '../config/db';
import type { PoolClient } from 'pg';

export class ReportInputError extends Error {}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function date(value: unknown): string | null {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ReportInputError('Invalid report date range');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw new ReportInputError('Invalid report date range');
  return value;
}
export function reportFilters(req: Request) {
  const from = date(req.query.from), to = date(req.query.to);
  if (from && to && from > to) throw new ReportInputError('Invalid report date range');
  const id = (v: unknown) => {
    if (v === undefined || v === '') return null;
    if (typeof v !== 'string' || !uuid.test(v)) throw new ReportInputError('Invalid customer or product filter');
    return v;
  };
  const status = req.query.status ?? 'all';
  if (!['all','completed','cancelled'].includes(String(status))) throw new ReportInputError('Invalid sale status');
  const integer = (v: unknown, fallback: number, max: number) => {
    if (v === undefined) return fallback;
    if (typeof v !== 'string' || !/^\d+$/.test(v) || Number(v) < 1 || !Number.isSafeInteger(Number(v)) || Number(v)>max) throw new ReportInputError('Invalid pagination');
    return Number(v);
  };
  if (req.query.search !== undefined && (typeof req.query.search !== 'string' || req.query.search.length > 150)) throw new ReportInputError('Invalid search');
  return { from, to, customer: id(req.query.customer_id), product: id(req.query.product_id), status: String(status), search: String(req.query.search || '').trim().toLowerCase(), page: integer(req.query.page,1,1000000), pageSize: integer(req.query.page_size,50,200) };
}
type Filters = ReturnType<typeof reportFilters>;
// Monetary figures consistently represent only selected lines when a product is selected.
const matched = `WITH matched AS (
 SELECT s.id,s.customer_id,c.full_name AS customer_name,c.company AS customer_company,
 s.created_by,u.full_name AS seller_name,s.sale_date,s.status,s.notes,s.created_at,
 lines.subtotal,lines.tax_total,lines.total,lines.item_count
 FROM sales s JOIN customers c ON c.id=s.customer_id JOIN users u ON u.id=s.created_by
 JOIN LATERAL (SELECT sum(si.subtotal) AS subtotal,sum(si.tax_amount) AS tax_total,
 sum(si.total) AS total,count(*)::integer AS item_count FROM sale_items si
 WHERE si.sale_id=s.id AND ($5::uuid IS NULL OR si.product_id=$5)) lines ON lines.item_count>0
 WHERE ($1::text IS NULL OR s.sale_date >= $1::date)
 AND ($2::text IS NULL OR s.sale_date < ($2::date+interval '1 day'))
 AND ($3::uuid IS NULL OR s.customer_id=$3) AND ($4='all' OR s.status=$4)
 AND ($6='' OR position($6 in lower(c.full_name || ' ' || coalesce(c.company,'') || ' ' || u.full_name || ' ' || s.id::text))>0)
)`;
const params = (f: Filters) => [f.from,f.to,f.customer,f.status,f.product,f.search];
const summarySql = `SELECT count(*) FILTER (WHERE status='completed')::integer AS sales_count,
 coalesce(sum(total) FILTER (WHERE status='completed'),0) AS revenue,
 coalesce(avg(total) FILTER (WHERE status='completed'),0) AS average_sale,
 count(*) FILTER (WHERE status='cancelled')::integer AS cancelled_count,
 count(DISTINCT customer_id) FILTER (WHERE status='completed')::integer AS purchasing_customers,
 coalesce(round(count(*) FILTER (WHERE status='completed')::numeric / nullif(count(DISTINCT customer_id) FILTER (WHERE status='completed'),0),2),0) AS purchase_frequency,
 count(*)::integer AS total_records FROM matched`;
const readSummary = async (db: PoolClient, f: Filters) => (await db.query(`${matched} ${summarySql}`,params(f))).rows[0];
export async function salesReport(f: Filters, exportAll = false) {
  const db=await pool.connect();
  try {
    // Page, aggregates and previous-period metrics see one consistent database snapshot.
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const values=params(f);
    const sales = await db.query(`${matched} SELECT * FROM matched ORDER BY sale_date DESC,id DESC ${exportAll ? '' : 'LIMIT $7 OFFSET $8'}`,exportAll ? values : [...values,f.pageSize,(f.page-1)*f.pageSize]);
    const summary=await readSummary(db,f);
    if (exportAll) { await db.query('COMMIT'); return {sales:sales.rows,summary}; }
    let previousRange: {from:string;to:string}|null=null;
    let previousSummary=null;
    let previous: Filters|null=null;
    if (f.from && f.to) {
      const start=Date.parse(`${f.from}T00:00:00Z`),end=Date.parse(`${f.to}T00:00:00Z`);
      const day=86400000;
      previousRange={from:new Date(start-(end-start+day)).toISOString().slice(0,10),to:new Date(start-day).toISOString().slice(0,10)};
      previous={...f,...previousRange};
      previousSummary=await readSummary(db,previous);
    }
    const customerRows=await db.query(`${matched} SELECT customer_id,max(customer_name) AS customer_name,
 count(*)::integer AS purchases,coalesce(sum(total),0) AS revenue,max(sale_date) AS last_purchase
 FROM matched WHERE status='completed' GROUP BY customer_id ORDER BY purchases DESC,revenue DESC,customer_id`,values);
    const previousRows=previous ? (await db.query(`${matched} SELECT customer_id,max(customer_name) AS customer_name,count(*)::integer AS purchases,sum(total) AS revenue FROM matched WHERE status='completed' GROUP BY customer_id`,params(previous))).rows : [];
    const customerMap=new Map<string,any>();
    for (const row of customerRows.rows) customerMap.set(row.customer_id,{...row,previous_purchases:0,previous_revenue:0});
    for (const row of previousRows) {
      const current=customerMap.get(row.customer_id) || {customer_id:row.customer_id,customer_name:row.customer_name,purchases:0,revenue:0,last_purchase:null};
      customerMap.set(row.customer_id,{...current,previous_purchases:row.purchases,previous_revenue:row.revenue});
    }
    const customers=[...customerMap.values()].map(row=>({...row,share:Number(summary.revenue)>0 ? Number(row.revenue)/Number(summary.revenue)*100 : 0,declining:previous!==null && (Number(row.purchases)<Number(row.previous_purchases) || Number(row.revenue)<Number(row.previous_revenue))})).sort((a,b)=>b.purchases-a.purchases || Number(b.revenue)-Number(a.revenue) || a.customer_id.localeCompare(b.customer_id));
    const products=await db.query(`${matched}, quantities AS (
 SELECT si.product_id,sum(si.quantity) AS quantity_sold,sum(si.total) AS revenue
 FROM sale_items si JOIN matched m ON m.id=si.sale_id
 WHERE m.status='completed' AND ($5::uuid IS NULL OR si.product_id=$5) GROUP BY si.product_id)
 SELECT p.id,p.code,p.name,p.kind,p.active,coalesce(q.quantity_sold,0) AS quantity_sold,coalesce(q.revenue,0) AS revenue
 FROM products p LEFT JOIN quantities q ON q.product_id=p.id
 WHERE ($5::uuid IS NULL OR p.id=$5) ORDER BY quantity_sold DESC,p.name,p.id`,values);
    await db.query('COMMIT');
    return {sales:sales.rows,summary,previous_summary:previousSummary,previous_range:previousRange,customers,products:products.rows,pagination:{page:f.page,page_size:f.pageSize,total:summary.total_records,total_pages:Math.ceil(summary.total_records/f.pageSize)}};
  } catch(e) {await db.query('ROLLBACK');throw e;} finally {db.release();}
}
export function reportCsv(rows: any[], spanish: boolean) {
  const headers=spanish ? ['Fecha','ID venta','Cliente','Vendedor','Líneas','Subtotal','IVA','Total','Estado'] : ['Date','Sale ID','Customer','Seller','Items','Subtotal','Tax','Total','Status'];
  const cell=(value: unknown) => {
    let text=String(value??'');
    // Quoting alone does not prevent spreadsheet formula execution.
    if (/^[\s]*[=+\-@\t\r\n]/.test(text)) text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  };
  return '\ufeff'+[headers,...rows.map(s=>[new Date(s.sale_date).toISOString(),s.id,s.customer_name,s.seller_name,s.item_count,s.subtotal,s.tax_total,s.total,spanish ? (s.status==='completed'?'Completada':'Anulada') : s.status])].map(row=>row.map(cell).join(',')).join('\r\n');
}
