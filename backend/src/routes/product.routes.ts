import { Router } from 'express';
import { pool } from '../config/db';
import { transaction } from '../services/access.service';
import { authMiddleware, adminOnly, AuthRequest } from '../middlewares/auth.middleware';
const router=Router();router.use(authMiddleware);
const fields=`p.*, round(p.base_price*p.vat_rate/100,2) AS vat_amount, p.base_price+round(p.base_price*p.vat_rate/100,2) AS final_price`;
router.get('/products',async(_req,res)=>{res.json((await pool.query(`SELECT ${fields} FROM products p ORDER BY p.created_at DESC,p.id`)).rows);});
function validate(body:any){
 if(!body||typeof body.code!=='string'||! /^[A-Za-z0-9_-]{1,40}$/.test(body.code.trim())||typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>120)throw new Error('Invalid product code or name');
 for(const [key,max] of [['description',1000],['category',80]] as const)if(typeof body[key]!=='string'||body[key].length>max)throw new Error('Invalid product description or category');
 if(!['product','service'].includes(body.kind)||typeof body.tracks_inventory!=='boolean'||typeof body.active!=='boolean')throw new Error('Invalid product type or state');
 if(body.kind==='service'&&body.tracks_inventory)throw new Error('Services cannot track inventory');
 if(typeof body.base_price!=='string'||!/^\d{1,12}(\.\d{1,2})?$/.test(body.base_price))throw new Error('Invalid base price');
 if(typeof body.vat_rate!=='string'||!/^\d{1,3}(\.\d{1,2})?$/.test(body.vat_rate)||Number(body.vat_rate)>100)throw new Error('Invalid VAT rate');
 if(!['taxed','exempt','excluded'].includes(body.tax_treatment)||(body.tax_treatment!=='taxed'&&Number(body.vat_rate)!==0))throw new Error('Invalid tax treatment');
 if(typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>500)throw new Error('A reason of at least 5 characters is required');
 return [body.code.trim().toUpperCase(),body.name.trim(),body.description.trim(),body.category.trim(),body.kind,body.tracks_inventory,body.base_price,body.tax_treatment,body.vat_rate,body.active];
}
router.post('/products',adminOnly,async(req:AuthRequest,res,next)=>{
 let values:unknown[];try{values=validate(req.body);}catch(e){return res.status(400).json({message:(e as Error).message});}
 try{const r=await transaction(req.user!.id,req.body.reason.trim(),db=>db.query(`INSERT INTO products(code,name,description,category,kind,tracks_inventory,base_price,tax_treatment,vat_rate,active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *`,[...values,req.user!.id]));res.status(201).json(r.rows[0]);}
 catch(e:any){if(e.code==='23505')return res.status(409).json({message:'Product code already exists'});next(e);}
});
router.put('/products/:id',adminOnly,async(req:AuthRequest,res,next)=>{
 const id=String(req.params.id);if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({message:'Invalid product'});
 let values:unknown[];try{values=validate(req.body);if(!Number.isSafeInteger(req.body.version)||req.body.version<1)throw new Error('Invalid product version');}catch(e){return res.status(400).json({message:(e as Error).message});}
 try{const outcome=await transaction(req.user!.id,req.body.reason.trim(),async db=>{
 const old=(await db.query('SELECT id,version,kind,tracks_inventory FROM products WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!old)return {status:404,message:'Product not found'};
 if(old.tracks_inventory && (!req.body.tracks_inventory || req.body.kind!=='product')) { const history=await db.query('SELECT 1 FROM inventory_movements WHERE product_id=$1 LIMIT 1',[id]); if(history.rows.length) return {status:409,message:'Cannot disable inventory tracking after movements exist'}; }
 if(old.version!==req.body.version)return {status:409,message:'Product changed. Refresh before editing.'};
 const r=await db.query(`UPDATE products SET code=$1,name=$2,description=$3,category=$4,kind=$5,tracks_inventory=$6,base_price=$7,tax_treatment=$8,vat_rate=$9,active=$10,updated_by=$11,updated_at=now(),version=version+1 WHERE id=$12 RETURNING *`,[...values,req.user!.id,id]);return {status:200,product:r.rows[0]};
 });res.status(outcome.status).json(outcome.product||{message:outcome.message});}
 catch(e:any){if(e.code==='23505')return res.status(409).json({message:'Product code already exists'});next(e);}
});
export default router;
