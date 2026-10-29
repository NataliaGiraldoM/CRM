-- Solo lectura: confirma que estás en la BD correcta y qué estructuras existen.
SELECT current_database(),current_user;
SELECT to_regclass('public.orbit_migrations') AS registro_migraciones,
 to_regclass('public.sales') AS ventas,to_regclass('public.sale_items') AS detalles;
-- Ejecutar esta consulta solo si orbit_migrations existe:
SELECT name,applied_at FROM orbit_migrations ORDER BY name;
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='sale_items' AND column_name='inventory_movement_id';
