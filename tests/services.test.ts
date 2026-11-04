import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { EmbeddedPool } from '../apps/code-lily/src/infrastructure/database';
import { PostsService } from '../apps/code-lily/src/modules/posts/application/posts.service';
import { PostgresPostsRepository } from '../apps/code-lily/src/modules/posts/infrastructure/postgres-posts.repository';
import { AboutService } from '../apps/code-lily/src/modules/about/application/about.service';
import { PostgresAboutRepository } from '../apps/code-lily/src/modules/about/infrastructure/postgres-about.repository';
import { PostgresTelemetryRepository } from '../apps/code-lily/src/modules/telemetry/infrastructure/postgres-telemetry.repository';
import type { Actor } from '../apps/code-lily/src/modules/identity/domain/policy';
test('real PostgreSQL SQL: content, ownership, comments, About and telemetry', async () => {
  const engine = new PGlite();
  await engine.exec('CREATE SCHEMA blog_schema');
  await engine.exec(await readFile('apps/code-lily/migrations/001_initial.sql', 'utf8'));
  await engine.exec(await readFile('apps/code-lily/migrations/003_member_withdrawal.sql', 'utf8'));
  await engine.exec(await readFile('apps/code-lily/migrations/004_withdrawn_post_visibility.sql', 'utf8'));
  const db = new EmbeddedPool(engine);
  const owner: Actor = { id: 'owner', name: 'Owner', email: 'owner@local.invalid', role: 'OWNER' };
  const editor: Actor = {
    id: 'editor',
    name: 'Editor',
    email: 'editor@local.invalid',
    role: 'EDITOR',
  };
  const member: Actor = {
    id: 'member',
    name: 'Member',
    email: 'member@local.invalid',
    role: 'MEMBER',
  };
  try {
    for (const user of [owner, editor, member])
      await db.query('INSERT INTO "user"(id,name,email,role) VALUES($1,$2,$3,$4)', [
        user.id,
        user.name,
        user.email,
        user.role,
      ]);
    const posts = new PostsService(new PostgresPostsRepository(db));
    await assert.rejects(() => posts.saveCategory({ name: '금지', slug: 'forbidden' }, member), {
      status: 403,
    });
    const category = await posts.saveCategory({ name: 'React', slug: 'react' }, editor);
    const post = await posts.save(
      {
        title: '테스트 글',
        slug: 'test-post',
        source: '## 안전한 본문',
        format: 'MARKDOWN',
        excerpt: '',
        tags: ['react'],
        status: 'DRAFT',
        categoryId: category.id,
      },
      editor,
    );
    assert.equal((await posts.list({})).length, 0);
    await assert.rejects(() => posts.read(post.id), { status: 401 });
    await assert.rejects(
      () => posts.save({ ...post, id: post.id, title: '탈취' }, { ...editor, id: 'other' }),
      { status: 403 },
    );
    const published = await posts.save({ ...post, status: 'PUBLISHED' }, editor);
    assert.match(published.renderedHtml, /<h2>안전한 본문<\/h2>/);
    assert.equal((await posts.list({ category: 'react' })).length, 1);
    assert.equal((await posts.list({ q: "' OR 1=1 --" })).length, 0);
    const comment = await posts.addComment(post.id, '댓글입니다.', member);
    await assert.rejects(() => posts.deleteComment(comment.id, editor), { status: 403 });
    await posts.deleteComment(comment.id, member);
    assert.equal((await posts.comments(post.id)).length, 0);
    const about = new AboutService(new PostgresAboutRepository(db));
    const input = {
      kind: 'INTRO' as const,
      title: '소개',
      subtitle: '',
      source: '**소개 본문**',
      format: 'MARKDOWN' as const,
      items: [],
      sortOrder: 0,
      published: true,
    };
    await assert.rejects(() => about.save(input, editor), { status: 403 });
    await about.save(input, owner);
    assert.equal((await about.list()).length, 1);
    const telemetry = new PostgresTelemetryRepository(db);
    await telemetry.record('hash-of-browser', '/posts', 'PAGE_VIEW');
    await telemetry.record('hash-of-browser', '/posts', 'PAGE_VIEW');
    const stats = await telemetry.analytics(7);
    assert.equal(stats.pageViews, 1);
    assert.equal(stats.uniqueBrowsers, 1);
    assert.ok(stats.logs.length >= 4);
    await posts.deleteCategory(category.id, editor);
    assert.equal((await posts.read(post.id)).categoryId, null);
    await posts.delete(post.id, editor);
    assert.equal((await posts.list({})).length, 0);
  } finally {
    await db.end();
  }
});
