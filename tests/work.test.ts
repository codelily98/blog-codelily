import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { EmbeddedPool } from '../apps/code-lily/src/infrastructure/database';
import { PostgresWorkRepository } from '../apps/code-lily/src/modules/work/infrastructure/postgres-work.repository';
import { WorkService } from '../apps/code-lily/src/modules/work/application/work.service';
import type { Actor } from '../apps/code-lily/src/modules/identity/domain/policy';
import type { WorkChangeFields } from '../apps/code-lily/src/modules/work/domain/models';
import { workCreate, workSave } from '../apps/code-lily/src/modules/work/presentation/schemas';

test('Work SQL contracts: visibility, optimistic saves, tree races, trash and journals', async (t) => {
  const engine = await PGlite.create();
  await engine.exec('CREATE SCHEMA blog_schema');
  for (const file of ['001_initial.sql', '006_work.sql'])
    await engine.exec(await readFile(`apps/code-lily/migrations/${file}`, 'utf8'));
  const db = new EmbeddedPool(engine);
  const repository = new PostgresWorkRepository(db);
  const work = new WorkService(repository);
  const admin: Actor = {
    id: 'owner',
    name: 'Owner',
    email: 'owner@fixture.invalid',
    role: 'OWNER',
  };
  const member: Actor = {
    id: 'member',
    name: 'Member',
    email: 'member@fixture.invalid',
    role: 'MEMBER',
  };
  const editor = { ...member, role: 'EDITOR' as const };
  const create = async (
    name: string,
    parentId: string | null = null,
    nodeType: 'FOLDER' | 'DOCUMENT' = 'FOLDER',
  ) =>
    work.create({ name, parentId, nodeType, treeVersion: (await work.tree(admin)).version }, admin);
  const change = async (id: string, input: WorkChangeFields) =>
    work.change(id, { ...input, treeVersion: (await work.tree(admin)).version }, admin);
  try {
    await db.query('INSERT INTO "user"(id,name,email,role) VALUES($1,$2,$3,$4)', [
      admin.id,
      admin.name,
      admin.email,
      admin.role,
    ]);
    const project = await create('프로젝트');
    const doc = await create('원문 문서', project.id, 'DOCUMENT');
    const raw =
      '---\nstatus: 진행중\n---\n\n# 제목\n\n- [x] 완료\n- [ ] 예정\n\n[[내부 링크]]\n\n```ts\nconst x = 1;\n```\n\n<script>alert(1)</script>';
    await t.test(
      'anonymous denied and only OWNER writes; ancestors gate member reads and search',
      async () => {
        assert.throws(() => work.tree(null), { status: 401 });
        for (const actor of [member, editor]) {
          assert.throws(
            () =>
              work.create(
                { name: 'forbidden', parentId: null, nodeType: 'FOLDER', treeVersion: 1 },
                actor,
              ),
            { status: 403 },
          );
          assert.throws(() => work.trash(actor), { status: 403 });
          assert.throws(() => work.preview('secret', actor), { status: 403 });
        }
        await change(doc.id, { action: 'visibility', isPublic: true });
        assert.equal((await work.tree(member)).nodes.length, 0);
        await assert.rejects(() => work.read(doc.id, member), { status: 404 });
        assert.deepEqual(await work.search('원문', member), []);
        await change(project.id, { action: 'visibility', isPublic: true });
        assert.equal((await work.tree(member)).nodes.length, 2);
        assert.equal((await work.search('원문', member)).length, 1);
      },
    );
    await t.test(
      'atomic document version checks preserve source and reject lost updates',
      async () => {
        const outcomes = await Promise.allSettled([
          work.save(doc.id, raw, 1, admin),
          work.save(doc.id, 'lost update', 1, admin),
        ]);
        assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
        assert.equal(
          (outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult)
            .reason.status,
          409,
        );
        const stored = await work.read(doc.id, admin);
        assert.equal(stored.content, raw);
        assert.equal(stored.version, 2);
        assert.match(stored.renderedHtml, /checked="checked"/);
        assert.doesNotMatch(stored.renderedHtml, /<script/);
        assert.equal((await work.read(doc.id, member)).content, '');
      },
    );
    await t.test(
      'tree revisions reject concurrent move races and cycles; document cannot be parent',
      async () => {
        const a = await create('A');
        const b = await create('B');
        const revision = (await work.tree(admin)).version;
        const moves = await Promise.allSettled([
          work.change(
            a.id,
            { action: 'move', parentId: b.id, sortOrder: 0, treeVersion: revision },
            admin,
          ),
          work.change(
            b.id,
            { action: 'move', parentId: a.id, sortOrder: 0, treeVersion: revision },
            admin,
          ),
        ]);
        assert.equal(moves.filter((move) => move.status === 'fulfilled').length, 1);
        await assert.rejects(() => change(b.id, { action: 'move', parentId: a.id, sortOrder: 0 }), {
          status: 400,
        });
        await assert.rejects(() => create('invalid', doc.id), { status: 400 });
        await assert.rejects(() => change(a.id, { action: 'move', parentId: a.id, sortOrder: 0 }), {
          status: 400,
        });
        let parent = null;
        for (let depth = 1; depth <= 7; depth++)
          parent = (await create(`depth-${depth}`, parent)).id;
        await assert.rejects(() => create('too deep', parent), { status: 400 });
      },
    );
    await t.test(
      'folder trash preserves separately deleted children; restoration stays private',
      async () => {
        const independent = await create('별도 삭제', project.id, 'DOCUMENT');
        await change(independent.id, { action: 'delete' });
        await change(project.id, { action: 'delete' });
        await assert.rejects(() => work.save(doc.id, 'after deletion', 2, admin), { status: 404 });
        await assert.rejects(() => work.read(doc.id, member), { status: 404 });
        await change(project.id, { action: 'restore' });
        await assert.rejects(() => work.save(doc.id, 'stale tab after restoration', 2, admin), {
          status: 409,
        });
        assert.equal((await work.tree(member)).nodes.length, 0);
        assert.ok((await work.trash(admin)).nodes.some((node) => node.id === independent.id));
        assert.equal((await work.read(doc.id, admin)).content, raw);
        const conflictFolder = await create('복구 이름');
        await change(conflictFolder.id, { action: 'delete' });
        await create('복구 이름');
        await change(conflictFolder.id, { action: 'restore' });
        assert.equal(
          (await work.tree(admin)).nodes.find((node) => node.id === conflictFolder.id)?.name,
          '복구 이름 (복구 1)',
        );
        await change(project.id, { action: 'delete' });
        await change(independent.id, { action: 'restore' });
        assert.equal(
          (await work.tree(admin)).nodes.find((node) => node.id === independent.id)?.parentId,
          null,
        );
      },
    );
    await t.test('daily journal is idempotent across retries, rename and move', async () => {
      const first = await work.today(admin);
      const second = await work.today(admin);
      assert.equal(first.id, second.id);
      await change(first.id, { action: 'rename', name: '이름을 바꾼 일지' });
      await change(first.id, { action: 'move', parentId: null, sortOrder: 0 });
      assert.equal((await work.today(admin)).id, first.id);
      await change(first.id, { action: 'delete' });
      await assert.rejects(() => work.today(admin), { status: 409 });
      await change(first.id, { action: 'restore' });
      assert.equal((await work.today(admin)).id, first.id);
    });
    await t.test('expiry function restricts role access and keeps fresh trash', async () => {
      const expired = await create('보존 만료', null, 'DOCUMENT');
      await change(expired.id, { action: 'delete' });
      await db.query("UPDATE work_node SET deleted_at=now()-interval '31 days' WHERE id=$1", [
        expired.id,
      ]);
      await assert.rejects(() => change(expired.id, { action: 'restore' }), { status: 409 });
      await db.query(
        'CREATE ROLE work_runtime; CREATE ROLE work_maintenance; GRANT USAGE ON SCHEMA blog_schema TO work_runtime,work_maintenance; GRANT EXECUTE ON FUNCTION blog_schema.prune_work_trash() TO work_maintenance;',
      );
      await db.query('SET ROLE work_runtime');
      await assert.rejects(() => db.query('SELECT blog_schema.prune_work_trash()'), {
        code: '42501',
      });
      await db.query('RESET ROLE; SET ROLE work_maintenance');
      await assert.rejects(() => db.query('SELECT content FROM work_document'), { code: '42501' });
      const result = await db.query<{ count: number }>(
        'SELECT blog_schema.prune_work_trash() AS count',
      );
      assert.equal(result.rows[0].count, 1);
      await db.query('RESET ROLE');
      assert.ok(
        !(await db.query('SELECT id FROM work_node WHERE id=$1', [expired.id])).rows.length,
      );
    });
    await t.test('DTOs bound names, contents and reject privilege injection', () => {
      assert.equal(
        workCreate.safeParse({ name: '../bad', parentId: null, nodeType: 'FOLDER', treeVersion: 1 })
          .success,
        false,
      );
      assert.equal(
        workCreate.safeParse({
          name: 'safe',
          parentId: null,
          nodeType: 'FOLDER',
          treeVersion: 1,
          isPublic: true,
        }).success,
        false,
      );
      assert.equal(workSave.safeParse({ content: 'x'.repeat(100001), version: 1 }).success, false);
    });
  } finally {
    await db.end();
  }
});
