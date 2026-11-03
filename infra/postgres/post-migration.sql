-- Run as provisioning administrator after each successful migration.
-- Explicit table grants keep the maintenance role out of user/account/content.
BEGIN;
REVOKE INSERT, UPDATE, DELETE ON blog_schema.schema_migrations FROM code_lily_runtime;
GRANT SELECT, DELETE ON blog_schema.telemetry_events, blog_schema.audit_logs,
  blog_schema.session, blog_schema.verification TO code_lily_maintenance;
COMMIT;
