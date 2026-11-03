import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('운영 설정은 비밀값을 노출하지 않고 재실행 시 기존 계정 설정을 보존한다', async () => {
  const temporaryRoot = path.resolve(tmpdir());
  const fixture = await mkdtemp(path.join(temporaryRoot, 'codelily-production-'));
  try {
    await mkdir(path.join(fixture, 'infra'));
    for (const file of ['compose.production.yml', '.env.example']) {
      await copyFile(path.resolve('infra', file), path.join(fixture, 'infra', file));
    }
    const run = () => {
      const result = spawnSync(process.execPath, [path.resolve('scripts/setup-production.mjs')], {
        cwd: fixture,
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    const output = run();
    const secretFile = path.join(fixture, 'infra/secrets/runtime-password.txt');
    const password = await readFile(secretFile, 'utf8');
    assert.match(password, /^[a-f0-9]{64}$/);
    assert.ok(!output.includes(password));
    const envFile = path.join(fixture, 'infra/env/code-lily.env');
    const original = await readFile(envFile, 'utf8');
    assert.ok(original.includes(`code_lily_runtime:${password}@postgres:5432/`));
    const customized = original.replace('GOOGLE_CLIENT_ID=', 'GOOGLE_CLIENT_ID=retained-client-id');
    await writeFile(envFile, customized);
    const nextOutput = run();
    assert.equal(await readFile(envFile, 'utf8'), customized);
    assert.equal(await readFile(secretFile, 'utf8'), password);
    assert.ok(!nextOutput.includes(password));
    assert.ok(!nextOutput.includes('retained-client-id'));
    assert.equal(
      await readFile(path.join(fixture, 'infra/secrets/cloudflare-tunnel-token.txt'), 'utf8'),
      '',
    );
    if (process.platform !== 'win32') {
      assert.equal((await stat(secretFile)).mode & 0o777, 0o444);
      assert.equal((await stat(path.dirname(secretFile))).mode & 0o777, 0o700);
      assert.equal((await stat(envFile)).mode & 0o777, 0o600);
    }
  } finally {
    assert.equal(path.dirname(fixture), temporaryRoot);
    assert.ok(path.basename(fixture).startsWith('codelily-production-'));
    await rm(fixture, { recursive: true, force: true });
  }
});
