// Local QA only: PostgreSQL wire fixture + a real Next.js production server.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import path from 'node:path';
const db = await PGlite.create();
await db.exec('CREATE SCHEMA blog_schema');
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55433 });
await server.start();
const env = {
  ...process.env,
  DATABASE_URL: 'postgresql://postgres:fixture@127.0.0.1:55433/postgres',
  DB_POOL_MAX: '1',
  APP_URL: 'http://localhost:3000',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'codelily-isolated-e2e-only-secret-0123456789-abcdefgh',
  GOOGLE_CLIENT_ID: 'fixture-not-a-google-client',
  GOOGLE_CLIENT_SECRET: 'fixture-not-a-provider-secret',
  TELEMETRY_SECRET: 'codelily-isolated-telemetry-fixture-0123456789',
  INTERNAL_API_TOKEN: 'codelily-isolated-summary-token-0123456789',
  CODELILY_AUTH_FIXTURE: '1',
};
const run = (file: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), file], {
      env: { ...env, NODE_ENV: 'development' },
      stdio: 'inherit',
    });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Fixture setup failed: ${file}`)),
    );
  });
try {
  await run('scripts/migrate.ts');
  await run('scripts/seed.ts');
  await run('scripts/e2e-auth-fixture.ts');
} catch (error) {
  await server.stop();
  await db.close();
  throw error;
}
const next = spawn(
  process.execPath,
  [path.resolve('apps/code-lily/.next/standalone/apps/code-lily/server.js')],
  {
    env: { ...env, NODE_ENV: 'production', HOSTNAME: 'localhost', PORT: '3000' },
    stdio: 'inherit',
  },
);
const stop = async () => {
  next.kill();
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
next.on('exit', () => {
  void stop();
});
