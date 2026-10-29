-- ORBIT: esquema completo SOLO para una BD nueva y vacía.
-- Para actualizar tu BD actual, utiliza npm run db:migrate.
-- No incluye contraseñas, cuentas ni datos de demostración.

-- ARCHIVO: creacion-diagrama.sql
-- =========================================
-- CRM TIC2 - Esquema PostgreSQL
-- =========================================

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================
-- ENUM
-- =========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'customer_status'
    ) THEN
        CREATE TYPE customer_status AS ENUM ('active', 'pending', 'inactive');
    END IF;
END$$;

-- =========================================
-- TABLA: users
-- =========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'Usuarios autenticados del CRM';
COMMENT ON COLUMN users.id IS 'Id del usuario';
COMMENT ON COLUMN users.full_name IS 'Nombre completo del usuario';
COMMENT ON COLUMN users.email IS 'Correo electrónico del usuario';
COMMENT ON COLUMN users.password_hash IS 'Contraseña encriptada del usuario';
COMMENT ON COLUMN users.created_at IS 'Fecha de creación del usuario';
COMMENT ON COLUMN users.updated_at IS 'Fecha de actualización del usuario';

-- =========================================
-- TABLA: customers
-- =========================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone_number VARCHAR(30) NOT NULL,
    company VARCHAR(120) NOT NULL,
    status customer_status NOT NULL DEFAULT 'active',
    country VARCHAR(80) NOT NULL,
    address VARCHAR(180) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_customers_owner_user
        FOREIGN KEY (owner_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

COMMENT ON TABLE customers IS 'Clientes gestionados dentro del CRM';
COMMENT ON COLUMN customers.id IS 'Id del cliente';
COMMENT ON COLUMN customers.owner_user_id IS 'Id del usuario responsable del cliente';
COMMENT ON COLUMN customers.full_name IS 'Nombre completo del cliente';
COMMENT ON COLUMN customers.email IS 'Correo electrónico del cliente';
COMMENT ON COLUMN customers.phone_number IS 'Número de teléfono del cliente';
COMMENT ON COLUMN customers.company IS 'Empresa del cliente';
COMMENT ON COLUMN customers.status IS 'Estado actual del cliente';
COMMENT ON COLUMN customers.country IS 'País del cliente';
COMMENT ON COLUMN customers.address IS 'Dirección del cliente';
COMMENT ON COLUMN customers.created_at IS 'Fecha de creación del cliente';
COMMENT ON COLUMN customers.updated_at IS 'Fecha de actualización del cliente';

-- =========================================
-- TABLA: customer_status_history
-- =========================================
CREATE TABLE IF NOT EXISTS customer_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    changed_by_user_id UUID NOT NULL,
    previous_status customer_status,
    new_status customer_status NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_customer_status_history_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_customer_status_history_changed_by_user
        FOREIGN KEY (changed_by_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

COMMENT ON TABLE customer_status_history IS 'Historial de cambios de estado de los clientes';
COMMENT ON COLUMN customer_status_history.id IS 'Id del historial de estado';
COMMENT ON COLUMN customer_status_history.customer_id IS 'Id del cliente';
COMMENT ON COLUMN customer_status_history.changed_by_user_id IS 'Id del usuario que realizó el cambio';
COMMENT ON COLUMN customer_status_history.previous_status IS 'Estado anterior del cliente';
COMMENT ON COLUMN customer_status_history.new_status IS 'Nuevo estado del cliente';
COMMENT ON COLUMN customer_status_history.changed_at IS 'Fecha del cambio de estado';

-- =========================================
-- ÍNDICES RECOMENDADOS
-- =========================================
CREATE INDEX IF NOT EXISTS idx_customers_owner_user_id
    ON customers(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_customers_status
    ON customers(status);

CREATE INDEX IF NOT EXISTS idx_customer_status_history_customer_id
    ON customer_status_history(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_status_history_changed_by_user_id
    ON customer_status_history(changed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_customer_status_history_changed_at
    ON customer_status_history(changed_at);
-- ARCHIVO: 001_access.sql
BEGIN;
ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','viewer'));
ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','pending'));
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE users ADD COLUMN last_login_at timestamptz;
ALTER TABLE users ADD COLUMN last_seen_at timestamptz;
CREATE TABLE user_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 started_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, revoked_at timestamptz, end_reason text
);
CREATE INDEX ON user_sessions(user_id);
CREATE TABLE audit_events (
 id bigserial PRIMARY KEY, actor_user_id uuid REFERENCES users(id), target_id text,
 entity text NOT NULL, action text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
 before_data jsonb, after_data jsonb, reason text
);
CREATE INDEX ON audit_events(occurred_at DESC);
CREATE INDEX ON audit_events(actor_user_id);
CREATE FUNCTION orbit_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_data jsonb; new_data jsonb;
BEGIN
 IF TG_OP <> 'INSERT' THEN old_data := to_jsonb(OLD); END IF;
 IF TG_OP <> 'DELETE' THEN new_data := to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME = 'users' THEN
   old_data := old_data - 'password_hash' - 'last_seen_at' - 'last_login_at' - 'updated_at';
   new_data := new_data - 'password_hash' - 'last_seen_at' - 'last_login_at' - 'updated_at';
   IF TG_OP = 'UPDATE' AND old_data = new_data THEN RETURN NEW; END IF;
 END IF;
 INSERT INTO audit_events(actor_user_id,target_id,entity,action,before_data,after_data,reason)
 VALUES (nullif(current_setting('orbit.actor',true),'')::uuid, coalesce(new_data->>'id',old_data->>'id'),
 TG_TABLE_NAME,TG_OP,old_data,new_data,nullif(current_setting('orbit.reason',true),''));
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION orbit_audit_change();
CREATE TRIGGER audit_customers AFTER INSERT OR UPDATE OR DELETE ON customers FOR EACH ROW EXECUTE FUNCTION orbit_audit_change();
CREATE FUNCTION orbit_protect_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are append-only'; END $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION orbit_protect_audit();
COMMIT;

-- ARCHIVO: 002_catalog.sql
BEGIN;
CREATE TABLE products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code varchar(40) NOT NULL UNIQUE CHECK(code=upper(trim(code)) AND length(code)>0),
 name varchar(120) NOT NULL CHECK(length(trim(name))>0),
 description varchar(1000) NOT NULL DEFAULT '', category varchar(80) NOT NULL DEFAULT '',
 kind text NOT NULL CHECK(kind IN ('product','service')),
 tracks_inventory boolean NOT NULL DEFAULT true,
 base_price numeric(14,2) NOT NULL CHECK(base_price>=0), currency text NOT NULL DEFAULT 'COP' CHECK(currency='COP'),
 tax_treatment text NOT NULL CHECK(tax_treatment IN ('taxed','exempt','excluded')),
 vat_rate numeric(5,2) NOT NULL CHECK(vat_rate>=0 AND vat_rate<=100),
 active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES users(id), updated_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1,
 CHECK(kind<>'service' OR tracks_inventory=false),
 CHECK(tax_treatment='taxed' OR vat_rate=0)
);
CREATE INDEX ON products(active,category);
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION orbit_audit_change();
COMMIT;

-- ARCHIVO: 003_inventory.sql
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

-- ARCHIVO: 004_sales.sql
BEGIN;

-- =========================================
-- 004_sales.sql
-- Módulo de ventas de ORBIT CRM
-- =========================================

-- =========================================
-- TABLA: sales
-- Información general de cada venta
-- =========================================

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    customer_id UUID NOT NULL
        REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    created_by UUID NOT NULL
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),

    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (status IN ('completed', 'cancelled')),

    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (subtotal >= 0),

    tax_total NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (tax_total >= 0),

    total NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (total >= 0),

    notes VARCHAR(500) NOT NULL DEFAULT '',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT sales_total_consistency
        CHECK (total = subtotal + tax_total)
);

-- =========================================
-- TABLA: sale_items
-- Productos o servicios de cada venta
-- =========================================

CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sale_id UUID NOT NULL
        REFERENCES sales(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    product_id UUID NOT NULL
        REFERENCES products(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    product_name VARCHAR(120) NOT NULL,

    product_code VARCHAR(40) NOT NULL,

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    unit_price NUMERIC(14,2) NOT NULL
        CHECK (unit_price >= 0),

    tax_treatment TEXT NOT NULL
        CHECK (tax_treatment IN ('taxed', 'exempt', 'excluded')),

    vat_rate NUMERIC(5,2) NOT NULL
        CHECK (vat_rate BETWEEN 0 AND 100),

    subtotal NUMERIC(14,2) NOT NULL
        CHECK (subtotal >= 0),

    tax_amount NUMERIC(14,2) NOT NULL
        CHECK (tax_amount >= 0),

    total NUMERIC(14,2) NOT NULL
        CHECK (total >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT sale_items_total_consistency
        CHECK (total = subtotal + tax_amount),

    CONSTRAINT sale_items_tax_consistency
        CHECK (tax_treatment = 'taxed' OR vat_rate = 0)
);

-- =========================================
-- ÍNDICES PARA CONSULTAS Y REPORTES
-- =========================================

CREATE INDEX idx_sales_customer_id
    ON sales(customer_id);

CREATE INDEX idx_sales_created_by
    ON sales(created_by);

CREATE INDEX idx_sales_sale_date
    ON sales(sale_date DESC);

CREATE INDEX idx_sales_status_date
    ON sales(status, sale_date DESC);

CREATE INDEX idx_sale_items_sale_id
    ON sale_items(sale_id);

CREATE INDEX idx_sale_items_product_id
    ON sale_items(product_id);

-- =========================================
-- AUDITORÍA
-- Aprovecha la función existente del CRM
-- =========================================

CREATE TRIGGER audit_sales
AFTER INSERT OR UPDATE OR DELETE ON sales
FOR EACH ROW
EXECUTE FUNCTION orbit_audit_change();

CREATE TRIGGER audit_sale_items
AFTER INSERT OR UPDATE OR DELETE ON sale_items
FOR EACH ROW
EXECUTE FUNCTION orbit_audit_change();

-- =========================================
-- REGISTRO DE MIGRACIÓN
-- Lo completa setup.ts al ejecutar el archivo.
-- =========================================

COMMIT;
-- ARCHIVO: 005_sales_inventory_snapshot.sql
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

CREATE TABLE IF NOT EXISTS orbit_migrations(name text PRIMARY KEY,applied_at timestamptz DEFAULT now());
INSERT INTO orbit_migrations(name) VALUES('001_access') ON CONFLICT DO NOTHING;
INSERT INTO orbit_migrations(name) VALUES('002_catalog') ON CONFLICT DO NOTHING;
INSERT INTO orbit_migrations(name) VALUES('003_inventory') ON CONFLICT DO NOTHING;
INSERT INTO orbit_migrations(name) VALUES('004_sales') ON CONFLICT DO NOTHING;
INSERT INTO orbit_migrations(name) VALUES('005_sales_inventory_snapshot') ON CONFLICT DO NOTHING;
