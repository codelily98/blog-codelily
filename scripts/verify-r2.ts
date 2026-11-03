import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { S3Client, HeadBucketCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { storageFromEnvironment } from '../packages/storage/src/index';

if (process.env.R2_VERIFY_WRITE !== '1')
  throw new Error(
    'Set R2_VERIFY_WRITE=1 explicitly; verification creates and removes isolated test objects.',
  );

const privateBucket = process.env.R2_PRIVATE_BUCKET!;
const publicBucket = process.env.R2_PUBLIC_BUCKET!;
const publicBase = process.env.R2_PUBLIC_BASE_URL!;
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  maxAttempts: 2,
  requestHandler: { connectionTimeout: 3000, requestTimeout: 10000, throwOnRequestTimeout: true },
});
const created: { Bucket: string; Key: string }[] = [];
let phase = 'configuration';
const request = (url: string, options: RequestInit = {}) =>
  fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
const fixture = (isPublic: boolean, type: string, bytes: Buffer) => {
  const id = randomUUID();
  created.push({ Bucket: privateBucket, Key: `pending/${id}` });
  created.push({ Bucket: isPublic ? publicBucket : privateBucket, Key: `objects/${id}` });
  return { id, public: isPublic, contentType: type, size: bytes.length };
};

try {
  const storage = storageFromEnvironment();
  phase = 'bucket access';
  await client.send(new HeadBucketCommand({ Bucket: privateBucket }));
  await client.send(new HeadBucketCommand({ Bucket: publicBucket }));
  console.log('Bucket-scoped S3 access: PASS');

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8lp1kAAAAASUVORK5CYII=',
    'base64',
  );
  const image = fixture(true, 'image/png', png);
  const reservation = await storage.reserve(image);
  phase = 'private PUT CORS';
  const preflight = await request(reservation.url, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://blog.codelily.kr',
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.ok(preflight.ok);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://blog.codelily.kr');
  assert.match(preflight.headers.get('access-control-allow-methods') || '', /PUT/);
  assert.match(preflight.headers.get('access-control-allow-headers') || '', /content-type/i);
  await preflight.arrayBuffer();
  console.log('Browser PUT CORS preflight: PASS');

  phase = 'signed image PUT and completion';
  const upload = await request(reservation.url, {
    method: 'PUT',
    headers: { 'Content-Type': image.contentType },
    body: png,
  });
  assert.ok(upload.ok);
  await upload.arrayBuffer();
  const complete = await storage.complete(image);
  assert.equal(complete.url, `${publicBase.replace(/\/$/, '')}/objects/${image.id}`);
  console.log('Signed PUT, HEAD/signature/ETag validation and cross-bucket publication: PASS');

  phase = 'public CDN';
  const cacheStatuses: (string | null)[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const publicResponse = await request(complete.url!);
    assert.equal(publicResponse.status, 200);
    assert.equal(publicResponse.headers.get('content-type'), 'image/png');
    assert.match(publicResponse.headers.get('cache-control') || '', /max-age=31536000/);
    assert.deepEqual(Buffer.from(await publicResponse.arrayBuffer()), png);
    cacheStatuses.push(publicResponse.headers.get('cf-cache-status'));
    if (cacheStatuses.at(-1) === 'HIT') break;
  }
  console.log('Public image integrity: PASS; CDN states:', JSON.stringify(cacheStatuses));

  phase = 'private download';
  const pdf = Buffer.from('%PDF-1.7\n% isolated storage verification fixture\n%%EOF\n');
  const file = fixture(false, 'application/pdf', pdf);
  const fileReservation = await storage.reserve(file);
  const privatePut = await request(fileReservation.url, {
    method: 'PUT',
    headers: { 'Content-Type': file.contentType },
    body: pdf,
  });
  assert.ok(privatePut.ok);
  await privatePut.arrayBuffer();
  const privateComplete = await storage.complete(file);
  assert.equal(privateComplete.url, null);
  const download = await storage.download(privateComplete.key);
  assert.equal(new URL(download).searchParams.get('X-Amz-Expires'), '60');
  const privateGet = await request(download);
  assert.equal(privateGet.status, 200);
  assert.match(privateGet.headers.get('cache-control') || '', /no-store/);
  assert.deepEqual(Buffer.from(await privateGet.arrayBuffer()), pdf);
  const anonymousUrl = new URL(download);
  anonymousUrl.search = '';
  const anonymous = await request(anonymousUrl.href);
  assert.ok([401, 403].includes(anonymous.status));
  await anonymous.arrayBuffer();
  console.log('60-second signed private S3 download, no-store and unsigned denial: PASS');

  phase = 'spoofed image rejection';
  const invalidBytes = Buffer.from('<script>not an image</script>');
  const invalid = fixture(true, 'image/png', invalidBytes);
  const invalidReservation = await storage.reserve(invalid);
  const invalidPut = await request(invalidReservation.url, {
    method: 'PUT',
    headers: { 'Content-Type': invalid.contentType },
    body: invalidBytes,
  });
  assert.ok(invalidPut.ok);
  await invalidPut.arrayBuffer();
  await assert.rejects(() => storage.complete(invalid));
  console.log('Content-type spoofing rejected before public copy: PASS');
  if (process.env.R2_VERIFY_CDN === '1') {
    phase = 'CDN HIT requirement';
    assert.ok(cacheStatuses.includes('HIT'));
  }
  console.log(
    'Storage verification: PASS (editor/Google login flow is a separate acceptance test)',
  );
} catch (error) {
  const metadata = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  const code = /^[A-Za-z0-9_:-]{1,64}$/.test(metadata.name || '')
    ? metadata.name
    : 'VerificationError';
  console.error(
    'Storage verification failed at:',
    phase,
    'code:',
    code,
    'HTTP:',
    metadata.$metadata?.httpStatusCode || 'n/a',
  );
  process.exitCode = 1;
} finally {
  for (const object of created) {
    try {
      await client.send(new DeleteObjectCommand(object));
    } catch {
      console.error(
        'A generated verification object could not be removed; inspect this verification run before retrying.',
      );
      process.exitCode = 1;
    }
  }
  client.destroy();
  console.log(
    'Cleanup attempted only for this run’s generated UUID objects. Cached public test images may remain until expiry/purge.',
  );
}
