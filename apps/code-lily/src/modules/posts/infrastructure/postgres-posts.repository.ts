import type { Database, Connection } from '../../../infrastructure/database';
import { transaction } from '../../../infrastructure/database';
import { AppError } from '../../identity/domain/policy';
import type {
  PostRepository,
  Post,
  PostSummary,
  Category,
  Comment,
  PostInput,
  PostDraft,
  PostDraftWrite,
  DraftSummary,
  PreparedPost,
  PostSeries,
  PublicSeriesSummary,
  SeriesEntry,
} from '../domain/models';

const commonColumns = `p.id,p.slug,p.title,p.excerpt,p.tags,p.status,p.body_removed AS "bodyRemoved",GREATEST(1,ceil(length(p.source)::numeric/700))::int AS "readMinutes",
  p.category_id AS "categoryId",c.name AS "categoryName",p.author_id AS "authorId",coalesce(u.name,'탈퇴한 회원') AS "authorName",
  p.created_at AS "createdAt",p.updated_at AS "updatedAt",p.published_at AS "publishedAt"`;
const postJoins =
  'FROM posts p LEFT JOIN "user" u ON u.id=p.author_id LEFT JOIN categories c ON c.id=p.category_id';
const postSelect = `SELECT ${commonColumns},p.source,p.format,p.rendered_html AS "renderedHtml",p.edit_version AS "editVersion",
  CASE WHEN p.series_id IS NOT NULL THEN json_build_object('id',p.series_id,'position',p.series_position) END AS series ${postJoins}`;
const postListSelect = `SELECT ${commonColumns} ${postJoins}`;
const seriesColumns = 'id,name,owner_id AS "ownerId"';
const draftColumns =
  'id,owner_id AS "ownerId",post_id AS "postId",base_version AS "baseVersion",version,fields,updated_at AS "updatedAt"';
const categorySelect = `SELECT c.id,c.name,c.slug,c.owner_id AS "ownerId",count(p.id)::int AS count FROM categories c
  LEFT JOIN posts p ON p.category_id=c.id AND p.status='PUBLISHED'`;
const commentSelect = `SELECT c.id,c.post_id AS "postId",c.author_id AS "authorId",coalesce(u.name,'탈퇴한 회원') AS "authorName",c.body,c.created_at AS "createdAt"
  FROM comments c LEFT JOIN "user" u ON u.id=c.author_id`;
const serialize = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const postId = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
async function audit(connection: Connection, actorId: string, action: string, id: string) {
  await connection.query('INSERT INTO audit_logs(actor_id,action,entity_id) VALUES($1,$2,$3)', [
    actorId,
    action,
    id,
  ]);
}
export class PostgresPostsRepository implements PostRepository {
  constructor(private db: Database) {}
  async publishedCount() {
    return (
      await this.db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM posts WHERE status='PUBLISHED'",
      )
    ).rows[0].count;
  }
  async sitemapEntries() {
    return serialize(
      (
        await this.db.query<Pick<PostSummary, 'slug' | 'updatedAt'>>(
          `SELECT slug,updated_at AS "updatedAt" FROM posts WHERE status='PUBLISHED'
          ORDER BY published_at DESC NULLS LAST,id LIMIT 49996`,
        )
      ).rows,
    );
  }
  async listSeries(ownerId?: string | null) {
    const scope = ownerId === undefined ? '' : 'WHERE owner_id IS NOT DISTINCT FROM $1';
    return (
      await this.db.query<PostSeries>(
        `SELECT ${seriesColumns} FROM post_series ${scope} ORDER BY name,id LIMIT 200`,
        ownerId === undefined ? [] : [ownerId],
      )
    ).rows;
  }
  async findSeries(id: string) {
    return (
      (
        await this.db.query<PostSeries>(`SELECT ${seriesColumns} FROM post_series WHERE id=$1`, [
          id,
        ])
      ).rows[0] ?? null
    );
  }
  async saveSeries(input: { id?: string; name: string }, actorId: string) {
    return transaction(this.db, async (connection) => {
      const result = input.id
        ? await connection.query<PostSeries>(
            `UPDATE post_series SET name=$1 WHERE id=$2 RETURNING ${seriesColumns}`,
            [input.name, input.id],
          )
        : await connection.query<PostSeries>(
            `INSERT INTO post_series(name,owner_id) VALUES($1,$2) RETURNING ${seriesColumns}`,
            [input.name, actorId],
          );
      const series = result.rows[0];
      if (!series) throw new AppError(404, '시리즈를 찾을 수 없습니다.');
      await audit(connection, actorId, 'post.series.saved', series.id);
      return series;
    });
  }
  async deleteSeries(id: string, actorId: string) {
    try {
      await transaction(this.db, async (connection) => {
        const deleted = await connection.query('DELETE FROM post_series WHERE id=$1 RETURNING id', [
          id,
        ]);
        if (!deleted.rows.length) throw new AppError(404, '시리즈를 찾을 수 없습니다.');
        await audit(connection, actorId, 'post.series.deleted', id);
      });
    } catch (error) {
      if ((error as { constraint?: string }).constraint === 'posts_series_id_fkey')
        throw new AppError(409, '시리즈에 연결된 글을 먼저 분리해주세요.');
      throw error;
    }
  }
  async publishedSeriesEntries(id: string) {
    return (
      await this.db.query<SeriesEntry>(
        `SELECT slug,title,series_position AS position FROM posts
         WHERE series_id=$1 AND status='PUBLISHED' AND NOT body_removed ORDER BY series_position`,
        [id],
      )
    ).rows;
  }
  async publicSeriesPage(offset: number, limit: number) {
    return (
      await this.db.query<PublicSeriesSummary>(
        `SELECT s.id,s.name,visible.count,visible."firstSlug"
         FROM post_series s CROSS JOIN LATERAL (
           SELECT count(*)::int AS count,(array_agg(p.slug ORDER BY p.series_position))[1] AS "firstSlug"
           FROM posts p WHERE p.series_id=s.id AND p.status='PUBLISHED' AND NOT p.body_removed
         ) visible WHERE visible.count>0 ORDER BY s.name,s.id LIMIT $1 OFFSET $2`,
        [limit, offset],
      )
    ).rows;
  }
  async categories() {
    return serialize(
      (
        await this.db.query<Category>(
          `${categorySelect} GROUP BY c.id ORDER BY c.created_at,c.name`,
        )
      ).rows,
    );
  }
  async category(id: string) {
    return serialize(
      (await this.db.query<Category>(`${categorySelect} WHERE c.id::text=$1 GROUP BY c.id`, [id]))
        .rows[0] ?? null,
    );
  }
  async saveCategory(input: { id?: string; name: string; slug: string }, actorId: string) {
    const id = await transaction(this.db, async (connection) => {
      const result = input.id
        ? await connection.query<{ id: string }>(
            'UPDATE categories SET name=$1,slug=$2 WHERE id=$3 RETURNING id',
            [input.name, input.slug, input.id],
          )
        : await connection.query<{ id: string }>(
            'INSERT INTO categories(name,slug,owner_id) VALUES($1,$2,$3) RETURNING id',
            [input.name, input.slug, actorId],
          );
      await audit(connection, actorId, 'category.saved', result.rows[0].id);
      return result.rows[0].id;
    });
    return (await this.category(id))!;
  }
  async deleteCategory(id: string, actorId: string) {
    await transaction(this.db, async (connection) => {
      await connection.query('DELETE FROM categories WHERE id=$1', [id]);
      await audit(connection, actorId, 'category.deleted', id);
    });
  }
  async list(filters: Parameters<PostRepository['list']>[0]) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (!filters.includeDrafts) conditions.push(`p.status='PUBLISHED'`);
    if (filters.authorId) conditions.push(`p.author_id=${param(filters.authorId)}`);
    if (filters.withdrawn) conditions.push('p.author_id IS NULL');
    if (filters.category) conditions.push(`c.slug=${param(filters.category)}`);
    if (filters.tag) conditions.push(`${param(filters.tag)}=ANY(p.tags)`);
    if (filters.q) {
      const p = param(`%${filters.q.replace(/[%_\\]/g, '\\$&')}%`);
      conditions.push(`(p.title ILIKE ${p} OR p.excerpt ILIKE ${p})`);
    }
    const limit = param(Math.min(filters.limit ?? 24, 100));
    const offset = param(Math.min(filters.offset ?? 0, 10000));
    return serialize(
      (
        await this.db.query<PostSummary>(
          `${postListSelect} ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY p.published_at DESC NULLS LAST,p.updated_at DESC,p.id LIMIT ${limit} OFFSET ${offset}`,
          params,
        )
      ).rows,
    );
  }
  findById(id: string) {
    if (!postId.test(id)) return Promise.resolve(null);
    return this.find('p.id', id);
  }
  findBySlug(slug: string) {
    return this.find('p.slug', slug);
  }
  private async find(column: 'p.id' | 'p.slug', value: string) {
    return serialize(
      (await this.db.query<Post>(`${postSelect} WHERE ${column}=$1`, [value])).rows[0] ?? null,
    );
  }
  async save(input: PostInput & { renderedHtml: string }, actorId: string) {
    const id = await transaction(this.db, (connection) =>
      this.writePost(connection, input, actorId),
    );
    return (await this.findById(id))!;
  }
  private async writePost(
    connection: Connection,
    input: PreparedPost,
    actorId: string,
    newId?: string,
  ) {
    try {
      const values = [
        input.slug,
        input.title,
        input.excerpt,
        input.source,
        input.format,
        input.renderedHtml,
        input.tags,
        input.status,
        input.categoryId,
        input.series?.id ?? null,
        input.series?.position ?? null,
      ];
      const result = input.id
        ? await connection.query<{ id: string }>(
            `UPDATE posts SET slug=$1,title=$2,excerpt=$3,source=$4,format=$5,rendered_html=$6,tags=$7,status=$8,category_id=$9,
            series_id=CASE WHEN $12 THEN $10::uuid ELSE series_id END,
            series_position=CASE WHEN $12 THEN $11::int ELSE series_position END,
            updated_at=now(),published_at=CASE WHEN $8='PUBLISHED' THEN coalesce(published_at,now()) ELSE NULL END
            WHERE id=$13 AND NOT body_removed RETURNING id`,
            [...values, input.series !== undefined, input.id],
          )
        : await connection.query<{ id: string }>(
            `INSERT INTO posts(slug,title,excerpt,source,format,rendered_html,tags,status,category_id,series_id,series_position,author_id,published_at,id)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CASE WHEN $8='PUBLISHED' THEN now() ELSE NULL END,coalesce($13::uuid,gen_random_uuid())) RETURNING id`,
            [...values, actorId, newId ?? null],
          );
      if (!result.rows[0])
        throw new AppError(409, '글 상태가 바뀌었습니다. 목록을 새로고침해 주세요.');
      const id = result.rows[0].id;
      await audit(connection, actorId, 'post.saved', id);
      return id;
    } catch (error) {
      const { constraint } = error as { constraint?: string };
      if (constraint === 'posts_series_position_key')
        throw new AppError(409, '이 시리즈에서 이미 사용 중인 순서입니다.');
      if (constraint === 'posts_series_id_fkey')
        throw new AppError(409, '시리즈가 삭제되었습니다. 목록을 새로고침해 주세요.');
      throw error;
    }
  }
  async findDraft(id: string) {
    const result = await this.db.query<PostDraft>(
      `SELECT ${draftColumns} FROM post_drafts WHERE id=$1`,
      [id],
    );
    return serialize(result.rows[0] ?? null);
  }
  async listDrafts(actorId?: string) {
    const result = await this.db.query<DraftSummary>(
      `SELECT id,post_id AS "postId",updated_at AS "updatedAt",fields->>'title' AS title
       FROM post_drafts ${actorId ? 'WHERE owner_id=$1' : ''} ORDER BY updated_at DESC,id LIMIT 50`,
      actorId ? [actorId] : [],
    );
    return serialize(result.rows);
  }
  async saveDraft(input: PostDraftWrite, ownerId: string) {
    return transaction(this.db, async (connection) => {
      const fields = JSON.stringify(input.fields);
      if (input.version === null) {
        if (!input.postId) {
          const owner = await connection.query(
            'SELECT id FROM "user" WHERE id=$1 FOR NO KEY UPDATE',
            [ownerId],
          );
          if (!owner.rows.length) return null;
          const capacity = await connection.query<{ count: number }>(
            'SELECT count(*)::int AS count FROM post_drafts WHERE owner_id=$1 AND post_id IS NULL',
            [ownerId],
          );
          if (capacity.rows[0].count >= 50) {
            const current = await connection.query(
              'SELECT 1 FROM post_drafts WHERE id=$1 AND owner_id=$2',
              [input.id, ownerId],
            );
            if (!current.rows.length)
              throw new AppError(409, '새 글 초안은 50개까지 저장할 수 있습니다.');
          }
        }
        const created = await connection.query<PostDraft>(
          `INSERT INTO post_drafts(id,owner_id,post_id,base_version,fields)
           SELECT $1,$2,$3,$4,$5::jsonb WHERE $3::uuid IS NOT NULL OR NOT EXISTS (SELECT 1 FROM posts WHERE id=$1)
           ON CONFLICT (id) DO NOTHING RETURNING ${draftColumns}`,
          [input.id, ownerId, input.postId, input.baseVersion, fields],
        );
        if (created.rows[0]) return serialize(created.rows[0]);
      } else {
        const saved = await connection.query<PostDraft>(
          `UPDATE post_drafts SET fields=$3::jsonb,version=gen_random_uuid(),updated_at=now()
           WHERE id=$1 AND owner_id=$2 AND version=$4 RETURNING ${draftColumns}`,
          [input.id, ownerId, fields, input.version],
        );
        if (saved.rows[0]) return serialize(saved.rows[0]);
      }
      const identical = await connection.query<PostDraft>(
        `SELECT ${draftColumns} FROM post_drafts WHERE id=$1 AND owner_id=$2 AND fields=$3::jsonb
         AND post_id IS NOT DISTINCT FROM $4::uuid AND base_version IS NOT DISTINCT FROM $5::int`,
        [input.id, ownerId, fields, input.postId, input.baseVersion],
      );
      return serialize(identical.rows[0] ?? null);
    });
  }
  async deleteDraft(draft: PostDraft) {
    const result = await this.db.query(
      'DELETE FROM post_drafts WHERE id=$1 AND version=$2 RETURNING id',
      [draft.id, draft.version],
    );
    return Boolean(result.rows.length);
  }
  async applyDraft(
    draft: PostDraft,
    input: PreparedPost,
    actorId: string,
    postVersion: number | null,
  ) {
    return transaction(this.db, async (connection) => {
      if (draft.postId) {
        const post = await connection.query(
          'SELECT id FROM posts WHERE id=$1 AND edit_version=$2 AND NOT body_removed FOR UPDATE',
          [draft.postId, postVersion],
        );
        if (!post.rows.length)
          throw new AppError(
            409,
            '이 글이 변경되었습니다. 변경된 글을 먼저 확인해주세요.',
            'POST_BASE_CONFLICT',
          );
      }
      const consumed = await connection.query(
        'DELETE FROM post_drafts WHERE id=$1 AND version=$2 RETURNING id',
        [draft.id, draft.version],
      );
      if (!consumed.rows.length)
        throw new AppError(409, '다른 탭에서 초안이 변경되었습니다.', 'POST_DRAFT_CONFLICT');
      return this.writePost(connection, input, actorId, draft.postId ? undefined : draft.id);
    });
  }
  async unpublish(id: string, postVersion: number, actorId: string) {
    return transaction(this.db, async (connection) => {
      const unpublished = await connection.query(
        `UPDATE posts SET status='DRAFT',published_at=NULL,updated_at=now()
         WHERE id=$1 AND edit_version=$2 AND status='PUBLISHED' AND NOT body_removed RETURNING id`,
        [id, postVersion],
      );
      if (!unpublished.rows.length) return false;
      await audit(connection, actorId, 'post.unpublished', id);
      return true;
    });
  }
  async setWithdrawnVisibility(id: string, status: PostSummary['status'], actorId: string) {
    return transaction(this.db, async (connection) => {
      const result = await connection.query(
        `UPDATE posts SET status=$2, updated_at=now(),
          published_at=CASE WHEN $2='PUBLISHED' THEN coalesce(published_at,now()) ELSE NULL END
        WHERE id=$1 AND author_id IS NULL RETURNING id`,
        [id, status],
      );
      if (!result.rows.length) return false;
      await audit(connection, actorId, `post.withdrawn.${status.toLowerCase()}`, id);
      return true;
    });
  }
  async delete(id: string, actorId: string) {
    await transaction(this.db, async (connection) => {
      const deleted = await connection.query(
        'DELETE FROM posts WHERE id=$1 AND NOT body_removed RETURNING id',
        [id],
      );
      if (!deleted.rows.length)
        throw new AppError(409, '글 상태가 바뀌었습니다. 목록을 새로고침해 주세요.');
      await audit(connection, actorId, 'post.deleted', id);
    });
  }
  async comments(postId: string) {
    return serialize(
      (
        await this.db.query<Comment>(
          `${commentSelect} WHERE c.post_id=$1 ORDER BY c.created_at LIMIT 100`,
          [postId],
        )
      ).rows,
    );
  }
  async comment(id: string) {
    return serialize(
      (await this.db.query<Comment>(`${commentSelect} WHERE c.id::text=$1`, [id])).rows[0] ?? null,
    );
  }
  async addComment(postId: string, body: string, actorId: string) {
    const id = await transaction(this.db, async (connection) => {
      const result = await connection.query<{ id: string }>(
        'INSERT INTO comments(post_id,author_id,body) VALUES($1,$2,$3) RETURNING id',
        [postId, actorId, body],
      );
      await audit(connection, actorId, 'comment.created', result.rows[0].id);
      return result.rows[0].id;
    });
    return (await this.comment(id))!;
  }
  async deleteComment(id: string, actorId: string) {
    await transaction(this.db, async (connection) => {
      await connection.query('DELETE FROM comments WHERE id=$1', [id]);
      await audit(connection, actorId, 'comment.deleted', id);
    });
  }
}
