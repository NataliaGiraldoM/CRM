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
