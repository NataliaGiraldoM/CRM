import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../config/db';
import { transaction } from '../services/access.service';
import { authMiddleware, adminOnly, AuthRequest } from '../middlewares/auth.middleware';
const router=Router(); router.use(authMiddleware);
const validId=(x:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const integer=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0&&x<=1000000000;
router.get('/inventory',async(_req,res)=>{
 const rows=await pool.query(`SELECT p.id,p.code,p.name,p.active,p.minimum_stock,COALESCE((SELECT m.after_stock FROM inventory_movements m WHERE m.product_id=p.id ORDER BY m.movement_order DESC LIMIT 1),0)::integer AS stock,(SELECT count(*)::integer FROM inventory_movements m WHERE m.product_id=p.id) AS movement_count FROM products p WHERE p.kind='product' AND p.tracks_inventory ORDER BY p.name,p.id`);
 res.json(rows.rows);
});
router.get('/inventory/movements',async(req,res)=>{
 const id=String(req.query.product_id||'');if(!validId(id))return res.status(400).json({message:'Invalid product'});
 const page=Math.max(0,Math.min(100000,Number.parseInt(String(req.query.page||'0'),10)||0));
 const rows=await pool.query(`SELECT m.*,u.full_name AS actor_name FROM inventory_movements m JOIN users u ON u.id=m.actor_user_id WHERE product_id=$1 ORDER BY m.movement_order DESC LIMIT 50 OFFSET $2`,[id,page*50]);res.json(rows.rows);
});
router.post('/inventory/movements',adminOnly,async(req:AuthRequest,res,next)=>{
 const {product_id,movement_type,quantity,reason,request_id,expected_stock}=req.body||{};
 if(!validId(product_id||'')||!validId(request_id||'')||!['entry','exit','adjustment'].includes(movement_type)||!integer(quantity)||!integer(expected_stock)||(movement_type!=='adjustment'&&quantity===0)||typeof reason!=='string'||reason.trim().length<5||reason.length>500)return res.status(400).json({message:'Invalid inventory movement'});
 try{
 const result=await transaction(req.user!.id,reason.trim(),async db=>{
  const product=(await db.query('SELECT id,active,kind,tracks_inventory FROM products WHERE id=$1 FOR UPDATE',[product_id])).rows[0];
  if(!product||product.kind!=='product'||!product.tracks_inventory)return {status:404,message:'Inventory product not found'};
  const existing=(await db.query('SELECT * FROM inventory_movements WHERE id=$1',[request_id])).rows[0];
  if(existing){if(existing.product_id===product_id&&existing.actor_user_id===req.user!.id&&existing.movement_type===movement_type&&existing.quantity===quantity&&existing.before_stock===expected_stock&&existing.reason===reason.trim())return {status:200,movement:existing};return {status:409,message:'Movement request ID already used'};}
  if(!product.active)return {status:400,message:'Inactive product cannot be changed'};
  const prior=(await db.query('SELECT after_stock FROM inventory_movements WHERE product_id=$1 ORDER BY movement_order DESC LIMIT 1',[product_id])).rows[0];const before=prior?.after_stock??0;
  if(before!==expected_stock)return {status:409,message:'Stock changed. Refresh and review your movement.'};
  const after=movement_type==='adjustment'?quantity:movement_type==='entry'?before+quantity:before-quantity;
  if(after<0||after>1000000000)return {status:400,message:'Stock cannot be negative or exceed limit'};
  const rows=await db.query(`INSERT INTO inventory_movements(id,product_id,actor_user_id,movement_type,quantity,before_stock,after_stock,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[request_id||randomUUID(),product_id,req.user!.id,movement_type,quantity,before,after,reason.trim()]);return {status:201,movement:rows.rows[0]};
 });res.status(result.status).json(result.movement||{message:result.message});
 }catch(error:any){if(error.code==='23505')return res.status(409).json({message:'Movement request ID already used'});next(error);}
});
router.patch('/inventory/:id/minimum',adminOnly,async(req:AuthRequest,res,next)=>{
 const id=String(req.params.id);const {minimum_stock,reason}=req.body||{};
 if(!validId(id)||!integer(minimum_stock)||typeof reason!=='string'||reason.trim().length<5||reason.length>500)return res.status(400).json({message:'Invalid minimum stock'});
 try{const item=await transaction(req.user!.id,reason.trim(),async db=>{const r=await db.query(`UPDATE products SET minimum_stock=$1,version=version+1,updated_by=$2,updated_at=now() WHERE id=$3 AND kind='product' AND tracks_inventory RETURNING id,minimum_stock`,[minimum_stock,req.user!.id,id]);return r.rows[0];});if(!item)return res.status(404).json({message:'Inventory product not found'});res.json(item);}catch(error){next(error);}
});
export default router;
