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
} from '../domain/models';

const commonColumns = `p.id,p.slug,p.title,p.excerpt,p.tags,p.status,p.body_removed AS "bodyRemoved",GREATEST(1,ceil(length(p.source)::numeric/700))::int AS "readMinutes",
  p.category_id AS "categoryId",c.name AS "categoryName",p.author_id AS "authorId",coalesce(u.name,'탈퇴한 회원') AS "authorName",
  p.created_at AS "createdAt",p.updated_at AS "updatedAt",p.published_at AS "publishedAt"`;
const postJoins =
  'FROM posts p LEFT JOIN "user" u ON u.id=p.author_id LEFT JOIN categories c ON c.id=p.category_id';
const postSelect = `SELECT ${commonColumns},p.source,p.format,p.rendered_html AS "renderedHtml" ${postJoins}`;
const postListSelect = `SELECT ${commonColumns} ${postJoins}`;
const categorySelect = `SELECT c.id,c.name,c.slug,c.owner_id AS "ownerId",count(p.id)::int AS count FROM categories c
  LEFT JOIN posts p ON p.category_id=c.id AND p.status='PUBLISHED'`;
const commentSelect = `SELECT c.id,c.post_id AS "postId",c.author_id AS "authorId",coalesce(u.name,'탈퇴한 회원') AS "authorName",c.body,c.created_at AS "createdAt"
  FROM comments c LEFT JOIN "user" u ON u.id=c.author_id`;
const serialize = <T>(value: T): T => JSON.parse(JSON.stringify(value));
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
  async find(idOrSlug: string) {
    return serialize(
      (
        await this.db.query<Post>(`${postSelect} WHERE p.id::text=$1 OR p.slug=$1 LIMIT 1`, [
          idOrSlug,
        ])
      ).rows[0] ?? null,
    );
  }
  async save(input: PostInput & { renderedHtml: string }, actorId: string) {
    const id = await transaction(this.db, async (connection) => {
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
      ];
      const result = input.id
        ? await connection.query<{ id: string }>(
            `UPDATE posts SET slug=$1,title=$2,excerpt=$3,source=$4,format=$5,rendered_html=$6,tags=$7,status=$8,category_id=$9,updated_at=now(),published_at=CASE WHEN $8='PUBLISHED' THEN coalesce(published_at,now()) ELSE NULL END WHERE id=$10 AND NOT body_removed RETURNING id`,
            [...values, input.id],
          )
        : await connection.query<{ id: string }>(
            `INSERT INTO posts(slug,title,excerpt,source,format,rendered_html,tags,status,category_id,author_id,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $8='PUBLISHED' THEN now() ELSE NULL END) RETURNING id`,
            [...values, actorId],
          );
      if (!result.rows[0])
        throw new AppError(409, '글 상태가 바뀌었습니다. 목록을 새로고침해 주세요.');
      const id = result.rows[0].id;
      await audit(connection, actorId, 'post.saved', id);
      return id;
    });
    return (await this.find(id))!;
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
