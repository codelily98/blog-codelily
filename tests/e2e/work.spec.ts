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

test('Work OWNER workflow, member visibility, autosave recovery, conflict and accessible mobile tree', async ({
  page,
  context,
  browser,
}) => {
  test.skip(
    process.env.CODELILY_AUTH_FIXTURE !== '1',
    'Requires isolated production fixture server.',
  );
  test.setTimeout(150000);
  const errors: string[] = [];
  const consoleMessages: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning')
      consoleMessages.push(message.text());
  });
  await authenticate(context, 'owner');
  await page.goto('/work');
  await expect(page).toHaveTitle(/Work/);
  await expect(page.locator('nextjs-portal')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '새 폴더', exact: true }).click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('Work E2E 프로젝트');
  await page.getByRole('button', { name: '적용', exact: true }).click();
  await expect(
    page.getByRole('treeitem', { name: 'Work E2E 프로젝트', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '새 문서', exact: true }).click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('Work E2E 원문');
  await page.getByRole('button', { name: '적용', exact: true }).click();
  await expect(page).toHaveURL(/\/work\/document\/[a-f0-9-]{36}$/);
  const id = page.url().split('/').pop()!;
  const documentUrl = `/api/work/documents/${id}`;
  const markdown = page
    .getByRole('textbox', { name: 'Work 본문 원본', exact: true })
    .filter({ visible: true });
  const source =
    '---\nstatus: 진행중\n---\n\n# Work 원문 검증\n\n- [x] 완료\n- [ ] 예정\n\n[[내부 링크]]\n\n| 항목 | 상태 |\n|---|---|\n| 업무 | 완료 |\n\n```ts\nconst value = 1;\n```\n\n<script>alert(1)</script>';
  await expect(markdown).toBeVisible();
  await expect(page.getByRole('button', { name: 'HTML 편집', exact: true })).toHaveCount(0);
  await markdown.fill(source);
  await expect(page.getByRole('status').filter({ hasText: '저장됨' })).toBeVisible();
  await expect
    .poll(async () => (await (await page.request.get(documentUrl)).json()).data.content)
    .toBe(source);
  await page.reload();
  await expect(markdown).toHaveValue(source);
  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Work 원문 검증', exact: true })).toBeVisible();
  await expect(page.locator('.content-body input[checked]')).toHaveCount(1);
  expect(await page.locator('.content-body').innerHTML()).not.toContain('<script');
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(consoleMessages).toEqual([]);
  const evidence = process.env.CODELILY_EVIDENCE_DIR;
  if (evidence)
    await page.screenshot({ path: path.join(evidence, 'work-desktop.png'), fullPage: true });

  await page.getByRole('button', { name: '공개 설정', exact: true }).click();
  await page.getByRole('button', { name: '적용', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const memberContext = await browser.newContext();
  await authenticate(memberContext, 'member');
  const member = await memberContext.newPage();
  expect((await member.request.get(documentUrl)).status()).toBe(404);
  await page
    .getByRole('treeitem', { name: 'Work E2E 프로젝트', exact: true })
    .locator(':scope > div')
    .click();
  await expect(page.getByRole('region', { name: 'Work 문서', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '공개 설정', exact: true }).click();
  await page.getByRole('button', { name: '적용', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await member.goto(`/work/document/${id}`);
  await expect(member.getByRole('heading', { name: 'Work 원문 검증', exact: true })).toBeVisible();
  await expect(member.getByRole('button', { name: '지금 저장', exact: true })).toHaveCount(0);
  const memberRead = await member.request.get(documentUrl);
  expect(memberRead.headers()['cache-control']).toContain('private, no-store');
  expect((await memberRead.json()).data.content).toBe('');
  const forbidden = await member.request.put(documentUrl, {
    headers: { origin: 'http://localhost:3000' },
    data: { content: 'forbidden', version: 1 },
  });
  expect(forbidden.status()).toBe(403);
  const anonymous = await browser.newContext();
  expect((await anonymous.request.get('/api/work/tree')).status()).toBe(401);
  await anonymous.close();
  await member.getByRole('textbox', { name: '문서·폴더 이름 검색', exact: true }).fill('원문');
  await member.getByRole('button', { name: '검색', exact: true }).click();
  await expect(member.getByText('검색 결과 1건 · 최대 50건')).toBeVisible();
  await memberContext.close();

  await page.goto(`/work/document/${id}`);
  await expect(markdown).toHaveValue(source);
  await page.route(`**${documentUrl}`, async (route) => {
    if (route.request().method() === 'PUT')
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: '일시적인 저장 장애' } }),
      });
    else await route.continue();
  });
  const failed = source + '\n\n저장 실패 후 보존';
  await markdown.fill(failed);
  await expect(page.getByText('일시적인 저장 장애', { exact: true })).toBeVisible();
  await expect(markdown).toHaveValue(failed);
  await page.unroute(`**${documentUrl}`);
  await page.getByRole('button', { name: '저장 다시 시도', exact: true }).click();
  await expect
    .poll(async () => (await (await page.request.get(documentUrl)).json()).data.content)
    .toBe(failed);

  const remote = (await (await page.request.get(documentUrl)).json()).data;
  await page.request.put(documentUrl, {
    headers: { origin: 'http://localhost:3000' },
    data: { content: '다른 창에서 저장한 원문', version: remote.version },
  });
  await markdown.fill(failed + '\n\n충돌한 로컬 원문');
  await expect(page.getByRole('button', { name: '충돌 내용 비교', exact: true })).toBeVisible();
  await expect(markdown).toHaveValue(failed + '\n\n충돌한 로컬 원문');
  await page.getByRole('button', { name: '충돌 내용 비교', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '서버 원문', exact: true })).toHaveValue(
    '다른 창에서 저장한 원문',
  );
  await page
    .getByRole('textbox', { name: '저장할 원문', exact: true })
    .fill(source + '\n\n병합 완료');
  await page.getByRole('button', { name: '병합한 내용 저장', exact: true }).click();
  await expect
    .poll(async () => (await (await page.request.get(documentUrl)).json()).data.content)
    .toBe(source + '\n\n병합 완료');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '폴더 탐색', exact: true }).click();
  await expect(
    page
      .getByRole('textbox', { name: '문서·폴더 이름 검색', exact: true })
      .filter({ visible: true }),
  ).toBeFocused();
  const folder = page
    .getByRole('treeitem', { name: 'Work E2E 프로젝트', exact: true })
    .filter({ visible: true });
  await folder.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('treeitem', { name: 'Work E2E 원문', exact: true }).filter({ visible: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '폴더 탐색', exact: true })).toBeFocused();
  expect(
    await page.evaluate(() => window.document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  if (evidence)
    await page.screenshot({ path: path.join(evidence, 'work-mobile.png'), fullPage: true });
  const mobileAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(mobileAudit.violations).toEqual([]);
  await page
    .getByRole('button', { name: '라이트 테마로 변경', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole('button', { name: '휴지통', exact: true })).toHaveCSS(
    'color',
    'rgb(103, 99, 93)',
  );
  const lightAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(lightAudit.violations).toEqual([]);

  await page.getByRole('button', { name: '이동', exact: true }).click();
  await page.getByLabel('대상 폴더', { exact: true }).selectOption('');
  await page.getByRole('button', { name: '적용', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page.getByRole('button', { name: '적용', exact: true }).click();
  await expect(page).toHaveURL(/\/work$/);
  await page.getByRole('button', { name: '휴지통', exact: true }).click();
  await page.getByRole('button', { name: 'Work E2E 원문 복구', exact: true }).click();
  await expect(page.getByText('휴지통이 비어 있습니다.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.goto(`/work/document/${id}`);
  await expect(markdown).toHaveValue(source + '\n\n병합 완료');
  await page.getByRole('button', { name: '오늘 업무일지', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /^\d{4}-\d{2}-\d{2}$/, exact: true }),
  ).toBeVisible();
  const journalUrl = page.url();
  await page.getByRole('button', { name: '오늘 업무일지', exact: true }).click();
  await expect(page).toHaveURL(journalUrl);
  expect(errors).toEqual([]);
});

test('Work preserves composition and unsaved input through document and browser navigation', async ({
  page,
  context,
}) => {
  test.skip(
    process.env.CODELILY_AUTH_FIXTURE !== '1',
    'Requires isolated production fixture server.',
  );
  await authenticate(context, 'owner');
  const origin = { origin: 'http://localhost:3000' };
  const ids: string[] = [];
  for (const name of ['Work 전환 A', 'Work 전환 B']) {
    const tree = (await (await page.request.get('/api/work/tree')).json()).data;
    const created = await page.request.post('/api/work/nodes', {
      headers: origin,
      data: { name, nodeType: 'DOCUMENT', parentId: null, treeVersion: tree.version },
    });
    expect(created.status()).toBe(200);
    ids.push((await created.json()).data.id);
  }
  const [first, second] = ids;
  await page.goto(`/work/document/${first}`);
  const markdown = page
    .getByRole('textbox', { name: 'Work 본문 원본', exact: true })
    .filter({ visible: true });
  await expect(markdown).toBeVisible();
  await markdown.dispatchEvent('compositionstart');
  await markdown.fill('한글 조합 원문');
  await page.keyboard.press('Control+s');
  expect((await (await page.request.get(`/api/work/documents/${first}`)).json()).data.version).toBe(
    1,
  );
  await markdown.dispatchEvent('compositionend');
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/work/documents/${first}`)).json()).data.content,
    )
    .toBe('한글 조합 원문');

  let releaseSave!: () => void;
  let started = false;
  const pending = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route(`**/api/work/documents/${first}`, async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }
    started = true;
    await pending;
    await route.continue();
  });
  await markdown.fill('이동 전에 저장할 원문');
  await page.getByRole('treeitem', { name: 'Work 전환 B', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/work/document/${first}$`));
  releaseSave();
  await expect(page).toHaveURL(new RegExp(`/work/document/${second}$`));
  await page.unroute(`**/api/work/documents/${first}`);
  expect((await (await page.request.get(`/api/work/documents/${first}`)).json()).data.content).toBe(
    '이동 전에 저장할 원문',
  );

  await expect(markdown).toHaveValue('');
  await page.route(`**/api/work/documents/${second}`, async (route) => {
    if (route.request().method() === 'PUT')
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: '전환 저장 장애' } }),
      });
    else await route.continue();
  });
  await markdown.fill('뒤로 가기에서도 보존할 원문');
  await page.evaluate(() => window.history.back());
  await expect(page.getByText('전환 저장 장애', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/work/document/${second}$`));
  await expect(markdown).toHaveValue('뒤로 가기에서도 보존할 원문');
  await page.unroute(`**/api/work/documents/${second}`);
  await page.getByRole('button', { name: '저장 다시 시도', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/work/documents/${second}`)).json()).data.content,
    )
    .toBe('뒤로 가기에서도 보존할 원문');
  await page.getByRole('treeitem', { name: 'Work 전환 A', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/work/document/${first}$`));
  await expect(markdown).toHaveValue('이동 전에 저장할 원문');
});
