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