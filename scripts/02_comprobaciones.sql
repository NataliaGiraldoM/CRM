-- Consultas de solo lectura. Ejecutarlas después de 01_datos_demostracion.sql.
-- 1) Datos de demostración. Esperado: 8 clientes, 12 elementos, 90 ventas.
SELECT (SELECT count(*) FROM customers WHERE email LIKE 'orbit-demo-%@example.invalid') AS clientes_demo,
 (SELECT count(*) FROM products WHERE code LIKE 'ORBIT-DEMO-%') AS catalogo_demo,
 (SELECT count(*) FROM sales WHERE notes LIKE 'DEMO: venta ficticia %') AS ventas_demo;
-- 2) Ventas: 84 completadas y 6 anuladas. Totales exactos para comparar con reportes.
SELECT s.status,count(*) AS ventas,sum(s.subtotal) AS subtotal,sum(s.tax_total) AS iva,sum(s.total) AS total,
 round(avg(s.total),2) AS ticket_promedio
FROM sales s WHERE notes LIKE 'DEMO: venta ficticia %' GROUP BY s.status;
-- 3) Integridad de dinero: AMBAS consultas deben devolver 0.
SELECT count(*) AS ventas_inconsistentes FROM sales s
WHERE s.notes LIKE 'DEMO: venta ficticia %' AND
 (s.total<>s.subtotal+s.tax_total OR s.total<>(SELECT sum(total) FROM sale_items WHERE sale_id=s.id));
SELECT count(*) AS lineas_inconsistentes FROM sale_items si JOIN sales s ON s.id=si.sale_id
WHERE s.notes LIKE 'DEMO: venta ficticia %' AND
 (si.subtotal<>si.quantity*si.unit_price OR si.total<>si.subtotal+si.tax_amount OR si.tax_amount<>round(si.subtotal*si.vat_rate/100,2));
-- 4) Stock calculado por movimientos. Producto 8: 3 (bajo); producto 9: 0.
SELECT p.code,p.minimum_stock,m.after_stock AS stock,m.after_stock<=p.minimum_stock AS stock_bajo
FROM products p JOIN LATERAL(SELECT after_stock FROM inventory_movements WHERE product_id=p.id ORDER BY movement_order DESC LIMIT 1)m ON true
WHERE p.code LIKE 'ORBIT-DEMO-%' ORDER BY p.code;
-- 5) Cadena de saldos: debe devolver 0.
WITH chain AS(SELECT product_id,before_stock,lag(after_stock,1,0) OVER(PARTITION BY product_id ORDER BY movement_order) AS previo
FROM inventory_movements WHERE product_id IN(SELECT id FROM products WHERE code LIKE 'ORBIT-DEMO-%'))
SELECT count(*) AS saltos_de_saldo FROM chain WHERE before_stock<>previo;
-- 6) Frecuencia, concentración y clientes que compran repetidamente.
SELECT c.full_name,count(*) AS compras,sum(s.total) AS ventas,
 round(100*sum(s.total)/sum(sum(s.total)) OVER(),2) AS porcentaje_ventas,max(s.sale_date) AS ultima_compra
FROM sales s JOIN customers c ON c.id=s.customer_id
WHERE s.notes LIKE 'DEMO: venta ficticia %' AND s.status='completed'
GROUP BY c.id,c.full_name ORDER BY compras DESC;
-- 7) Rotación por unidades; incluye productos/servicios sin ventas.
SELECT p.code,p.name,coalesce(sum(si.quantity) FILTER(WHERE s.status='completed'),0) AS unidades
FROM products p LEFT JOIN sale_items si ON si.product_id=p.id LEFT JOIN sales s ON s.id=si.sale_id
WHERE p.code LIKE 'ORBIT-DEMO-%' GROUP BY p.id,p.code,p.name ORDER BY unidades,p.code;
-- 8) IVA y clase de catálogo. Servicios 10 a 12 no tienen inventario.
SELECT code,kind,tracks_inventory,base_price,tax_treatment,vat_rate,
 round(base_price*vat_rate/100,2) AS iva,base_price+round(base_price*vat_rate/100,2) AS precio_final
FROM products WHERE code LIKE 'ORBIT-DEMO-%' ORDER BY code;
-- 9) Auditoría: autor y motivo de la carga; nunca debe contener password_hash.
SELECT entity,action,count(*) AS eventos FROM audit_events
WHERE reason='ORBIT DEMO: carga de datos ficticios autorizada' GROUP BY entity,action ORDER BY entity,action;
SELECT count(*) AS secretos_en_auditoria FROM audit_events
WHERE (before_data ? 'password_hash') OR (after_data ? 'password_hash');
-- 10) Usuarios y sesiones (no revela contraseñas ni tokens).
SELECT email,role,status,last_login_at,last_seen_at FROM users ORDER BY email;
SELECT u.email,s.started_at,s.last_seen_at,s.expires_at,s.end_reason,
 CASE WHEN s.revoked_at IS NOT NULL THEN 'revocada' WHEN s.expires_at<=now() THEN 'expirada'
 WHEN s.last_seen_at<=now()-interval '30 minutes' THEN 'inactiva' ELSE 'activa' END AS estado
FROM user_sessions s JOIN users u ON u.id=s.user_id ORDER BY s.started_at DESC;
