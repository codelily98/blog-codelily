import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsonBody } from '../apps/code-lily/src/presentation/http';

function streamedRequest(body: ReadableStream<Uint8Array>) {
  const options = { method: 'POST', body, duplex: 'half' } as const;
  return new Request('http://localhost/api/test', options);
}

test('JSON body size counts streamed bytes and cancels oversized requests', async () => {
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(300_000));
      controller.enqueue(new Uint8Array(300_001));
    },
    cancel() {
      canceled = true;
    },
  });
  await assert.rejects(() => jsonBody(streamedRequest(stream)), { status: 413 });
  assert.equal(canceled, true);
});

test('JSON body preserves UTF-8 text split across chunks', async () => {
  const bytes = new TextEncoder().encode('{"ok":"한글"}');
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.subarray(0, 8));
      controller.enqueue(bytes.subarray(8));
      controller.close();
    },
  });
  assert.deepEqual(await jsonBody(streamedRequest(stream)), { ok: '한글' });
});
