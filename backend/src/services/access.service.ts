import { pool } from '../config/db';
import type { PoolClient } from 'pg';
export async function transaction<T>(actor: string | null, reason: string, work: (db: PoolClient) => Promise<T>): Promise<T> {
 const db=await pool.connect();
 try {await db.query('BEGIN'); await db.query("SELECT set_config('orbit.actor',$1,true),set_config('orbit.reason',$2,true)",[actor || '',reason]); const result=await work(db);await db.query('COMMIT');return result;}
 catch(error){await db.query('ROLLBACK');throw error;} finally{db.release();}
}
export async function event(db: PoolClient, actor: string | null, action: string, target: string | null, reason: string) {
 await db.query('INSERT INTO audit_events(actor_user_id,entity,action,target_id,reason) VALUES($1,$2,$3,$4,$5)',[actor,'auth',action,target,reason]);
}
export const publicUser=(u: any)=>({id:u.id,name:u.full_name,email:u.email,role:u.role,status:u.status,last_login_at:u.last_login_at,last_seen_at:u.last_seen_at});
