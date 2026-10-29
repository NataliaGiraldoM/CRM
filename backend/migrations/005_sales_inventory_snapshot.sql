BEGIN;
-- Preserve the actual stock exit rather than the current product settings.
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS inventory_movement_id UUID
  REFERENCES inventory_movements(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS sale_items_inventory_movement_unique ON sale_items(inventory_movement_id)
  WHERE inventory_movement_id IS NOT NULL;
-- Older sales store the sale UUID in the immutable movement reason.
UPDATE sale_items si SET inventory_movement_id = (
 SELECT m.id FROM inventory_movements m
 WHERE m.product_id=si.product_id AND m.movement_type='exit'
 AND m.reason='Sale ' || si.sale_id::text
 ORDER BY m.movement_order LIMIT 1
) WHERE si.inventory_movement_id IS NULL AND EXISTS (
 SELECT 1 FROM inventory_movements m WHERE m.product_id=si.product_id
 AND m.movement_type='exit' AND m.reason='Sale ' || si.sale_id::text
);
COMMIT;
