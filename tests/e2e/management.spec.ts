import { test, expect, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
async function authenticate(context: BrowserContext, role: string) {
  const sessions = JSON.parse(await readFile('.local/e2e-sessions.json', 'utf8'));
  await context.addCookies([
    {
      ...sessions[role],
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
  ]);
}
test('OWNER: category → Markdown Post → publish → member comment → About → charts/Grid → unpublish', async ({
  browser,
  page,
  context,
}) => {
  test.skip(
    process.env.CODELILY_AUTH_FIXTURE !== '1',
    'Requires isolated production fixture server.',
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await authenticate(context, 'owner');
  await page.goto('/manage/categories');
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('E2E 카테고리');
  await page.getByRole('textbox', { name: '주소', exact: true }).fill('e2e-category');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('카테고리를 저장했습니다.')).toBeVisible();
  await page.goto('/manage/posts/new');
  await page.getByRole('textbox', { name: '제목', exact: true }).fill('E2E Markdown 게시글');
  await page.getByRole('textbox', { name: '글 주소', exact: true }).fill('e2e-markdown-post');
  await page.getByLabel('카테고리', { exact: true }).selectOption({ label: 'E2E 카테고리' });
  await page.getByLabel('원본 형식', { exact: true }).selectOption('MARKDOWN');
  const markdown = page
    .getByRole('textbox', { name: '본문 편집 원본', exact: true })
    .filter({ visible: true });
  await expect(markdown).toBeVisible();
  await markdown.fill(
    '## 실제 Markdown 제목\n\n**굵은 본문**과 표를 확인합니다.\n\n| 항목 | 값 |\n|---|---|\n| 검증 | 통과 |',
  );
  const editorAudit = await new AxeBuilder({ page })
    .include('.editor-shell')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(editorAudit.violations).toEqual([]);
  await page.getByLabel('공개 상태', { exact: true }).selectOption('PUBLISHED');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('글을 저장했습니다.')).toBeVisible();
  await expect(page).toHaveURL(/\/manage\/posts\/[a-f0-9-]{36}$/);
  const manageUrl = page.url();
  await page.goto('/posts/e2e-markdown-post');
  await expect(
    page.getByRole('heading', { name: '실제 Markdown 제목', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.content-body table')).toBeVisible();
  const memberContext = await browser.newContext();
  await authenticate(memberContext, 'member');
  const member = await memberContext.newPage();
  await member.goto('/posts/e2e-markdown-post');
  await member
    .getByRole('textbox', { name: '댓글 내용', exact: true })
    .fill('Google 전용 세션 권한을 사용하는 테스트 댓글');
  await member.getByRole('button', { name: '댓글 등록', exact: true }).click();
  await expect(member.getByText('Google 전용 세션 권한을 사용하는 테스트 댓글')).toBeVisible();
  const denied = await member.request.post('/api/categories', {
    headers: { origin: 'http://localhost:3000' },
    data: { name: '권한 없음', slug: 'forbidden-category' },
  });
  expect(denied.status()).toBe(403);
  await memberContext.close();
  await page.goto('/manage/about');
  await page.getByRole('button', { name: '새 항목', exact: true }).click();
  await page.getByLabel('항목 유형', { exact: true }).selectOption('INTERESTS');
  await page.getByRole('textbox', { name: '제목', exact: true }).fill('E2E 관심사');
  await page.getByRole('button', { name: '세부 항목 추가', exact: true }).click();
  await page.getByRole('textbox', { name: '이름 / 직무', exact: true }).fill('접근성');
  const aboutSaved = page.waitForResponse(
    (response) => response.url().endsWith('/api/about') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '항목 저장', exact: true }).click();
  const aboutId = (await (await aboutSaved).json()).data.id;
  await expect(page.getByText('About 항목을 저장했습니다.')).toBeVisible();
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'E2E 관심사', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '방문 기록 설정' }).click();
  await page.getByRole('button', { name: '동의', exact: true }).click();
  await page.goto('/manage/analytics');
  await expect(
    page.getByRole('heading', { name: '통계 · 사용자 발자취 · 감사 로그', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tabulator Grid로 보기' }).first().click();
  await expect(page.locator('.tabulator')).toBeVisible();
  const gridAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(gridAudit.violations).toEqual([]);
  await page.getByRole('button', { name: '접근 가능한 표로 보기' }).first().click();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  if (process.env.CODELILY_EVIDENCE_DIR)
    await page.screenshot({
      path: path.join(process.env.CODELILY_EVIDENCE_DIR, 'code-lily-management.png'),
      fullPage: true,
    });
  await page.goto(manageUrl);
  await page.getByLabel('공개 상태', { exact: true }).selectOption('DRAFT');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('글을 저장했습니다.')).toBeVisible();
  await page.goto('/posts/e2e-markdown-post');
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다.' })).toBeVisible();
  const origin = { origin: 'http://localhost:3000' };
  await page.request.delete(`/api/posts/${manageUrl.split('/').pop()}`, { headers: origin });
  await page.request.delete('/api/about', { headers: origin, data: { id: aboutId } });
  const categories = (await (await page.request.get('/api/categories')).json()).data;
  await page.request.delete('/api/categories', {
    headers: origin,
    data: { id: categories.find((item: { slug: string }) => item.slug === 'e2e-category').id },
  });
  expect(errors).toEqual([]);
});
test('production ISR returns cache hits for public pages', async ({ request }) => {
  test.skip(process.env.CODELILY_AUTH_FIXTURE !== '1', 'Requires production fixture.');
  await request.get('/posts');
  const cached = await request.get('/posts');
  expect(cached.headers()['x-nextjs-cache']).toBe('HIT');
  expect(cached.headers()['cache-control']).toContain('s-maxage=300');
  const about = await request.get('/about');
  expect(about.headers()['cache-control']).toContain('s-maxage=300');
});

test('HTML source editing saves current code view and preserves safe styles', async ({
  page,
  context,
}) => {
  test.skip(process.env.CODELILY_AUTH_FIXTURE !== '1', 'Requires production fixture.');
  await authenticate(context, 'owner');
  const original = (await (await page.request.get('/api/posts/shared-component-boundaries')).json())
    .data;
  await page.goto(`/manage/posts/${original.id}`);
  await page.getByRole('button', { name: 'HTML 편집', exact: true }).click();
  const code = page
    .getByRole('textbox', { name: '본문 편집 원본', exact: true })
    .filter({ visible: true });
  await code.fill(
    '<h2>HTML 스타일 확인</h2><p style="text-align:center;font-weight:bold">서식 본문</p><script>alert(1)</script>',
  );
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('글을 저장했습니다.')).toBeVisible();
  await page.goto('/posts/shared-component-boundaries');
  await expect(page.getByRole('heading', { name: 'HTML 스타일 확인', exact: true })).toBeVisible();
  await expect(page.locator('.content-body p').filter({ hasText: '서식 본문' })).toHaveCSS(
    'text-align',
    'center',
  );
  expect(await page.locator('.content-body').innerHTML()).not.toContain('<script');
  const restored = await page.request.put(`/api/posts/${original.id}`, {
    headers: { origin: 'http://localhost:3000' },
    data: original,
  });
  expect(restored.status()).toBe(200);
});
