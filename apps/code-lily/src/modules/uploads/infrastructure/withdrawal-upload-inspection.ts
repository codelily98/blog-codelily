import { transaction, type Connection, type Database } from '../../../infrastructure/database';
import {
  eligibleForSettlement,
  type UploadDisposition,
  type UploadReview,
  type WithdrawalChoice,
} from '../application/withdrawal-upload-settlement';

export async function inspectWithdrawalUploads(
  db: Database,
  memberId: string,
  choice: WithdrawalChoice,
  after: string | null,
) {
  return transaction(db, async (connection) => {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const {
      rows: [member],
    } = await connection.query<{ role: string }>('SELECT role FROM "user" WHERE id = $1', [
      memberId,
    ]);
    if (!member || member.role === 'OWNER')
      return { status: member ? 'owner_account' : 'missing', uploads: [], next: null } as const;

    const rows = await reviewUploads(connection, memberId, choice, after, null);
    const uploads = rows.slice(0, 20);
    return { status: 'review', uploads, next: rows.length > 20 ? uploads[19].id : null } as const;
  });
}

export async function assertSettlementRole(db: Pick<Database, 'query'>) {
  const { rows } = await db.query<{ allowed: boolean }>(
    `SELECT pg_has_role(current_user, relowner, 'USAGE') AS allowed
     FROM pg_class WHERE oid = 'blog_schema.uploads'::regclass`,
  );
  if (!rows[0]?.allowed) throw new Error('Withdrawal settlement requires the uploads table owner');
}

export async function reviewWithdrawalUpload(
  db: Database,
  memberId: string,
  choice: WithdrawalChoice,
  uploadId: string,
) {
  const rows = await reviewUploads(db, memberId, choice, null, uploadId);
  return rows[0] ?? null;
}

export async function settleVerifiedWithdrawalUpload(
  db: Database,
  memberId: string,
  choice: WithdrawalChoice,
  reviewed: UploadReview,
  disposition: UploadDisposition,
) {
  return transaction(db, async (connection) => {
    await assertSettlementRole(connection);
    const { rows: members } = await connection.query(
      `SELECT id FROM "user" WHERE id=$1 AND role <> 'OWNER' FOR UPDATE NOWAIT`,
      [memberId],
    );
    if (!members.length) return 'missing' as const;
    const { rows: owned } = await connection.query(
      'SELECT id FROM uploads WHERE id=$1 AND owner_id=$2 FOR UPDATE NOWAIT',
      [reviewed.id, memberId],
    );
    if (!owned.length) return 'missing' as const;

    // Only the short recheck and update hold locks. R2/CDN checks happen before this transaction.
    await connection.query('LOCK TABLE posts, about_sections, comments IN SHARE MODE NOWAIT');
    const [current] = await reviewUploads(connection, memberId, choice, null, reviewed.id);
    if (
      !current ||
      !eligibleForSettlement(current, disposition) ||
      current.bucketKind !== reviewed.bucketKind ||
      current.status !== reviewed.status ||
      current.postReferences !== reviewed.postReferences ||
      current.aboutReferences !== reviewed.aboutReferences ||
      current.commentReferences !== reviewed.commentReferences
    )
      return 'changed' as const;

    const statement =
      disposition === 'retain-public'
        ? 'UPDATE uploads SET owner_id=NULL WHERE id=$1 AND owner_id=$2 RETURNING id'
        : 'DELETE FROM uploads WHERE id=$1 AND owner_id=$2 RETURNING id';
    const { rows } = await connection.query(statement, [reviewed.id, memberId]);
    return rows.length === 1 ? ('applied' as const) : ('changed' as const);
  });
}

async function reviewUploads(
  db: Pick<Connection, 'query'>,
  memberId: string,
  choice: WithdrawalChoice,
  after: string | null,
  uploadId: string | null,
) {
  const { rows } = await db.query<UploadReview>(
    `WITH owned AS (
        SELECT id, bucket_kind, status, object_key, created_at
        FROM uploads
        WHERE owner_id = $1 AND ($3::uuid IS NULL OR id > $3) AND ($4::uuid IS NULL OR id = $4)
          AND EXISTS (SELECT 1 FROM "user" WHERE id = $1 AND role <> 'OWNER')
        ORDER BY id LIMIT 21
      )
      SELECT u.id, u.bucket_kind AS "bucketKind", u.status,
        u.object_key = (CASE WHEN u.status = 'READY' THEN 'objects/' ELSE 'pending/' END) || u.id AS "expectedKey",
        u.created_at <= now() - interval '5 minutes' AS "putWindowElapsed",
        (SELECT count(*)::int FROM posts p
          WHERE (
            (p.author_id IS DISTINCT FROM $1 OR ($2 = 'keep' AND p.status = 'PUBLISHED'))
              AND strpos(replace(lower(concat_ws(' ', p.slug, p.title, p.excerpt, p.source, p.rendered_html, p.tags::text)), '%2d', '-'), u.id::text) > 0
          ) OR (
            p.author_id = $1 AND ($2 = 'delete' OR p.status <> 'PUBLISHED')
              AND EXISTS (SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.author_id IS DISTINCT FROM $1)
              AND strpos(replace(lower(concat_ws(' ', p.slug, p.title, p.tags::text)), '%2d', '-'), u.id::text) > 0
          )
        ) AS "postReferences",
        (SELECT count(*)::int FROM about_sections a
          WHERE strpos(replace(lower(concat_ws(' ', a.title, a.subtitle, a.source, a.rendered_html, a.items::text)), '%2d', '-'), u.id::text) > 0
        ) AS "aboutReferences",
        (SELECT count(*)::int FROM comments c JOIN posts p ON p.id = c.post_id
          WHERE (c.author_id IS DISTINCT FROM $1 OR ($2 = 'keep' AND p.status = 'PUBLISHED'))
            AND strpos(replace(lower(c.body), '%2d', '-'), u.id::text) > 0
        ) AS "commentReferences"
      FROM owned u ORDER BY u.id`,
    [memberId, choice, after, uploadId],
  );
  return rows;
}
