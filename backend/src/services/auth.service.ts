import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { pool } from '../config/db';
import { CreateUserRequest } from '../models/user.model';
import { validatePassword, validateName, validateEmail } from '../utils/validation.util';
import { transaction, event, publicUser } from './access.service';
export class AuthService {
 static async register(data: CreateUserRequest) {
  if(!data || typeof data.name!=='string'||typeof data.email!=='string'||typeof data.password!=='string')throw new Error('Missing required fields');
  for(const check of [validateName(data.name),validateEmail(data.email),validatePassword(data.password)])if(!check.isValid)throw new Error(check.message);
  const hash=await bcrypt.hash(data.password,12);
  return transaction(null,'Self-registration: pending approval',async db=>{
   try {const result=await db.query("INSERT INTO users(id,full_name,email,password_hash,role,status) VALUES($1,$2,$3,$4,'viewer','pending') RETURNING *",[randomUUID(),data.name.trim(),data.email.trim().toLowerCase(),hash]);return publicUser(result.rows[0]);}
   catch(e:any){if(e.code==='23505')throw new Error('User with this email already exists');throw e;}
  });
 }
 static async login(data: {email:string,password:string}) {
  if(!data||typeof data.email!=='string'||typeof data.password!=='string')throw new Error('Invalid credentials');
  const result=await pool.query('SELECT * FROM users WHERE email=$1',[data.email.trim().toLowerCase()]);const user=result.rows[0];
  const valid=user&&await bcrypt.compare(data.password,user.password_hash);
  if(!valid){await transaction(user?.id||null,'Invalid credentials',db=>event(db,user?.id||null,'LOGIN_FAILED',user?.id||null,'Invalid credentials'));throw new Error('Invalid credentials');}
  const secret=process.env.JWT_SECRET;if(!secret)throw new Error('JWT_SECRET is not defined');
  const outcome=await transaction(user.id,'Login',async db=>{
   const locked=(await db.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
   if(locked.status!=='active'){await event(db,user.id,'LOGIN_DENIED',user.id,'Account not active');return null;}
   const session=(await db.query("INSERT INTO user_sessions(user_id,expires_at) VALUES($1,now()+interval '8 hours') RETURNING id",[user.id])).rows[0];
   await db.query('UPDATE users SET last_login_at=now(),last_seen_at=now() WHERE id=$1',[user.id]);await event(db,user.id,'LOGIN',session.id,'Session started');
   return {user:publicUser(locked),token:jwt.sign({sub:user.id,sid:session.id},secret,{expiresIn:'8h',algorithm:'HS256'})};
  });
  if(!outcome)throw new Error('Account pending approval or inactive');return {message:'Login successful',...outcome};
 }
}
