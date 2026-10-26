import { Router } from 'express';
import { authMiddleware, adminOnly, AuthRequest } from '../middlewares/auth.middleware';
import { pool } from '../config/db';
import { transaction, event, publicUser } from '../services/access.service';
const router=Router();router.use(authMiddleware);
router.get('/auth/me',async(req:AuthRequest,res)=>{res.json({user:publicUser((await pool.query('SELECT * FROM users WHERE id=$1',[req.user!.id])).rows[0])});});
router.post('/auth/activity',(_req,res)=>{res.json({ok:true});});
router.post('/auth/logout',async(req:AuthRequest,res)=>{await transaction(req.user!.id,'Logout',async db=>{await db.query("UPDATE user_sessions SET revoked_at=now(),end_reason='logout' WHERE id=$1",[req.user!.sessionId]);await event(db,req.user!.id,'LOGOUT',req.user!.sessionId,'Explicit logout');});res.json({ok:true});});
router.get('/admin/users',adminOnly,async(_req,res)=>{const r=await pool.query('SELECT id,full_name,email,role,status,last_login_at,last_seen_at FROM users ORDER BY created_at DESC');res.json(r.rows.map(publicUser));});
router.patch('/admin/users/:id',adminOnly,async(req:AuthRequest,res)=>{
 const {role,status,reason}=req.body||{};const id=String(req.params.id);
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['admin','viewer'].includes(role)||!['active','inactive','pending'].includes(status)||typeof reason!=='string'||reason.trim().length<5)return res.status(400).json({message:'Role, status and reason (5 characters minimum) are required'});
 if(id===req.user!.id)return res.status(400).json({message:'You cannot change your own access'});
 const changed=await transaction(req.user!.id,reason.trim(),async db=>{
  await db.query("SELECT pg_advisory_xact_lock(761204)");
  // Revalidate actor after waiting for concurrent administrative changes.
  const actor=(await db.query('SELECT role,status FROM users WHERE id=$1 FOR UPDATE',[req.user!.id])).rows[0];
  if(actor.role!=='admin'||actor.status!=='active')throw new Error('Administrator access required');
  const old=(await db.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!old)return null;
  const r=await db.query('UPDATE users SET role=$1,status=$2,updated_at=now() WHERE id=$3 RETURNING *',[role,status,id]);
  await db.query("UPDATE user_sessions SET revoked_at=now(),end_reason='access_changed' WHERE user_id=$1 AND revoked_at IS NULL",[id]);
  return publicUser(r.rows[0]);
 });if(!changed)return res.status(404).json({message:'User not found'});res.json(changed);
});
router.get('/admin/audit',adminOnly,async(req,res)=>{const actor=typeof req.query.actor==='string'?req.query.actor:'';if(actor&&!/^[0-9a-f-]{36}$/i.test(actor))return res.status(400).json({message:'Invalid user'});const page=Math.max(0,Math.floor(Number(req.query.page)||0));const r=await pool.query('SELECT a.*,u.full_name AS actor_name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_user_id WHERE ($1::text=\'\' OR a.actor_user_id::text=$1) ORDER BY a.id DESC LIMIT 100 OFFSET $2',[actor,page*100]);res.json(r.rows);});
router.get('/admin/sessions',adminOnly,async(_req,res)=>{const r=await pool.query(`SELECT s.*,u.full_name AS user_name,CASE WHEN revoked_at IS NOT NULL THEN 'revoked' WHEN expires_at<=now() THEN 'expired' WHEN s.last_seen_at<=now()-interval '30 minutes' THEN 'idle' ELSE 'active' END AS state FROM user_sessions s JOIN users u ON u.id=s.user_id ORDER BY started_at DESC LIMIT 200`);res.json(r.rows);});
export default router;
