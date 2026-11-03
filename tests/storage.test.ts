import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  assert.equal(url.hostname, `${config.privateBucket}.${config.accountId}.r2.cloudflarestorage.com`);
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
