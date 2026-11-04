import { readFile } from 'node:fs/promises';
import { getDatabase } from '../apps/code-lily/src/infrastructure/database';
const pruneAuthRateLimit = await readFile(
  new URL('./prune-auth-rate-limit.sql', import.meta.url),
  'utf8',
);
const db = await getDatabase();
try {
  // Bounded batches; schedule from the host/CI with a dedicated maintenance role.
  const commands = [
    "DELETE FROM telemetry_events WHERE id IN (SELECT id FROM telemetry_events WHERE created_at<now()-interval '30 days' LIMIT 5000)",
    "DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs WHERE created_at<now()-interval '90 days' LIMIT 5000)",
    'DELETE FROM session WHERE id IN (SELECT id FROM session WHERE "expiresAt"<now() LIMIT 5000)',
    'DELETE FROM verification WHERE id IN (SELECT id FROM verification WHERE "expiresAt"<now() LIMIT 5000)',
    pruneAuthRateLimit,
  ];
  for (const command of commands) await db.query(command);
  console.log('Bounded retention maintenance completed.');
} finally {
  await db.end();
}
