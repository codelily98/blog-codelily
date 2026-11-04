import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeadBucketCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { matchesSignature, R2Storage } from '../packages/storage/src/index';
test('upload signature checks reject content-type spoofing', () => {
  assert.equal(matchesSignature(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'), true);
  assert.equal(matchesSignature(Buffer.from('<script>alert(1)</script>'), 'image/png'), false);
  assert.equal(matchesSignature(Buffer.from('%PDF-1.7'), 'application/pdf'), true);
  assert.equal(matchesSignature(Buffer.from('not-a-file'), 'image/svg+xml'), false);
});

const config = {
  accountId: '0'.repeat(32),
  accessKeyId: 'offline-test-access-key',
  secretAccessKey: 'offline-test-secret-key',
  publicBucket: 'example-public',
  privateBucket: 'example-private',
  publicBaseUrl: 'https://media.example.invalid',
};

test('browser PUT signatures bind type/length without an empty-body CRC32 checksum', async () => {
  const storage = new R2Storage(config);
  const id = '00000000-0000-0000-0000-000000000000';
  const result = await storage.reserve({ id, contentType: 'image/png', size: 128, public: true });
  const url = new URL(result.url);
  assert.equal(
    url.hostname,
    `${config.privateBucket}.${config.accountId}.r2.cloudflarestorage.com`,
  );
  assert.equal(url.pathname, `/pending/${id}`);
  assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
  const signed = url.searchParams.get('X-Amz-SignedHeaders')!.split(';');
  assert.ok(signed.includes('content-length'));
  assert.ok(signed.includes('content-type'));
  assert.equal(url.searchParams.has('x-amz-checksum-crc32'), false);
  assert.equal(url.searchParams.has('x-amz-sdk-checksum-algorithm'), false);
});

test('R2 configuration rejects a custom domain as bucket name or a shared public/private bucket', () => {
  assert.throws(
    () => new R2Storage({ ...config, privateBucket: 'blog-r2.codelily.kr' }),
    /bucket names/,
  );
  assert.throws(
    () => new R2Storage({ ...config, publicBucket: config.privateBucket }),
    /separate buckets/,
  );
});

test('withdrawal inspection checks the staging and final keys and surfaces access failures', async (t) => {
  const storage = new R2Storage(config);
  const id = '00000000-0000-0000-0000-000000000123';
  const calls: Array<{ bucket: string | undefined; key?: string }> = [];
  let finalError = 404;
  t.mock.method(
    S3Client.prototype,
    'send',
    async (command: HeadBucketCommand | HeadObjectCommand) => {
      calls.push({
        bucket: command.input.Bucket,
        ...(command instanceof HeadObjectCommand ? { key: command.input.Key } : {}),
      });
      if (command instanceof HeadObjectCommand && command.input.Key?.startsWith('objects/'))
        throw Object.assign(new Error('fixture'), { $metadata: { httpStatusCode: finalError } });
      return {};
    },
  );
  const signal = AbortSignal.timeout(1000);
  await storage.checkBuckets(signal);
  assert.deepEqual(await storage.inspectUpload(id, true, signal), {
    pending: true,
    completed: false,
  });
  assert.deepEqual(calls, [
    { bucket: 'example-private' },
    { bucket: 'example-public' },
    { bucket: 'example-private', key: `pending/${id}` },
    { bucket: 'example-public', key: `objects/${id}` },
  ]);
  finalError = 403;
  await assert.rejects(storage.inspectUpload(id, false, signal), {
    $metadata: { httpStatusCode: 403 },
  });
  assert.deepEqual(calls.at(-1), { bucket: 'example-private', key: `objects/${id}` });
  await assert.rejects(storage.inspectUpload('invalid-id', false, signal), /Invalid upload ID/);
});

test('withdrawal probes the exact public URL without following redirects', async (t) => {
  const storage = new R2Storage(config);
  const id = '00000000-0000-0000-0000-000000000123';
  const signal = AbortSignal.timeout(1000);
  const probe = t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    assert.equal(url.href, `https://media.example.invalid/objects/${id}`);
    assert.deepEqual(init, { redirect: 'manual', signal });
    return new Response(null, {
      status: 302,
      headers: { Location: 'https://other.example.invalid/' },
    });
  });
  assert.equal(await storage.publicObjectStatus(id, signal), 302);
  assert.equal(probe.mock.callCount(), 1);
  await assert.rejects(storage.publicObjectStatus('../object', signal), /Invalid upload ID/);
  assert.equal(probe.mock.callCount(), 1);
});
