import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { getDatabase, transaction } from '../apps/code-lily/src/infrastructure/database';

const db = await getDatabase();
try {
  const schema = await db.query("SELECT 1 FROM pg_namespace WHERE nspname='blog_schema'");
  if (!schema.rows.length) throw new Error('Bootstrap blog_schema with its migration owner first.');
  await db.query(
    'CREATE TABLE IF NOT EXISTS blog_schema.schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
  );
  const directory = path.resolve('apps/code-lily/migrations');
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    const existing = await db.query(
      'SELECT version FROM blog_schema.schema_migrations WHERE version=$1',
      [file],
    );
    if (existing.rows.length) continue;
    const sql = await readFile(path.join(directory, file), 'utf8');
    await transaction(db, async (connection) => {
      await connection.query(sql);
      await connection.query('INSERT INTO blog_schema.schema_migrations(version) VALUES($1)', [
        file,
      ]);
    });
    console.log(`Applied ${file}`);
  }
} finally {
  await db.end();
}
