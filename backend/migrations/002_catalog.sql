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
