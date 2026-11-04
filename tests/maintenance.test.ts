import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('auth rate-limit maintenance deletes one expired batch with restricted privileges', async () => {
  const db = await PGlite.create();
  try {
    await db.exec('CREATE SCHEMA blog_schema');
    for (const path of [
      'apps/code-lily/migrations/001_initial.sql',
      'apps/code-lily/migrations/002_rate_limit_retention.sql',
    ]) {
      await db.exec(await readFile(path, 'utf8'));
    }
    await db.exec(`
      CREATE ROLE code_lily_runtime;
      CREATE ROLE code_lily_maintenance;
      GRANT USAGE ON SCHEMA blog_schema TO code_lily_maintenance;
      CREATE TABLE schema_migrations (version text PRIMARY KEY);
      INSERT INTO "rateLimit" (id, key, count, "lastRequest")
      SELECT n::text, 'fixture-' || n, 1,
        (extract(epoch FROM (now() - interval '25 hours')) * 1000)::bigint + n
      FROM generate_series(1, 5001) AS n;
      INSERT INTO "rateLimit" (id, key, count, "lastRequest")
      VALUES ('recent', 'fixture-recent', 2,
        (extract(epoch FROM (now() - interval '23 hours')) * 1000)::bigint);
    `);
    await db.exec(await readFile('infra/postgres/post-migration.sql', 'utf8'));
    const prune = await readFile('scripts/prune-auth-rate-limit.sql', 'utf8');
    await db.exec('SET ROLE code_lily_maintenance');
    await assert.rejects(db.query('SELECT key FROM "rateLimit"'), { code: '42501' });
    await assert.rejects(db.query('SELECT id FROM "user"'), { code: '42501' });
    await assert.rejects(db.query('UPDATE "rateLimit" SET count = 0'), { code: '42501' });
    assert.equal((await db.query(prune)).affectedRows, 5000);
    assert.deepEqual((await db.query('SELECT id FROM "rateLimit" ORDER BY id')).rows, [
      { id: '5001' },
      { id: 'recent' },
    ]);
    assert.equal((await db.query(prune)).affectedRows, 1);
    assert.equal((await db.query(prune)).affectedRows, 0);
    assert.deepEqual((await db.query('SELECT id FROM "rateLimit"')).rows, [{ id: 'recent' }]);
  } finally {
    await db.close();
  }
});
