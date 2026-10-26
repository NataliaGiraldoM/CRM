BEGIN;
ALTER TABLE products ADD COLUMN minimum_stock integer NOT NULL DEFAULT 0 CHECK (minimum_stock BETWEEN 0 AND 1000000000);
CREATE TABLE inventory_movements (
 id uuid PRIMARY KEY,
 movement_order bigserial UNIQUE NOT NULL,
 product_id uuid NOT NULL REFERENCES products(id),
 actor_user_id uuid NOT NULL REFERENCES users(id),
 movement_type text NOT NULL CHECK (movement_type IN ('entry','exit','adjustment')),
 quantity integer NOT NULL CHECK(quantity BETWEEN 0 AND 1000000000),
 before_stock integer NOT NULL CHECK(before_stock >= 0),
 after_stock integer NOT NULL CHECK(after_stock >= 0),
 reason varchar(500) NOT NULL CHECK(length(trim(reason)) >= 5),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_movements_product ON inventory_movements(product_id,created_at DESC);
CREATE TRIGGER audit_inventory AFTER INSERT ON inventory_movements FOR EACH ROW EXECUTE FUNCTION orbit_audit_change();
CREATE TRIGGER inventory_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_movements FOR EACH STATEMENT EXECUTE FUNCTION orbit_protect_audit();
COMMIT;
