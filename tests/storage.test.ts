import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesSignature } from '../packages/storage/src/index';
test('upload signature checks reject content-type spoofing', () => {
  assert.equal(matchesSignature(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'), true);
  assert.equal(matchesSignature(Buffer.from('<script>alert(1)</script>'), 'image/png'), false);
  assert.equal(matchesSignature(Buffer.from('%PDF-1.7'), 'application/pdf'), true);
  assert.equal(matchesSignature(Buffer.from('not-a-file'), 'image/svg+xml'), false);
});
