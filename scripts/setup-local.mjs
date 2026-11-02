import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
await mkdir('.local/secrets', { recursive: true });
const secrets = {};
for (const name of ['postgres', 'runtime', 'migrator', 'redis']) {
  const file = `.local/secrets/${name}-password.txt`;
  try {
    secrets[name] = (await readFile(file, 'utf8')).trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    secrets[name] = randomBytes(32).toString('hex');
    await writeFile(file, secrets[name], { mode: 0o600 });
  }
}
const hash = createHash('sha256').update(secrets.redis).digest('hex');
await writeFile(
  '.local/secrets/redis-users.acl',
  `user default off\nuser code_lily on #${hash} ~cl:dev:blog:* +ping +get +set +del +expire +pexpire +ttl +pttl +zadd +zscore +zcount +zcard +zremrangebyscore +time +eval +evalsha +script|load\n`,
  { mode: 0o600 },
);
const createIfMissing = async (file, contents) => {
  try {
    await access(file);
    console.log(`${file} preserved.`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(file, contents, { mode: 0o600 });
    console.log(`${file} created (secret values omitted).`);
  }
};
await createIfMissing(
  'apps/code-lily/.env.local',
  `APP_URL=http://localhost:3000\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=${randomBytes(48).toString('hex')}\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\nOWNER_EMAILS=codelily98@gmail.com\nDATABASE_URL=postgresql://code_lily_runtime:${secrets.runtime}@127.0.0.1:55432/codelily_production\nDB_POOL_MAX=5\nREDIS_URL=redis://code_lily:${secrets.redis}@127.0.0.1:56379\nTELEMETRY_SECRET=${randomBytes(32).toString('hex')}\nINTERNAL_API_TOKEN=${randomBytes(32).toString('hex')}\nR2_ACCOUNT_ID=\nR2_ACCESS_KEY_ID=\nR2_SECRET_ACCESS_KEY=\nR2_PUBLIC_BUCKET=\nR2_PRIVATE_BUCKET=\nR2_PUBLIC_BASE_URL=\n`,
);
await createIfMissing(
  'apps/code-lily/.env.migrate.local',
  `DATABASE_URL=postgresql://code_lily_migrator:${secrets.migrator}@127.0.0.1:55432/codelily_production\nDB_POOL_MAX=1\n`,
);
console.log('Local settings ready. No OAuth or R2 provider credentials were generated.');
const hostEnv = await readFile('apps/code-lily/.env.local', 'utf8');
await createIfMissing(
  '.local/web.env',
  hostEnv
    .replaceAll('127.0.0.1:55432', 'postgres:5432')
    .replaceAll('127.0.0.1:56379', 'redis:6379'),
);
