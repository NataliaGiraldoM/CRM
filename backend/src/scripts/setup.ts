import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pool } from '../config/db';
import { transaction, publicUser } from '../services/access.service';
async function main(){
 const command=process.argv[2];
 if(command==='migrate'){
  const db=await pool.connect();try{
   await db.query('SELECT pg_advisory_lock(761205)');
   await db.query('CREATE TABLE IF NOT EXISTS orbit_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())');
   for(const name of ['001_access','002_catalog','003_inventory','004_sales']) {
    if(!(await db.query('SELECT 1 FROM orbit_migrations WHERE name=$1',[name])).rowCount){
     const sql=readFileSync(resolve(__dirname,`../../migrations/${name}.sql`),'utf8');
     await db.query(sql.replace('COMMIT;',`INSERT INTO orbit_migrations(name) VALUES('${name}'); COMMIT;`));
     console.log('Applied:',name);
    }
   }
   console.log('Migration ready');
  }finally{await db.query('SELECT pg_advisory_unlock(761205)');db.release();}
 }else if(command==='bootstrap'){
  const email=process.argv[3]?.trim().toLowerCase();if(!email)throw new Error('Usage: npm run admin:bootstrap -- email@example.com');
  const user=await transaction(null,'Initial administrator provisioned by database operator',async db=>{
   await db.query('SELECT pg_advisory_xact_lock(761204)');
   if((await db.query("SELECT 1 FROM users WHERE role='admin' AND status='active'")).rowCount)throw new Error('An active administrator already exists');
   const r=await db.query("UPDATE users SET role='admin',status='active',updated_at=now() WHERE email=$1 RETURNING *",[email]);
   if(!r.rows[0])throw new Error('Register this email first');return publicUser(r.rows[0]);
  });console.log('Administrator enabled:',user.email);
 }else throw new Error('Unknown command');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
