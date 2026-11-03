import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';

// Run from the repository root, on the deployment host. Never prints values.
await readFile('infra/compose.production.yml');
for (const directory of ['infra/secrets', 'infra/env']) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
}
async function create(file, contents, mode) {
  try {
    await writeFile(file, contents, { flag: 'wx', mode });
    console.log(`${file}: created (values omitted)`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`${file}: preserved`);
  }
  await chmod(file, mode);
}
async function secret(name) {
  const file = `infra/secrets/${name}.txt`;
  await create(file, randomBytes(32).toString('hex'), 0o444);
  const value = (await readFile(file, 'utf8')).trim();
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${file}: expected an existing 32-byte hex secret; no rotation performed`);
  }
  return value;
}
const passwords = {};
for (const role of ['postgres', 'runtime', 'migrator', 'maintenance', 'redis']) {
  passwords[role] = await secret(`${role}-password`);
}
const auth = await secret('auth-secret');
const telemetry = await secret('telemetry-secret');
const internal = await secret('internal-api-token');
const databaseUrl = (role) =>
  `postgresql://code_lily_${role}:${passwords[role]}@postgres:5432/codelily_production`;
await create(
  'infra/env/code-lily.env',
  [
    'APP_URL=https://blog.codelily.kr',
    'BETTER_AUTH_URL=https://blog.codelily.kr',
    `BETTER_AUTH_SECRET=${auth}`,
    'OWNER_EMAILS=codelily98@gmail.com',
    `DATABASE_URL=${databaseUrl('runtime')}`,
    'DB_POOL_MAX=5',
    `TELEMETRY_SECRET=${telemetry}`,
    `INTERNAL_API_TOKEN=${internal}`,
    'GOOGLE_CLIENT_ID=',
    'GOOGLE_CLIENT_SECRET=',
    'R2_ACCOUNT_ID=',
    'R2_ACCESS_KEY_ID=',
    'R2_SECRET_ACCESS_KEY=',
    'R2_PUBLIC_BUCKET=',
    'R2_PRIVATE_BUCKET=',
    'R2_PUBLIC_BASE_URL=',
    '',
  ].join('\n'),
  0o600,
);
for (const role of ['migrator', 'maintenance']) {
  await create(
    `infra/env/code-lily-${role}.env`,
    `DATABASE_URL=${databaseUrl(role)}\nDB_POOL_MAX=1\n`,
    0o600,
  );
}
const redisHash = createHash('sha256').update(passwords.redis).digest('hex');
await create(
  'infra/secrets/redis-users.acl',
  `user default off\nuser code_lily on #${redisHash} ~cl:prod:blog:* +ping +get +set +del +expire +pexpire +ttl +pttl +zadd +zscore +zcount +zcard +zremrangebyscore +time +eval +evalsha +script|load\n`,
  0o444,
);
for (const name of ['cloudflare-tunnel-token', 'cloudflare-dns-token']) {
  await create(`infra/secrets/${name}.txt`, '', 0o444);
}
await create('infra/.env', await readFile('infra/.env.example', 'utf8'), 0o600);
console.log(
  'Fill image digests, Google/R2 credentials and both Cloudflare token files before launch.',
);
console.log(
  'Secret directories: 0700; bind-mounted secret files: 0444 for non-root containers; env files: 0600.',
);
console.log(
  'Existing values were preserved. This does not change passwords in an existing database.',
);
