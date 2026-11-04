import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { EmbeddedPool } from '../apps/code-lily/src/infrastructure/database';
import { PostsService } from '../apps/code-lily/src/modules/posts/application/posts.service';
import { PostgresPostsRepository } from '../apps/code-lily/src/modules/posts/infrastructure/postgres-posts.repository';
import { inspectWithdrawalUploads } from '../apps/code-lily/src/modules/uploads/infrastructure/withdrawal-upload-inspection';

const remove = (db: PGlite, id: string, choice: 'keep' | 'delete', apply = false) =>
  db
    .query<{ result: Record<string, unknown> }>(
      'SELECT blog_schema.withdraw_member($1, $2, $3) AS result',
      [id, choice, apply],
    )
    .then(({ rows }) => rows[0].result);

test('withdrawal protects related data, detaches retained content and replays after restore', async () => {
  const db = await PGlite.create();
  try {
    await db.exec('CREATE SCHEMA blog_schema');
    for (const file of ['001_initial.sql', '003_member_withdrawal.sql']) {
      await db.exec(await readFile(`apps/code-lily/migrations/${file}`, 'utf8'));
    }
    await db.exec(`
      CREATE ROLE code_lily_runtime;
      GRANT USAGE ON SCHEMA blog_schema TO code_lily_runtime;
      INSERT INTO "user" (id, name, email, role) VALUES
        ('keep', 'Keep Fixture', 'keep@example.invalid', 'EDITOR'),
        ('delete', 'Delete Fixture', 'delete@example.invalid', 'EDITOR'),
        ('owner', 'Owner Fixture', 'owner@example.invalid', 'OWNER');
      INSERT INTO session (id, "expiresAt", token, "userId")
        SELECT id, now() + interval '1 day', 'token-' || id, id FROM "user";
      INSERT INTO account (id, "accountId", "providerId", "userId")
        SELECT id, 'account-' || id, 'google', id FROM "user";
      INSERT INTO categories (name, slug, owner_id) VALUES
        ('Shared category', 'shared', 'delete'), ('Unused category', 'unused', 'delete');
      INSERT INTO posts (title, slug, source, format, rendered_html, excerpt, status, author_id, category_id)
        SELECT 'Fixture', slug, 'Content', 'HTML', '<p>Content</p>', 'Excerpt', status, author_id,
          (SELECT id FROM categories WHERE slug = 'shared')
        FROM (VALUES ('keep-public', 'PUBLISHED', 'keep'), ('keep-draft', 'DRAFT', 'keep'),
          ('delete-public', 'PUBLISHED', 'delete'), ('delete-empty', 'PUBLISHED', 'delete'),
          ('delete-draft', 'DRAFT', 'delete'), ('owner-public', 'PUBLISHED', 'owner'))
          AS fixture(slug, status, author_id);
      INSERT INTO comments (post_id, author_id, body)
        SELECT p.id, c.author_id, c.body FROM posts p JOIN (VALUES
          ('keep-public', 'keep', 'retained'), ('keep-draft', 'keep', 'private'),
          ('owner-public', 'delete', 'removed'), ('delete-public', 'owner', 'protected'),
          ('delete-public', 'delete', 'removed from discussion'), ('delete-draft', 'owner', 'private reply'),
          ('keep-public', 'owner', 'other author')
        ) AS c(slug, author_id, body) ON c.slug = p.slug;
      INSERT INTO uploads (owner_id, object_key, bucket_kind, content_type, expected_size, status)
        VALUES ('keep', 'pending-fixture', 'PRIVATE', 'image/png', 1, 'PENDING');
      INSERT INTO audit_logs (actor_id, action, entity_id)
        VALUES ('owner', 'member.role.editor', 'keep'), ('keep', 'post.saved', 'fixture');
    `);
    assert.equal((await remove(db, 'delete', 'delete')).status, 'blocked');
    await db.exec(
      await readFile('apps/code-lily/migrations/004_withdrawn_post_visibility.sql', 'utf8'),
    );
    assert.deepEqual((await db.query('SELECT DISTINCT body_removed FROM posts')).rows, [
      { body_removed: false },
    ]);
    await db.exec('SET ROLE code_lily_runtime');
    await assert.rejects(remove(db, 'keep', 'keep', true), { code: '42501' });
    await db.exec('RESET ROLE');
    assert.equal((await remove(db, 'owner', 'delete', true)).reason, 'owner_account');
    const uploadBlocked = await remove(db, 'keep', 'keep', true);
    assert.equal(uploadBlocked.status, 'blocked');
    assert.equal(uploadBlocked.uploads, 1);
    const commentsReview = await remove(db, 'delete', 'delete');
    assert.equal(commentsReview.status, 'preview');
    assert.equal(commentsReview.dependentComments, 2);
    assert.equal(commentsReview.discussionPosts, 2);
    assert.deepEqual((await db.query('SELECT count(*)::int AS count FROM session')).rows, [
      { count: 3 },
    ]);
    assert.deepEqual((await db.query('SELECT count(*)::int AS count FROM posts')).rows, [
      { count: 6 },
    ]);

    // The fixture models an upload already resolved before account withdrawal.
    await db.exec("DELETE FROM uploads WHERE owner_id = 'keep'");
    assert.equal((await remove(db, 'keep', 'keep')).status, 'preview');
    assert.equal((await remove(db, 'delete', 'delete')).status, 'preview');
    const snapshot = await db.dumpDataDir();

    async function applyAndVerify(database: PGlite) {
      assert.equal((await remove(database, 'keep', 'keep', true)).status, 'applied');
      assert.equal((await remove(database, 'delete', 'delete', true)).status, 'applied');
      assert.equal((await remove(database, 'keep', 'keep', true)).status, 'missing');
      for (const table of ['"user"', 'session', 'account']) {
        assert.deepEqual((await database.query(`SELECT id FROM blog_schema.${table}`)).rows, [
          { id: 'owner' },
        ]);
      }
      const posts = new PostsService(new PostgresPostsRepository(new EmbeddedPool(database)));
      const retained = await posts.read('keep-public');
      assert.equal(retained.authorId, null);
      assert.equal(retained.authorName, '탈퇴한 회원');
      assert.equal(retained.categoryName, 'Shared category');
      assert.equal((await posts.list({})).length, 3);
      assert.deepEqual(
        (await posts.categories()).map(({ slug, ownerId }) => ({ slug, ownerId })),
        [{ slug: 'shared', ownerId: null }],
      );
      const comments = await posts.comments(retained.id);
      assert.deepEqual(comments.find((comment) => comment.body === 'retained')?.authorId, null);
      assert.equal(
        comments.find((comment) => comment.body === 'retained')?.authorName,
        '탈퇴한 회원',
      );
      assert.equal(comments.find((comment) => comment.body === 'other author')?.authorId, 'owner');
      assert.equal((await posts.comments((await posts.read('owner-public')).id)).length, 0);
      await assert.rejects(posts.read('keep-draft'), { status: 404 });
      await assert.rejects(posts.read('delete-empty'), { status: 404 });
      await assert.rejects(posts.read('delete-draft'), { status: 401 });
      const discussion = await posts.read('delete-public');
      assert.equal(discussion.bodyRemoved, true);
      assert.equal(discussion.source, '');
      assert.equal(discussion.renderedHtml, '');
      assert.equal(discussion.excerpt, '');
      assert.equal(discussion.authorId, null);
      assert.deepEqual(
        (await posts.comments(discussion.id)).map((comment) => comment.body),
        ['protected'],
      );
      await assert.rejects(
        posts.delete(retained.id, {
          id: 'returning-editor',
          name: 'Returning',
          email: 'keep@example.invalid',
          role: 'EDITOR',
        }),
        { status: 403 },
      );
      assert.deepEqual(
        (
          await database.query(`
        SELECT actor_id, entity_id FROM audit_logs ORDER BY action
      `)
        ).rows,
        [
          { actor_id: 'owner', entity_id: 'withdrawn' },
          { actor_id: null, entity_id: 'fixture' },
        ],
      );
      const admin = {
        id: 'owner',
        name: 'Owner Fixture',
        email: 'owner@example.invalid',
        role: 'OWNER',
      } as const;
      const editor = { ...admin, id: 'another-editor', role: 'EDITOR' } as const;
      assert.equal((await posts.withdrawn(admin, 1)).length, 3);
      assert.throws(() => posts.withdrawn(editor, 1), { status: 403 });
      await assert.rejects(posts.setWithdrawnVisibility(discussion.id, 'DRAFT', editor), {
        status: 403,
      });
      await assert.rejects(posts.delete(discussion.id, admin), { status: 409 });
      await assert.rejects(posts.save({ ...discussion, source: '복원 시도' }, admin), {
        status: 409,
      });
      await assert.rejects(
        posts.setWithdrawnVisibility((await posts.read('owner-public')).id, 'DRAFT', admin),
        { status: 404 },
      );
      await posts.setWithdrawnVisibility(discussion.id, 'DRAFT', admin);
      await assert.rejects(posts.read('delete-public'), { status: 401 });
      await posts.setWithdrawnVisibility(discussion.id, 'PUBLISHED', admin);
      assert.equal((await posts.read('delete-public')).bodyRemoved, true);
      assert.equal((await posts.comments(discussion.id))[0].body, 'protected');
    }

    await applyAndVerify(db);
    const restored = await PGlite.create({ loadDataDir: snapshot });
    try {
      await restored.exec('SET search_path TO blog_schema, pg_catalog');
      assert.equal((await remove(restored, 'keep', 'keep')).status, 'preview');
      await applyAndVerify(restored);
    } finally {
      await restored.close();
    }
  } finally {
    await db.close();
  }
});

test('upload review counts surviving references without returning content or changing rows', async () => {
  const db = await PGlite.create();
  try {
    await db.exec('CREATE SCHEMA blog_schema');
    await db.exec(await readFile('apps/code-lily/migrations/001_initial.sql', 'utf8'));
    const id = '00000000-0000-0000-0000-00000000000a';
    await db.exec(`
      INSERT INTO "user" (id, name, email, role) VALUES
        ('editor', 'Editor Fixture', 'editor@example.invalid', 'EDITOR'),
        ('owner', 'Owner Fixture', 'owner@example.invalid', 'OWNER');
      INSERT INTO uploads(id, owner_id, object_key, bucket_kind, content_type, expected_size, status)
        VALUES ('${id}', 'editor', 'objects/${id}', 'PUBLIC', 'image/png', 1, 'READY');
      INSERT INTO posts(title, slug, source, format, rendered_html, status, author_id) VALUES
        ('Withdraw', 'withdraw', 'https://media.example.invalid/objects/${id}', 'HTML', '', 'PUBLISHED', 'editor'),
        ('Shared', 'shared', '${id.toUpperCase().replaceAll('-', '%2D')}', 'MARKDOWN', '', 'DRAFT', 'owner');
      INSERT INTO about_sections(kind, title, source, format, rendered_html, items, published)
        VALUES ('CONTACT', 'About', '', 'HTML', '', '[{"url":"https://media.example.invalid/objects/${id}"}]', false);
      INSERT INTO comments(post_id, author_id, body)
        SELECT p.id, 'owner', '${id}' FROM posts p WHERE p.slug='withdraw';
    `);
    const pool = new EmbeddedPool(db);
    const keep = await inspectWithdrawalUploads(pool, 'editor', 'keep', null);
    assert.deepEqual(keep, {
      status: 'review',
      next: null,
      uploads: [
        {
          id,
          bucketKind: 'PUBLIC',
          status: 'READY',
          expectedKey: true,
          putWindowElapsed: false,
          postReferences: 2,
          aboutReferences: 1,
          commentReferences: 1,
        },
      ],
    });
    const remove = await inspectWithdrawalUploads(pool, 'editor', 'delete', null);
    assert.equal(remove.uploads[0].postReferences, 1);
    assert.equal(remove.uploads[0].commentReferences, 1);
    assert.equal((await inspectWithdrawalUploads(pool, 'editor', 'keep', id)).uploads.length, 0);
    assert.equal(
      (await inspectWithdrawalUploads(pool, 'owner', 'keep', null)).status,
      'owner_account',
    );
    assert.equal((await inspectWithdrawalUploads(pool, 'missing', 'keep', null)).status, 'missing');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM uploads')).rows[0].count, 1);
  } finally {
    await db.close();
  }
});
