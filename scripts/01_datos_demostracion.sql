-- ORBIT: datos ficticios para la BD existente. Requiere migraciones 001 a 005.
-- En DBeaver: cambia SOLO el correo de esta línea y ejecuta el archivo completo.
-- No cambia contraseñas, permisos ni registros existentes. No crea administradores.
SELECT set_config('orbit.demo_admin_email','juanitacorrea9@hotmail.com',false);

BEGIN;
SELECT pg_advisory_xact_lock(761206);
DO $$
DECLARE
 actor uuid; cid uuid; pid uuid; sid uuid; mid uuid;
 i integer; j integer; customer_n integer; product_n integer; qty integer;
 sub numeric(14,2); tax numeric(14,2); amount numeric(14,2);
 price numeric(14,2); rate numeric(5,2); treatment text;
 balance integer; tracked boolean; cancelled boolean; when_sold timestamptz;
BEGIN
 SELECT id INTO actor FROM users WHERE lower(email)=lower(current_setting('orbit.demo_admin_email')) AND role='admin' AND status='active';
 IF actor IS NULL THEN RAISE EXCEPTION 'Configura el correo de un administrador activo en la primera línea.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='inventory_movement_id') THEN
  RAISE EXCEPTION 'Primero ejecuta npm run db:migrate (falta migración 005).';
 END IF;
 -- A marker prevents repeated execution from duplicating movements or sales.
 IF EXISTS(SELECT 1 FROM customers WHERE id=md5('orbit-demo-customer-1')::uuid) THEN
  RAISE NOTICE 'Los datos de demostración ya existen: no se insertó nada.'; RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM products WHERE code LIKE 'ORBIT-DEMO-%') OR EXISTS(SELECT 1 FROM customers WHERE email LIKE 'orbit-demo-%@example.invalid') THEN
  RAISE EXCEPTION 'Hay códigos o correos de demostración previos. Revísalos antes de continuar.';
 END IF;
 PERFORM set_config('orbit.actor',actor::text,true);
 PERFORM set_config('orbit.reason','ORBIT DEMO: carga de datos ficticios autorizada',true);
 FOR i IN 1..8 LOOP
  cid:=md5('orbit-demo-customer-'||i)::uuid;
  INSERT INTO customers(id,owner_user_id,full_name,email,phone_number,company,status,country,address)
  VALUES(cid,actor,'DEMO Cliente '||i,'orbit-demo-'||i||'@example.invalid','300000000'||i,'DEMO Empresa '||i,
   (CASE WHEN i=8 THEN 'inactive' ELSE 'active' END)::customer_status,'Colombia','DEMO Calle '||i);
 END LOOP;
 FOR i IN 1..12 LOOP
  pid:=md5('orbit-demo-product-'||i)::uuid;
  INSERT INTO products(id,code,name,description,category,kind,tracks_inventory,base_price,tax_treatment,vat_rate,active,created_by,updated_by,minimum_stock)
  VALUES(pid,'ORBIT-DEMO-'||lpad(i::text,2,'0'),'DEMO '||CASE WHEN i>=10 THEN 'Servicio ' ELSE 'Producto ' END||i,
   'Registro ficticio de demostración','DEMO',CASE WHEN i>=10 THEN 'service' ELSE 'product' END,i<10,
   10000+i*2500,CASE WHEN i%3=0 THEN 'excluded' WHEN i%3=1 THEN 'taxed' ELSE 'exempt' END,
   CASE WHEN i%3=1 THEN 19 ELSE 0 END,true,actor,actor,CASE WHEN i IN(8,9) THEN 10 ELSE 20 END);
  IF i<10 THEN
   balance:=CASE WHEN i=8 THEN 3 WHEN i=9 THEN 0 ELSE 1000 END;
   INSERT INTO inventory_movements(id,product_id,actor_user_id,movement_type,quantity,before_stock,after_stock,reason)
   VALUES(gen_random_uuid(),pid,actor,'adjustment',balance,0,balance,'DEMO inventario inicial');
  END IF;
 END LOOP;
 -- 90 sales: > one page, two equal 30-day periods, repeat customers,
 -- a declining customer (#1), mixed baskets, cancelled sales and zero-sale items.
 FOR i IN 1..90 LOOP
  sid:=md5('orbit-demo-sale-'||i)::uuid;
  customer_n:=CASE WHEN (i-1)%60<30 THEN 2+(i%5) ELSE CASE WHEN i%2=0 THEN 1 ELSE 2+(i%5) END END;
  cid:=md5('orbit-demo-customer-'||customer_n)::uuid;
  when_sold:=date_trunc('day',now()) + interval '12 hours' - ((i-1)%60)*interval '1 day';
  -- Keep demo timestamps at or before now on the current day.
  when_sold:=least(when_sold,now());
  cancelled:=(i%15=0);
  INSERT INTO sales(id,customer_id,created_by,sale_date,subtotal,tax_total,total,notes)
  VALUES(sid,cid,actor,when_sold,0,0,0,'DEMO: venta ficticia '||i);
  FOR j IN 1..2 LOOP
   product_n:=CASE WHEN j=1 THEN 1+(i%6) ELSE 10+(i%2) END;
   pid:=md5('orbit-demo-product-'||product_n)::uuid;qty:=1+(i%3);
   SELECT base_price,vat_rate,tax_treatment,tracks_inventory INTO price,rate,treatment,tracked FROM products WHERE id=pid;
   sub:=price*qty;tax:=round(sub*rate/100,2);amount:=sub+tax;mid:=NULL;
   IF tracked THEN
    SELECT after_stock INTO balance FROM inventory_movements WHERE product_id=pid ORDER BY movement_order DESC LIMIT 1;
    mid:=gen_random_uuid();
    INSERT INTO inventory_movements(id,product_id,actor_user_id,movement_type,quantity,before_stock,after_stock,reason,created_at)
    VALUES(mid,pid,actor,'exit',qty,balance,balance-qty,'Sale '||sid::text,when_sold);
   END IF;
   INSERT INTO sale_items(id,sale_id,product_id,product_name,product_code,quantity,unit_price,tax_treatment,vat_rate,subtotal,tax_amount,total,inventory_movement_id)
   SELECT md5('orbit-demo-line-'||i||'-'||j)::uuid,sid,pid,name,code,qty,price,treatment,rate,sub,tax,amount,mid FROM products WHERE id=pid;
   UPDATE sales SET subtotal=subtotal+sub,tax_total=tax_total+tax,total=total+amount WHERE id=sid;
   IF tracked AND cancelled THEN
    INSERT INTO inventory_movements(id,product_id,actor_user_id,movement_type,quantity,before_stock,after_stock,reason)
    VALUES(gen_random_uuid(),pid,actor,'entry',qty,balance-qty,balance,'Restock cancelled sale '||sid::text||': DEMO anulación');
   END IF;
  END LOOP;
  IF cancelled THEN UPDATE sales SET status='cancelled',updated_at=now() WHERE id=sid; END IF;
 END LOOP;
 RAISE NOTICE 'DEMO lista: 8 clientes, 12 elementos de catálogo, 90 ventas (84 completadas y 6 anuladas).';
END $$;
COMMIT;
-- Si DBeaver informa que la transacción está abortada, ejecuta ROLLBACK antes de repetir.
