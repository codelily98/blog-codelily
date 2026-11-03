#!/bin/sh
set -eu
# The preceding local-init.sh creates the shared runtime/migrator roles.
# These scripts run only when PostgreSQL initializes an empty data volume.
export CL_MAINTENANCE_PASSWORD="$(cat /run/secrets/maintenance_password)"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv maintenance_password CL_MAINTENANCE_PASSWORD
CREATE ROLE code_lily_maintenance LOGIN PASSWORD :'maintenance_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 1;
GRANT CONNECT ON DATABASE codelily_production TO code_lily_maintenance;
GRANT USAGE ON SCHEMA blog_schema TO code_lily_maintenance;
ALTER ROLE code_lily_maintenance IN DATABASE codelily_production SET search_path=blog_schema,pg_catalog;
ALTER ROLE code_lily_maintenance SET statement_timeout='30s';
ALTER ROLE code_lily_maintenance SET lock_timeout='1s';
ALTER ROLE code_lily_maintenance SET idle_in_transaction_session_timeout='10s';
SQL
