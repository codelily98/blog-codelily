#!/bin/sh
set -eu
export CL_RUNTIME_PASSWORD="$(cat /run/secrets/runtime_password)"
export CL_MIGRATOR_PASSWORD="$(cat /run/secrets/migrator_password)"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv runtime_password CL_RUNTIME_PASSWORD
\getenv migrator_password CL_MIGRATOR_PASSWORD
CREATE ROLE code_lily_migrator LOGIN PASSWORD :'migrator_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 2;
CREATE ROLE code_lily_runtime LOGIN PASSWORD :'runtime_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 10;
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
ALTER DEFAULT PRIVILEGES FOR ROLE code_lily_migrator IN SCHEMA blog_schema GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO code_lily_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE code_lily_migrator IN SCHEMA blog_schema GRANT USAGE,SELECT ON SEQUENCES TO code_lily_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE code_lily_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
SQL
