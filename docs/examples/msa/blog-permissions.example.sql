-- One-time example for a NEW environment, run by a provisioning administrator.
-- Not idempotent. Review existing grants instead of replaying on a live database.
-- Provision each of the other five apps with DISTINCT role and schema names.
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'codelily_production' THEN
    RAISE EXCEPTION 'Connect to codelily_production first';
  END IF;
END
$$;

CREATE ROLE blog_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
CREATE ROLE blog_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 6;
-- No passwords are embedded. Set unique passwords through secure provisioning.
-- Do not grant blog_migrator role membership to blog_runtime.

REVOKE ALL ON DATABASE codelily_production FROM PUBLIC;
GRANT CONNECT ON DATABASE codelily_production TO blog_migrator, blog_runtime;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

CREATE SCHEMA blog_schema AUTHORIZATION blog_migrator;
REVOKE ALL ON SCHEMA blog_schema FROM PUBLIC;
GRANT USAGE ON SCHEMA blog_schema TO blog_runtime;

ALTER ROLE blog_runtime IN DATABASE codelily_production
  SET search_path = pg_catalog, blog_schema;
ALTER ROLE blog_migrator IN DATABASE codelily_production
  SET search_path = blog_schema;
ALTER ROLE blog_runtime SET statement_timeout = '5s';
ALTER ROLE blog_runtime SET lock_timeout = '1s';
ALTER ROLE blog_runtime SET idle_in_transaction_session_timeout = '10s';

-- Apply to existing application objects too if bootstrap creates any.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA blog_schema
  TO blog_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA blog_schema TO blog_runtime;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA blog_schema FROM PUBLIC;

-- Future migrations MUST create their objects as blog_migrator.
ALTER DEFAULT PRIVILEGES FOR ROLE blog_migrator IN SCHEMA blog_schema
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO blog_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE blog_migrator IN SCHEMA blog_schema
  GRANT USAGE, SELECT ON SEQUENCES TO blog_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE blog_migrator
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Grant EXECUTE only on explicitly reviewed functions when needed.
COMMIT;
