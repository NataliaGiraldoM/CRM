-- OPCIONAL: cuentas ficticias para probar permisos, aprobación y sesiones.
-- Ejecutar después del script 01, en la misma BD de demostración.
-- Todos los usuarios creados son DE CONSULTA; no se crea ningún administrador.
-- Contraseña de demostración de las 3 cuentas: OrbitDemo2026!
-- Cuenta activa: orbit-demo-consulta@example.invalid
-- Cuenta pendiente: orbit-demo-pendiente@example.invalid
-- Cuenta inactiva: orbit-demo-inactivo@example.invalid
SELECT set_config('orbit.demo_admin_email','juanitacorrea9@hotmail.com',false);
BEGIN;
SELECT pg_advisory_xact_lock(761206);
DO $$
DECLARE actor uuid; uid uuid; i integer; address text; account_status text;
BEGIN
 SELECT id INTO actor FROM users WHERE email=lower(current_setting('orbit.demo_admin_email')) AND role='admin' AND status='active';
 IF actor IS NULL THEN RAISE EXCEPTION 'Escribe el correo de tu administrador activo en la primera línea.'; END IF;
 PERFORM set_config('orbit.actor',actor::text,true);
 PERFORM set_config('orbit.reason','ORBIT DEMO: cuentas ficticias de consulta',true);
 FOR i IN 1..3 LOOP
  uid:=md5('orbit-demo-user-'||i)::uuid;
  address:=CASE i WHEN 1 THEN 'orbit-demo-consulta@example.invalid' WHEN 2 THEN 'orbit-demo-pendiente@example.invalid' ELSE 'orbit-demo-inactivo@example.invalid' END;
  account_status:=CASE i WHEN 1 THEN 'active' WHEN 2 THEN 'pending' ELSE 'inactive' END;
  IF EXISTS(SELECT 1 FROM users WHERE email=address AND id<>uid) THEN RAISE EXCEPTION 'Ya existe el correo de demostración % con otro ID.',address; END IF;
  INSERT INTO users(id,full_name,email,password_hash,role,status)
  VALUES(uid,'DEMO Usuario '||i,address,'$2b$12$8.Kg6nx3y9PpnMgdORrUlOTX7HElHETA6.REvF24sTps390HbwBLu','viewer',account_status)
  ON CONFLICT(id) DO NOTHING;
 END LOOP;
 -- These illustrative sessions have no issued JWT. Login creates a real new session.
 uid:=md5('orbit-demo-user-1')::uuid;
 INSERT INTO user_sessions(id,user_id,started_at,last_seen_at,expires_at,revoked_at,end_reason) VALUES
 (md5('orbit-demo-session-idle')::uuid,uid,now()-interval '2 hours',now()-interval '45 minutes',now()+interval '6 hours',NULL,NULL),
 (md5('orbit-demo-session-expired')::uuid,uid,now()-interval '10 hours',now()-interval '9 hours',now()-interval '2 hours',NULL,NULL),
 (md5('orbit-demo-session-revoked')::uuid,uid,now()-interval '3 hours',now()-interval '2 hours',now()+interval '5 hours',now()-interval '2 hours','logout')
 ON CONFLICT(id) DO NOTHING;
 RAISE NOTICE 'Cuentas DEMO de consulta listas; contraseña: OrbitDemo2026!';
END $$;
COMMIT;
