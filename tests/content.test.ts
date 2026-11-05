import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderContent, sanitizeContent } from '../packages/content/src/index';
test('HTML keeps safe formatting and removes executable content', () => {
  const html = sanitizeContent(
    '<h2>제목</h2><p style="text-align:center;color:#ff0000;position:fixed;background-image:url(javascript:alert(1))">서식</p><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">링크</a><img src="https://example.com/image.png" alt="설명" onerror="alert(1)"><iframe src="https://example.com"></iframe>',
  );
  assert.match(html, /<h2>제목<\/h2>/);
  assert.match(html, /text-align:center/);
  assert.match(html, /color:#ff0000/);
  assert.doesNotMatch(
    html,
    /<script|onclick|onerror|javascript:|iframe|position:fixed|background-image/i,
  );
});
test('GFM renders headings, tables, code and lists safely', async () => {
  const html = await renderContent(
    '## 제목\n\n| A | B |\n|---|---|\n|1|2|\n\n```ts\nconst a = 1;\n```\n\n- 항목\n\n<script>alert(1)</script>',
    'MARKDOWN',
  );
  assert.match(html, /<h2>제목<\/h2>/);
  assert.match(html, /<table>/);
  assert.match(html, /<pre><code class="language-ts">/);
  assert.match(html, /<li>항목<\/li>/);
  assert.doesNotMatch(html, /<script>/);
});
test('task list completion survives sanitization and Work can exclude remote images', async () => {
  const source = '- [ ] pending\n- [x] done\n\n![remote](https://example.com/private.png)';
  const normal = await renderContent(source, 'MARKDOWN');
  assert.equal((normal.match(/checked="checked"/g) ?? []).length, 1);
  assert.equal((normal.match(/disabled="disabled"/g) ?? []).length, 2);
  assert.match(normal, /aria-label="완료된 할 일"/);
  assert.match(normal, /aria-label="미완료 할 일"/);
  assert.match(normal, /<img/);
  const work = await renderContent(source, 'MARKDOWN', { allowImages: false });
  assert.doesNotMatch(work, /<img/);
  assert.match(work, /checked="checked"/);
});
