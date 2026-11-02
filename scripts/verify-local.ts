import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { PostsService } from '../apps/code-lily/src/modules/posts/application/posts.service';
import { PostgresPostsRepository } from '../apps/code-lily/src/modules/posts/infrastructure/postgres-posts.repository';
import type { Database } from '../apps/code-lily/src/infrastructure/database';
const exec = promisify(execFile);
const local = parseEnv(await readFile('apps/code-lily/.env.local', 'utf8'));
const migration = parseEnv(await readFile('apps/code-lily/.env.migrate.local', 'utf8'));
const runtime = new Pool({
  connectionString: local.DATABASE_URL,
  max: 1,
  options: '-c search_path=blog_schema,pg_catalog',
});
const migrator = new Pool({
  connectionString: migration.DATABASE_URL,
  max: 1,
  options: '-c search_path=blog_schema,pg_catalog',
});
const admin = (sql: string) =>
  exec('docker', [
    'compose',
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'postgres',
    '-d',
    'codelily_production',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    sql,
  ]);
try {
  await migrator.query(
    'REVOKE INSERT,UPDATE,DELETE ON blog_schema.schema_migrations FROM code_lily_runtime',
  );
  const identity = (await runtime.query('SELECT current_user,version()')).rows[0];
  assert.equal(identity.current_user, 'code_lily_runtime');
  assert.match(identity.version, /PostgreSQL 16\./);
  await assert.rejects(() => runtime.query('CREATE TABLE blog_schema.should_not_exist(id int)'), {
    code: '42501',
  });
  await assert.rejects(
    () => runtime.query("INSERT INTO schema_migrations(version) VALUES('not-allowed')"),
    { code: '42501' },
  );
  await admin(
    'CREATE SCHEMA codelily_isolation_probe; CREATE TABLE codelily_isolation_probe.private_data(id int);',
  );
  await assert.rejects(() => runtime.query('SELECT * FROM codelily_isolation_probe.private_data'), {
    code: '42501',
  });
  const posts = new PostsService(new PostgresPostsRepository(runtime as unknown as Database));
  const actor = {
    id: 'sample-author',
    name: 'code-lily',
    email: 'sample@local.invalid',
    role: 'EDITOR' as const,
  };
  const category = (await posts.categories())[0];
  const record = await posts.save(
    {
      title: 'Local PostgreSQL verification',
      slug: `local-check-${Date.now()}`,
      excerpt: 'Temporary integration check',
      source: '## 실제 PostgreSQL 검사',
      format: 'MARKDOWN',
      tags: [],
      status: 'DRAFT',
      categoryId: category.id,
    },
    actor,
  );
  assert.match(record.renderedHtml, /실제 PostgreSQL 검사/);
  await posts.delete(record.id, actor);
  const redis = await exec('docker', [
    'compose',
    'exec',
    '-T',
    'redis',
    'sh',
    '-c',
    'export REDISCLI_AUTH="$(cat /run/secrets/redis_password)"; redis-cli --user code_lily SET cl:dev:blog:verification ok; redis-cli --user code_lily GET cl:dev:blog:verification; redis-cli --user code_lily GET other:private; redis-cli --user code_lily CONFIG GET maxmemory; redis-cli --user code_lily DEL cl:dev:blog:verification',
  ]);
  assert.match(redis.stdout, /OK/);
  assert.match(redis.stdout, /ok/);
  assert.match(redis.stdout, /NOPERM/);
  console.log(
    'Actual PostgreSQL 16: runtime DML passed; DDL, migration-history write, cross-schema access rejected. Redis authentication/ACL passed.',
  );
} finally {
  await admin('DROP SCHEMA IF EXISTS codelily_isolation_probe CASCADE;');
  await runtime.end();
  await migrator.end();
}
