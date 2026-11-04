import { randomUUID } from 'node:crypto';
import { AppError, authenticated, writer, type Actor } from '../../identity/domain/policy';
import type { R2Storage } from '@codelily/storage';

export interface UploadRecord {
  id: string;
  ownerId: string | null;
  objectKey: string;
  bucketKind: 'PUBLIC' | 'PRIVATE';
  contentType: string;
  expectedSize: number;
  status: 'PENDING' | 'READY' | 'REJECTED';
}
export interface UploadRepository {
  find(id: string): Promise<UploadRecord | null>;
  reserve(row: UploadRecord & { ownerId: string }): Promise<void>;
  finish(id: string, key: string): Promise<void>;
  reject(id: string): Promise<void>;
  recentCount(ownerId: string): Promise<number>;
}
export class UploadsService {
  constructor(
    private repository: UploadRepository,
    private storage: R2Storage,
  ) {}
  async reserve(
    input: { contentType: string; size: number; public: boolean },
    actor: Actor | null,
  ) {
    writer(actor);
    if ((await this.repository.recentCount(actor.id)) >= 20)
      throw new AppError(429, '시간당 업로드 한도에 도달했습니다.');
    if (input.public && !input.contentType.startsWith('image/'))
      throw new AppError(400, '공개 업로드는 이미지만 허용합니다.');
    const id = randomUUID();
    const reservation = await this.storage.reserve({ ...input, id });
    await this.repository.reserve({
      id,
      ownerId: actor.id,
      objectKey: reservation.key,
      bucketKind: input.public ? 'PUBLIC' : 'PRIVATE',
      contentType: input.contentType,
      expectedSize: input.size,
      status: 'PENDING',
    });
    return { id, ...reservation };
  }
  async complete(id: string, actor: Actor | null) {
    writer(actor);
    const file = await this.repository.find(id);
    if (!file || file.ownerId !== actor.id) throw new AppError(404, '업로드 예약이 없습니다.');
    if (file.status !== 'PENDING') throw new AppError(409, '이미 처리된 업로드입니다.');
    try {
      const result = await this.storage.complete({
        id,
        contentType: file.contentType,
        size: file.expectedSize,
        public: file.bucketKind === 'PUBLIC',
      });
      await this.repository.finish(id, result.key);
      return { id, ...result };
    } catch {
      await this.repository.reject(id);
      throw new AppError(400, '파일 검증에 실패했습니다. 새 업로드를 시도해주세요.');
    }
  }
  async download(id: string, actor: Actor | null) {
    authenticated(actor);
    const file = await this.repository.find(id);
    if (
      !file ||
      file.status !== 'READY' ||
      file.bucketKind !== 'PRIVATE' ||
      (file.ownerId !== actor.id && actor.role !== 'OWNER')
    )
      throw new AppError(404, '파일을 찾을 수 없습니다.');
    return { url: await this.storage.download(file.objectKey), expiresIn: 60 };
  }
}
