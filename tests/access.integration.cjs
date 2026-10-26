const {PGlite}=require('@electric-sql/pglite');const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const base=path.resolve(__dirname,'../backend');
(async()=>{
const db=new PGlite();await db.waitReady;
await db.exec(fs.readFileSync(path.resolve(base,'../creacion-diagrama.sql'),'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
await db.exec(fs.readFileSync(base+'/migrations/001_access.sql','utf8'));
await db.exec(fs.readFileSync(base+'/migrations/002_catalog.sql','utf8'));
let tail=Promise.resolve();async function acquire(){const before=tail;let release;tail=new Promise(r=>release=r);await before;return release;}
const query=async(sql,args)=>{const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};};
const pool={async connect(){const release=await acquire();return {query,release};},async query(sql,args){const release=await acquire();try{return await query(sql,args);}finally{release();}}};
require.cache[require.resolve(base+'/dist/config/db.js')]={id:base+'/dist/config/db.js',filename:base+'/dist/config/db.js',loaded:true,exports:{pool}};
process.env.JWT_SECRET='test-only-local-secret-not-for-production';
const app=require(base+'/dist/app.js').default;const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}`;
async function request(method,route,body,token){const r=await fetch(url+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
try{
const a=await request('POST','/auth/register',{name:'Admin Test',email:'admin@test.co',password:'SecurePass123!',role:'admin',status:'active'});assert.equal(a.status,201);assert.equal(a.data.user.role,'viewer');assert.equal(a.data.user.status,'pending');
assert.equal((await request('POST','/auth/login',{email:'admin@test.co',password:'SecurePass123!'})).status,400);
await query("UPDATE users SET role='admin',status='active' WHERE id=$1",[a.data.user.id]);
const login=await request('POST','/auth/login',{email:'admin@test.co',password:'SecurePass123!'});assert.equal(login.status,200);const token=login.data.token;
const v=await request('POST','/auth/register',{name:'Viewer Test',email:'viewer@test.co',password:'SecurePass123!'});const viewerId=v.data.user.id;
assert.equal((await request('PATCH',`/admin/users/${viewerId}`,{role:'viewer',status:'active',reason:'Approved for consultation'},token)).status,200);
const vl=await request('POST','/auth/login',{email:'viewer@test.co',password:'SecurePass123!'});assert.equal(vl.status,200);const vt=vl.data.token;
assert.equal((await request('GET','/customers',null,vt)).status,200);
for(const [method,route,body] of [['POST','/customers',{}],['DELETE','/customers/00000000-0000-0000-0000-000000000001'],['PATCH','/customers/00000000-0000-0000-0000-000000000001/status',{status:'active'}],['GET','/admin/users'],['GET','/admin/audit'],['GET','/admin/sessions']])assert.equal((await request(method,route,body,vt)).status,403,`${method} ${route}`);
assert.equal((await request('PATCH',`/admin/users/${a.data.user.id}`,{role:'viewer',status:'inactive',reason:'Self access attempt'},token)).status,400);
const customer=await request('POST','/customers',{full_name:'Client Test',email:'client@test.co',phone_number:'3001234567',company:'Company',status:'active',country:'Colombia',address:'Calle 123'},token);assert.equal(customer.status,201);
assert.equal((await request('PATCH',`/customers/${customer.data.id}/status`,{status:'inactive'},token)).status,200);
// Catalog permissions, exact prices, duplicate codes, concurrency, services and shared customers.
assert.equal((await request('GET','/customers',null,vt)).data.length,1);
const item={code:'prod-001',name:'Producto Test',description:'Prueba',category:'General',kind:'product',tracks_inventory:true,base_price:'100.05',tax_treatment:'taxed',vat_rate:'19',active:true,reason:'Initial catalog entry'};
assert.equal((await request('POST','/products',item,vt)).status,403);
const created=await request('POST','/products',item,token);assert.equal(created.status,201);assert.equal(created.data.code,'PROD-001');
assert.equal((await request('POST','/products',item,token)).status,409);
const list=await request('GET','/products',null,vt);assert.equal(list.status,200);assert.equal(Number(list.data[0].vat_amount),19.01);assert.equal(Number(list.data[0].final_price),119.06);
const change={...item,code:'PROD-001',base_price:'200',version:1,reason:'Updated price for test'};
assert.equal((await request('PUT',`/products/${created.data.id}`,change,vt)).status,403);
assert.equal((await request('PUT',`/products/${created.data.id}`,change,token)).status,200);
assert.equal((await request('PUT',`/products/${created.data.id}`,change,token)).status,409);
for(const invalid of [{...item,base_price:'-2'},{...item,vat_rate:'101'},{...item,kind:'service',tracks_inventory:true},{...item,tax_treatment:'excluded',vat_rate:'19'},{...item,reason:''},{...item,base_price:'1.999'}])assert.equal((await request('POST','/products',invalid,token)).status,400);
const service={...item,code:'SERV-001',kind:'service',tracks_inventory:false,tax_treatment:'excluded',vat_rate:'0'};assert.equal((await request('POST','/products',service,token)).status,201);
assert.equal((await request('PUT',`/products/${created.data.id}`,{...change,version:2,active:false},token)).status,200);
const catalogAudit=await request('GET','/admin/audit',null,token);assert(catalogAudit.data.some(e=>e.entity==='products'&&e.action==='UPDATE'&&e.before_data.base_price===100.05&&e.after_data.base_price===200));
console.log('PASS catalog: shared clients, viewer reads/admin writes, exact VAT rounding, duplicates, validation, service constraints, optimistic versions, deactivation and price audit.');
const audit=await request('GET','/admin/audit',null,token);assert.equal(audit.status,200);assert(audit.data.some(e=>e.entity==='customers'&&e.actor_user_id===a.data.user.id&&e.action==='UPDATE'));assert(!JSON.stringify(audit.data).includes('password_hash'));assert(!JSON.stringify(audit.data).includes('SecurePass'));
await assert.rejects(()=>db.exec('DELETE FROM audit_events'));
assert.equal((await request('PATCH',`/admin/users/${viewerId}`,{role:'viewer',status:'inactive',reason:'Account suspended'},token)).status,200);assert.equal((await request('GET','/customers',null,vt)).status,401);
// Fresh role from database and all previous sessions revoked on role changes.
await request('PATCH',`/admin/users/${viewerId}`,{role:'admin',status:'active',reason:'Promoted for test'},token);assert.equal((await request('GET','/admin/users',null,vt)).status,401);
const al=await request('POST','/auth/login',{email:'viewer@test.co',password:'SecurePass123!'});assert.equal(al.status,200);assert.equal((await request('GET','/admin/users',null,al.data.token)).status,200);
const sessions=await request('GET','/admin/sessions',null,token);assert.equal(sessions.status,200);assert(sessions.data.some(s=>s.state==='revoked'));
// GET dashboard polling must not extend idle timeout.
await query("UPDATE user_sessions SET last_seen_at=now()-interval '29 minutes' WHERE user_id=$1 AND revoked_at IS NULL",[viewerId]);const before=(await query('SELECT last_seen_at FROM user_sessions WHERE user_id=$1 AND revoked_at IS NULL',[viewerId])).rows[0].last_seen_at;
await request('GET','/customers',null,al.data.token);const after=(await query('SELECT last_seen_at FROM user_sessions WHERE user_id=$1 AND revoked_at IS NULL',[viewerId])).rows[0].last_seen_at;assert.equal(String(before),String(after));
await request('POST','/auth/activity',{},al.data.token);await query("UPDATE user_sessions SET last_seen_at=now()-interval '31 minutes' WHERE user_id=$1 AND revoked_at IS NULL",[viewerId]);assert.equal((await request('GET','/customers',null,al.data.token)).status,401);
assert.equal((await request('POST','/auth/logout',{},token)).status,200);assert.equal((await request('GET','/admin/users',null,token)).status,401);
console.log('PASS: PostgreSQL schema/migration; pending registration ignores role escalation; admin approval; viewer mutation and admin endpoints denied; self-change denied; customer audit records actor; audit excludes secrets and rejects deletion; deactivation/role change/logout revoke JWT; idle timeout and GET polling verified.');
}finally{await new Promise(r=>server.close(r));await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
