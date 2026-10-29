const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const db=new PGlite();await db.waitReady;
 try {
  await db.exec(fs.readFileSync(root+'/creacion-diagrama.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
  for(const name of ['001_access','002_catalog','003_inventory','004_sales']) await db.exec(fs.readFileSync(`${root}/backend/migrations/${name}.sql`,'utf8'));
  await db.exec(`
   INSERT INTO users(id,full_name,email,password_hash,role,status) VALUES(md5('legacy-user')::uuid,'Legacy Admin','legacy@example.invalid','unused','admin','active');
   INSERT INTO customers(id,owner_user_id,full_name,email,phone_number,company,status,country,address)
   VALUES(md5('legacy-client')::uuid,md5('legacy-user')::uuid,'Legacy Client','legacy-client@example.invalid','3000000000','Legacy','active','Colombia','Calle 1');
   INSERT INTO products(id,code,name,description,category,kind,tracks_inventory,base_price,tax_treatment,vat_rate,active,created_by,updated_by)
   VALUES(md5('legacy-product')::uuid,'LEGACY','Legacy product','','Legacy','product',true,10,'excluded',0,true,md5('legacy-user')::uuid,md5('legacy-user')::uuid);
   INSERT INTO sales(id,customer_id,created_by,subtotal,tax_total,total) VALUES(md5('legacy-sale')::uuid,md5('legacy-client')::uuid,md5('legacy-user')::uuid,20,0,20);
   INSERT INTO sale_items(sale_id,product_id,product_name,product_code,quantity,unit_price,tax_treatment,vat_rate,subtotal,tax_amount,total)
   VALUES(md5('legacy-sale')::uuid,md5('legacy-product')::uuid,'Legacy product','LEGACY',2,10,'excluded',0,20,0,20);
   INSERT INTO inventory_movements(id,product_id,actor_user_id,movement_type,quantity,before_stock,after_stock,reason)
   VALUES(md5('legacy-exit')::uuid,md5('legacy-product')::uuid,md5('legacy-user')::uuid,'exit',2,10,8,'Sale '||md5('legacy-sale')::uuid::text);
  `);
  await db.exec(fs.readFileSync(root+'/backend/migrations/005_sales_inventory_snapshot.sql','utf8'));
  await db.exec(fs.readFileSync(root+'/scripts/05_actualizar_bd_existente_DBeaver.sql','utf8'));
  await db.exec(fs.readFileSync(root+'/scripts/05_actualizar_bd_existente_DBeaver.sql','utf8'));
  const r=await db.query('SELECT inventory_movement_id FROM sale_items');assert.equal(r.rows[0].inventory_movement_id,(await db.query("SELECT md5('legacy-exit')::uuid AS id")).rows[0].id);
 }finally{await db.close();}
 const fresh=new PGlite();await fresh.waitReady;
 try{
  await fresh.exec(fs.readFileSync(root+'/scripts/04_creacion_completa_solo_bd_nueva.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
  assert.equal((await fresh.query('SELECT count(*)::integer AS n FROM orbit_migrations')).rows[0].n,5);
  assert.equal((await fresh.query("SELECT count(*)::integer AS n FROM information_schema.columns WHERE table_name='sale_items' AND column_name='inventory_movement_id'")).rows[0].n,1);
 }finally{await fresh.close();}
 console.log('PASS migration: historical exits backfilled without replacing sales; full schema creates a fresh database with all five migrations recorded.');
})().catch(e=>{console.error(e);process.exitCode=1;});
