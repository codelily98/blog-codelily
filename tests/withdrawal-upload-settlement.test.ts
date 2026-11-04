import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { EmbeddedPool } from '../apps/code-lily/src/infrastructure/database';
import {
  eligibleForSettlement,
  verifyWithdrawalObjects,
  type UploadReview,
} from '../apps/code-lily/src/modules/uploads/application/withdrawal-upload-settlement';
import {
  reviewWithdrawalUpload,
  settleVerifiedWithdrawalUpload,
} from '../apps/code-lily/src/modules/uploads/infrastructure/withdrawal-upload-inspection';

const sharedId = '00000000-0000-0000-0000-000000000101';
const removedId = '00000000-0000-0000-0000-000000000102';
const privateId = '00000000-0000-0000-0000-000000000103';

test('withdrawal upload settlement requires provider evidence and preserves private IDs from CDN probes', async () => {
  const upload: UploadReview = {
    id: sharedId,
    bucketKind: 'PUBLIC',
    status: 'READY',
    expectedKey: true,
    putWindowElapsed: true,
    postReferences: 1,
    aboutReferences: 0,
    commentReferences: 0,
  };
  assert.equal(eligibleForSettlement(upload, 'retain-public'), true);
  assert.equal(eligibleForSettlement(upload, 'removed'), false);
  assert.equal(
    eligibleForSettlement({ ...upload, putWindowElapsed: false }, 'retain-public'),
    false,
  );
  assert.equal(eligibleForSettlement({ ...upload, bucketKind: 'PRIVATE' }, 'retain-public'), false);
  assert.equal(eligibleForSettlement({ ...upload, expectedKey: false }, 'retain-public'), false);

  const objects = { pending: false, privateCompleted: false, publicCompleted: true };
  let responseStatus = 200;
  let cdnChecks = 0;
  const storage = {
    async checkBuckets() {},
    async inspectWithdrawalObjects() {
      return { ...objects };
    },
    async publicObjectStatus() {
      cdnChecks++;
      return responseStatus;
    },
  };
  const signal = AbortSignal.timeout(1000);
  assert.equal(
    (await verifyWithdrawalObjects(storage, upload, 'retain-public', signal)).verified,
    true,
  );
  const removed = { ...upload, id: removedId, postReferences: 0 };
  assert.equal(
    (await verifyWithdrawalObjects(storage, removed, 'removed', signal)).verified,
    false,
  );
  assert.equal(cdnChecks, 1);
  objects.pending = true;
  assert.equal(
    (await verifyWithdrawalObjects(storage, upload, 'retain-public', signal)).verified,
    false,
  );
  objects.pending = false;
  objects.publicCompleted = false;
  assert.equal(
    (await verifyWithdrawalObjects(storage, removed, 'removed', signal)).verified,
    false,
  );
  responseStatus = 403;
  assert.equal(
    (await verifyWithdrawalObjects(storage, removed, 'removed', signal)).verified,
    false,
  );
  responseStatus = 404;
  assert.equal((await verifyWithdrawalObjects(storage, removed, 'removed', signal)).verified, true);
  const before = cdnChecks;
  const privateUpload = { ...removed, id: privateId, bucketKind: 'PRIVATE' as const };
  assert.equal(
    (await verifyWithdrawalObjects(storage, privateUpload, 'removed', signal)).verified,
    true,
  );
  assert.equal(cdnChecks, before);
  objects.publicCompleted = true;
  assert.equal(
    (await verifyWithdrawalObjects(storage, privateUpload, 'removed', signal)).verified,
    false,
  );
});

test('operator upload settlement rechecks references, changes only the exact member upload, and unblocks withdrawal', async () => {
  const engine = await PGlite.create();
  const db = new EmbeddedPool(engine);
  try {
    await engine.exec('CREATE SCHEMA blog_schema');
    for (const file of [
      '001_initial.sql',
      '003_member_withdrawal.sql',
      '004_withdrawn_post_visibility.sql',
      '005_withdrawal_upload_settlement.sql',
    ]) {
      await engine.exec(await readFile(`apps/code-lily/migrations/${file}`, 'utf8'));
    }
    await engine.exec(`
      CREATE ROLE code_lily_runtime;
      GRANT USAGE ON SCHEMA blog_schema TO code_lily_runtime;
      GRANT SELECT,UPDATE,DELETE ON ALL TABLES IN SCHEMA blog_schema TO code_lily_runtime;
      INSERT INTO "user"(id,name,email,role) VALUES
        ('editor','Editor','editor@example.invalid','EDITOR'),('owner','Owner','owner@example.invalid','OWNER');
      INSERT INTO uploads(id,owner_id,object_key,bucket_kind,content_type,expected_size,status,created_at) VALUES
        ('${sharedId}','editor','objects/${sharedId}','PUBLIC','image/png',1,'READY',now()-interval '1 day'),
        ('${removedId}','editor','objects/${removedId}','PUBLIC','image/png',1,'READY',now()-interval '1 day'),
        ('${privateId}','editor','objects/${privateId}','PRIVATE','image/png',1,'READY',now()-interval '1 day');
      INSERT INTO posts(title,slug,source,format,rendered_html,status,author_id) VALUES
        ('Shared image','shared','https://media.example.invalid/objects/${sharedId}','HTML','','PUBLISHED','owner');
    `);
    const withdraw = () =>
      engine.query<{ result: { status: string } }>(
        "SELECT withdraw_member('editor','delete',true) AS result",
      );
    assert.equal((await withdraw()).rows[0].result.status, 'blocked');
    const shared = (await reviewWithdrawalUpload(db, 'editor', 'delete', sharedId))!;
    const removed = (await reviewWithdrawalUpload(db, 'editor', 'delete', removedId))!;
    const privateUpload = (await reviewWithdrawalUpload(db, 'editor', 'delete', privateId))!;
    assert.equal(await reviewWithdrawalUpload(db, 'owner', 'delete', sharedId), null);
    await engine.exec('SET ROLE code_lily_runtime');
    await assert.rejects(
      settleVerifiedWithdrawalUpload(db, 'editor', 'delete', shared, 'retain-public'),
      /table owner/,
    );
    await engine.exec('RESET ROLE');
    const snapshot = await engine.dumpDataDir();

    await engine.query('UPDATE posts SET source=source || $1 WHERE slug=$2', [removedId, 'shared']);
    assert.equal(
      await settleVerifiedWithdrawalUpload(db, 'editor', 'delete', removed, 'removed'),
      'changed',
    );
    await engine.query('UPDATE posts SET source=$1 WHERE slug=$2', [sharedId, 'shared']);
    assert.equal(
      await settleVerifiedWithdrawalUpload(db, 'editor', 'delete', shared, 'removed'),
      'changed',
    );
    assert.equal(
      await settleVerifiedWithdrawalUpload(db, 'editor', 'delete', privateUpload, 'retain-public'),
      'changed',
    );
    await assert.rejects(
      engine.query('UPDATE uploads SET owner_id=NULL WHERE id=$1', [privateId]),
      { code: '23514' },
    );
    assert.equal(
      await settleVerifiedWithdrawalUpload(db, 'editor', 'delete', shared, 'retain-public'),
      'applied',
    );
    assert.equal(
      await settleVerifiedWithdrawalUpload(db, 'editor', 'delete', shared, 'retain-public'),
      'missing',
    );
    assert.equal(
      await settleVerifiedWithdrawalUpload(db, 'editor', 'delete', removed, 'removed'),
      'applied',
    );
    assert.equal(
      await settleVerifiedWithdrawalUpload(db, 'editor', 'delete', privateUpload, 'removed'),
      'applied',
    );
    assert.equal((await withdraw()).rows[0].result.status, 'applied');
    assert.deepEqual((await engine.query('SELECT id,owner_id,status FROM uploads')).rows, [
      { id: sharedId, owner_id: null, status: 'READY' },
    ]);
    assert.equal((await engine.query('SELECT source FROM posts')).rows.length, 1);

    const restored = await PGlite.create({ loadDataDir: snapshot });
    const restoredDb = new EmbeddedPool(restored);
    try {
      await restored.exec('SET search_path TO blog_schema, pg_catalog');
      const restorePlan = [
        [sharedId, 'retain-public'],
        [removedId, 'removed'],
        [privateId, 'removed'],
      ] as const;
      for (const [id, disposition] of restorePlan) {
        const review = (await reviewWithdrawalUpload(restoredDb, 'editor', 'delete', id))!;
        assert.equal(
          await settleVerifiedWithdrawalUpload(restoredDb, 'editor', 'delete', review, disposition),
          'applied',
        );
      }
      const { rows } = await restored.query<{ result: { status: string } }>(
        "SELECT withdraw_member('editor','delete',true) AS result",
      );
      assert.equal(rows[0].result.status, 'applied');
      assert.deepEqual((await restored.query('SELECT id,owner_id FROM uploads')).rows, [
        { id: sharedId, owner_id: null },
      ]);
    } finally {
      await restoredDb.end();
    }
  } finally {
    await db.end();
  }
});
