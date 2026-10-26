import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
export type AuthRequest=Request & {user?:{id:string,email?:string,name?:string,role:'admin'|'viewer',sessionId:string}};
export async function authMiddleware(req:AuthRequest,res:Response,next:NextFunction){
 const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):null;
 if(!token)return res.status(401).json({message:'Unauthorized'});
 let payload:jwt.JwtPayload;
 try{payload=jwt.verify(token,process.env.JWT_SECRET!,{algorithms:['HS256']}) as jwt.JwtPayload;if(!payload.sub||typeof payload.sid!=='string')throw new Error();}
 catch{return res.status(401).json({message:'Invalid token'});}
 try{
  const result=await pool.query(`SELECT u.id,u.email,u.full_name,u.role FROM users u JOIN user_sessions s ON s.user_id=u.id WHERE u.id=$1 AND s.id=$2 AND u.status='active' AND s.revoked_at IS NULL AND s.expires_at>now() AND s.last_seen_at>now()-interval '30 minutes'`,[payload.sub,payload.sid]);
  if(!result.rows[0])return res.status(401).json({message:'Session expired or account inactive'});
  const u=result.rows[0];req.user={id:u.id,email:u.email,name:u.full_name,role:u.role,sessionId:payload.sid};
  if(req.method!=='GET') {await pool.query('UPDATE user_sessions SET last_seen_at=now() WHERE id=$1',[payload.sid]);await pool.query('UPDATE users SET last_seen_at=now() WHERE id=$1',[u.id]);}
  next();
 }catch(error){next(error);}
}
export function adminOnly(req:AuthRequest,res:Response,next:NextFunction){if(req.user?.role!=='admin')return res.status(403).json({message:'Administrator access required'});next();}
