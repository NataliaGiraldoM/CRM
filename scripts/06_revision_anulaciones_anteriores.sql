-- Solo lectura: posibles devoluciones antiguas sin una salida original de esa venta.
-- Si devuelve filas, revisa el conteo físico y registra un ajuste desde Inventario.
-- No borres movimientos: forman parte de la auditoría.
SELECT m.id,m.product_id,p.code,m.quantity,m.created_at,m.reason
FROM inventory_movements m JOIN products p ON p.id=m.product_id
WHERE m.movement_type='entry' AND m.reason LIKE 'Restock cancelled sale %'
AND NOT EXISTS(SELECT 1 FROM inventory_movements original
 WHERE original.product_id=m.product_id AND original.movement_type='exit'
 AND original.reason='Sale '||substring(m.reason FROM 'Restock cancelled sale ([0-9a-f-]{36})'))
ORDER BY m.created_at;
