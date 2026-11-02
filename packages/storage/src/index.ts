import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBucket: string;
  privateBucket: string;
  publicBaseUrl: string;
}
export interface FileReservation {
  id: string;
  contentType: string;
  size: number;
  public: boolean;
}
export const allowedContentTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
] as const;
export function storageConfigured(env: NodeJS.ProcessEnv = process.env) {
  return [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_PUBLIC_BUCKET',
    'R2_PRIVATE_BUCKET',
    'R2_PUBLIC_BASE_URL',
  ].every((key) => Boolean(env[key]));
}
export function storageFromEnvironment() {
  if (!storageConfigured()) throw new Error('Cloudflare R2 설정이 필요합니다.');
  return new R2Storage({
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    publicBucket: process.env.R2_PUBLIC_BUCKET!,
    privateBucket: process.env.R2_PRIVATE_BUCKET!,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL!,
  });
}
export function matchesSignature(bytes: Uint8Array, type: string) {
  const text = Buffer.from(bytes).toString('ascii');
  if (type === 'image/png')
    return Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/webp') return text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP';
  if (type === 'image/avif')
    return text.slice(4, 8) === 'ftyp' && /avif|avis/.test(text.slice(8, 32));
  if (type === 'application/pdf') return text.startsWith('%PDF-');
  return false;
}
export class R2Storage {
  private client: S3Client;
  constructor(private config: StorageConfig) {
    if (!/^https:\/\//.test(config.publicBaseUrl))
      throw new Error('R2 public domain must use HTTPS.');
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }
  async reserve(input: FileReservation) {
    const key = `pending/${input.id}`;
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.config.privateBucket,
        Key: key,
        ContentType: input.contentType,
        ContentLength: input.size,
      }),
      { expiresIn: 300 },
    );
    return { key, url, expiresIn: 300 };
  }
  async complete(input: FileReservation) {
    const pending = `pending/${input.id}`;
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.config.privateBucket, Key: pending }),
    );
    if (head.ContentLength !== input.size || head.ContentType !== input.contentType)
      throw new Error('업로드 파일 크기 또는 형식이 일치하지 않습니다.');
    if (!head.ETag) throw new Error('파일 버전을 확인하지 못했습니다.');
    const prefix = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.privateBucket,
        Key: pending,
        Range: 'bytes=0-511',
        IfMatch: head.ETag,
      }),
    );
    if (
      !prefix.Body ||
      !matchesSignature(await prefix.Body.transformToByteArray(), input.contentType)
    )
      throw new Error('허용된 파일 형식이 아닙니다.');
    if (input.public && input.contentType === 'application/pdf')
      throw new Error('PDF는 비공개 파일로 업로드해주세요.');
    const key = `objects/${input.id}`;
    const bucket = input.public ? this.config.publicBucket : this.config.privateBucket;
    await this.client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: key,
        CopySource: `${this.config.privateBucket}/${pending}`,
        CopySourceIfMatch: head.ETag,
        MetadataDirective: 'REPLACE',
        ContentType: input.contentType,
        CacheControl: input.public ? 'public, max-age=31536000, immutable' : 'private, no-store',
      }),
    );
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.privateBucket, Key: pending }),
    );
    return {
      key,
      url: input.public ? `${this.config.publicBaseUrl.replace(/\/$/, '')}/${key}` : null,
    };
  }
  async download(key: string) {
    if (!/^objects\/[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid object key');
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.privateBucket,
        Key: key,
        ResponseContentDisposition: 'attachment',
        ResponseCacheControl: 'private, no-store',
      }),
      { expiresIn: 60 },
    );
  }
}
