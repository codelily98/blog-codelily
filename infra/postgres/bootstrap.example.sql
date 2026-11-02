-- New database only. Execute as provisioning administrator, not as the app.
-- Passwords must be set securely outside source control.
BEGIN;
CREATE ROLE code_lily_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 2;
CREATE ROLE code_lily_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 10;
REVOKE ALL ON DATABASE codelily_production FROM PUBLIC;
GRANT CONNECT ON DATABASE codelily_production TO code_lily_migrator,code_lily_runtime;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA blog_schema AUTHORIZATION code_lily_migrator;
GRANT USAGE ON SCHEMA blog_schema TO code_lily_runtime;
ALTER ROLE code_lily_runtime IN DATABASE codelily_production SET search_path=blog_schema,pg_catalog;
ALTER ROLE code_lily_migrator IN DATABASE codelily_production SET search_path=blog_schema,pg_catalog;
ALTER ROLE code_lily_runtime SET statement_timeout='5s';
ALTER ROLE code_lily_runtime SET lock_timeout='1s';
ALTER ROLE code_lily_runtime SET idle_in_transaction_session_timeout='10s';
ALTER DEFAULT PRIVILEGES FOR ROLE code_lily_migrator IN SCHEMA blog_schema
  GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO code_lily_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE code_lily_migrator IN SCHEMA blog_schema
  GRANT USAGE,SELECT ON SEQUENCES TO code_lily_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE code_lily_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
-- After migration: REVOKE INSERT, UPDATE, DELETE ON blog_schema.schema_migrations FROM code_lily_runtime;
-- Never grant code_lily_migrator membership or superuser credentials to runtime.
