import { transaction, type Database } from '../../../infrastructure/database';
import { AppError } from '../../identity/domain/policy';
import type { UploadRecord, UploadRepository } from '../application/uploads.service';
export class PostgresUploadsRepository implements UploadRepository {
  constructor(private db: Database) {}
  async find(id: string) {
    return (
      (
        await this.db.query<UploadRecord>(
          `SELECT id,owner_id AS "ownerId",object_key AS "objectKey",bucket_kind AS "bucketKind",content_type AS "contentType",expected_size AS "expectedSize",status FROM uploads WHERE id::text=$1`,
          [id],
        )
      ).rows[0] ?? null
    );
  }
  async reserve(row: UploadRecord) {
    await transaction(this.db, async (connection) => {
      await connection.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [row.ownerId]);
      const recent = await connection.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM uploads WHERE owner_id=$1 AND created_at>now()-interval '1 hour'",
        [row.ownerId],
      );
      if (recent.rows[0].count >= 20) throw new AppError(429, '시간당 업로드 한도에 도달했습니다.');
      await connection.query(
        'INSERT INTO uploads(id,owner_id,object_key,bucket_kind,content_type,expected_size) VALUES($1,$2,$3,$4,$5,$6)',
        [row.id, row.ownerId, row.objectKey, row.bucketKind, row.contentType, row.expectedSize],
      );
    });
  }
  async finish(id: string, key: string) {
    await this.db.query(
      "UPDATE uploads SET object_key=$1,status='READY' WHERE id=$2 AND status='PENDING'",
      [key, id],
    );
  }
  async reject(id: string) {
    await this.db.query("UPDATE uploads SET status='REJECTED' WHERE id=$1 AND status='PENDING'", [
      id,
    ]);
  }
  async recentCount(ownerId: string) {
    return (
      await this.db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM uploads WHERE owner_id=$1 AND created_at>now()-interval '1 hour'",
        [ownerId],
      )
    ).rows[0].count;
  }
}
