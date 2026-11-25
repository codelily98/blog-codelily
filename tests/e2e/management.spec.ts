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

test('공개 상세의 관련 글은 연관도순으로 표시되고 공개 해제를 반영한다', async ({
  browser,
  context,
  page,
  baseURL,
}) => {
  test.skip(process.env.CODELILY_AUTH_FIXTURE !== '1', 'Requires isolated fixture sessions.');
  await authenticate(context, 'owner');
  const headers = { origin: 'http://localhost:3000' };
  const category = await context.request.post('/api/categories', {
    headers,
    data: { name: '관련 글 검증 분류', slug: 'related-posts-fixture' },
  });
  expect(category.ok()).toBe(true);
  const categoryId: string = (await category.json()).data.id;
  const ids: string[] = [];
  const firstTag = '관련검증하나';
  const secondTag = '관련검증둘';
  const readerContext = await browser.newContext({ baseURL });
  const reader = await readerContext.newPage();
  const errors: string[] = [];
  reader.on('pageerror', (error) => errors.push(error.message));
  reader.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  const related = reader.getByRole('region', { name: '관련 글', exact: true });

  async function savePost(
    suffix: string,
    title: string,
    tags: string[],
    categoryId: string | null,
    status: 'DRAFT' | 'PUBLISHED' = 'PUBLISHED',
  ) {
    const data = {
      slug: `related-posts-${suffix}`,
      title,
      tags,
      categoryId,
      status,
      excerpt: '관련 글 동작 검증에 사용할 요약입니다.',
      source: '관련 글 검증에 사용할 본문입니다.',
      format: 'MARKDOWN',
    };
    const saved = await context.request.post('/api/posts', { headers, data });
    expect(saved.ok()).toBe(true);
    const id: string = (await saved.json()).data.id;
    ids.push(id);
    return { id, data, url: `/posts/${data.slug}` };
  }

  try {
    const current = await savePost(
      'current',
      '관련 글 기준 글',
      [firstTag, secondTag, secondTag],
      categoryId,
    );
    const strong = await savePost('strong', '태그가 두 개 겹치는 글', [firstTag, secondTag], null);
    const older = await savePost('older', '태그가 겹치는 이전 글', [firstTag], null);
    const sameCategory = await savePost(
      'category',
      '태그와 분류가 같은 글',
      [firstTag],
      categoryId,
    );
    const newer = await savePost('newer', '태그가 겹치는 최신 글', [secondTag, secondTag], null);
    await savePost('draft', '비공개 관련 글', [firstTag, secondTag], categoryId, 'DRAFT');
    const categoryOnly = await savePost('category-only', '분류만 같은 글', [], categoryId);
    const unrelated = await savePost('unrelated', '관련 글이 없는 글', [], null);

    for (const [width, height] of [
      [1440, 1100],
      [390, 844],
    ]) {
      await reader.setViewportSize({ width, height });
      expect((await reader.goto(current.url))?.status()).toBe(200);
      await expect(reader).toHaveTitle(/관련 글 기준 글/);
      await expect(reader.getByRole('heading', { level: 1 })).toHaveText(current.data.title);
      await expect(reader.locator('nextjs-portal')).toHaveCount(0);
      if (width === 390) await reader.getByRole('button', { name: '라이트 테마로 변경' }).click();
      await expect(related.getByRole('link')).toHaveText([
        strong.data.title,
        sameCategory.data.title,
        newer.data.title,
      ]);
      const audit = await new AxeBuilder({ page: reader })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
      expect(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (process.env.CODELILY_EVIDENCE_DIR)
        await related.screenshot({
          path: path.join(process.env.CODELILY_EVIDENCE_DIR, `post-related-${width}.png`),
        });
      const link = related.getByRole('link', { name: strong.data.title, exact: true });
      await link.focus();
      await expect(link).toBeFocused();
      await link.press('Enter');
      await expect(reader).toHaveURL(new RegExp(`${strong.url}$`));
      await expect(reader.getByRole('heading', { level: 1 })).toHaveText(strong.data.title);
    }

    await reader.goto(categoryOnly.url);
    await expect(related.getByRole('link')).toHaveText([
      sameCategory.data.title,
      current.data.title,
    ]);
    await reader.goto(unrelated.url);
    await expect(related).toHaveCount(0);
    await page.goto(`/manage/posts/${current.id}`);
    await page.getByRole('button', { name: '발행 화면 미리보기' }).click();
    const preview = page.getByRole('dialog', { name: '발행 화면 미리보기' });
    await expect(preview.getByRole('heading', { name: current.data.title })).toBeVisible();
    await expect(preview.getByRole('region', { name: '관련 글', exact: true })).toHaveCount(0);

    const unpublished = await context.request.put(`/api/posts/${strong.id}`, {
      headers,
      data: { ...strong.data, status: 'DRAFT' },
    });
    expect(unpublished.ok()).toBe(true);
    const noScript = await browser.newContext({ baseURL, javaScriptEnabled: false });
    try {
      const serverRendered = await noScript.newPage();
      expect((await serverRendered.goto(current.url))?.status()).toBe(200);
      await expect(
        serverRendered.getByRole('region', { name: '관련 글', exact: true }).getByRole('link'),
      ).toHaveText([sameCategory.data.title, newer.data.title, older.data.title]);
    } finally {
      await noScript.close();
    }
    expect(errors).toEqual([]);
  } finally {
    await readerContext.close();
    for (const id of ids) await context.request.delete(`/api/posts/${id}`, { headers });
    await context.request.delete('/api/categories', { headers, data: { id: categoryId } });
  }
});

test('게시글 초안은 자동 저장·재시도·두 탭 충돌을 처리하며 공개본은 발행 때만 바뀐다', async ({
  page,
  context,
  request,
}) => {
  test.skip(process.env.CODELILY_AUTH_FIXTURE !== '1', 'Requires isolated fixture sessions.');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await authenticate(context, 'editor');
  const headers = { origin: 'http://localhost:3000' };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/manage/posts/new');
  const title = page.getByRole('textbox', { name: '제목', exact: true });
  const autosave = page.getByRole('status', { name: '초안 저장 상태' });
  let failOnce = true;
  await page.route('**/api/post-drafts/**', async (route) => {
    if (failOnce && route.request().method() === 'PUT') {
      failOnce = false;
      await route.abort();
    } else await route.continue();
  });
  await title.fill('처음 저장한 제목');
  await expect(autosave).toHaveText('초안을 저장하지 못했습니다.');
  await expect(title).toHaveValue('처음 저장한 제목');
  await page.getByRole('button', { name: '저장 재시도' }).click();
  await expect(autosave).toHaveText(/초안 저장됨/);
  const draftUrl = page.url();
  const id = new URL(draftUrl).searchParams.get('draft');
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  expect((await request.put(`/api/post-drafts/${id}`, { headers, data: {} })).status()).toBe(401);
  await page.reload();
  await expect(title).toHaveValue('처음 저장한 제목');
  await page.goto('/manage');
  await page
    .getByRole('region', { name: '미발행 초안' })
    .getByRole('link', { name: '처음 저장한 제목' })
    .click();
  await expect(page).toHaveURL(draftUrl);
  const slug = page.getByLabel('글 주소', { exact: true });
  await slug.fill('postgresql-small-pool');
  await page.getByLabel('원본 형식', { exact: true }).selectOption('MARKDOWN');
  const source = page
    .getByRole('textbox', { name: '본문 편집 원본', exact: true })
    .filter({ visible: true });
  await source.fill('## 작성\n\n```ts\nconst example = 42;\n```');
  await expect(autosave).toHaveText(/초안 저장됨/);
  await page.getByRole('button', { name: '발행', exact: true }).click();
  await expect(
    page.getByText('이미 사용 중인 이름 또는 주소입니다.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(title).toHaveValue('처음 저장한 제목');
  await expect(slug).toHaveValue('postgresql-small-pool');
  await slug.fill('autosave-public-test');
  await expect(autosave).toHaveText(/초안 저장됨/);
  expect(await request.get('/sitemap.xml').then((response) => response.text())).not.toContain(
    'autosave-public-test',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env.CODELILY_EVIDENCE_DIR) {
    await page.getByRole('heading', { name: '새 글 작성' }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(process.env.CODELILY_EVIDENCE_DIR, 'post-draft-mobile.png'),
    });
  }
  await page.getByRole('button', { name: '발행', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/manage/posts/${id}$`));
  const editUrl = page.url();
  const other = await context.newPage();
  try {
    await other.goto(editUrl);
    await expect(other.getByLabel('제목', { exact: true })).toHaveValue('처음 저장한 제목');
    await title.fill('먼저 저장한 수정 초안');
    await expect(autosave).toHaveText(/초안 저장됨/);
    await other.getByLabel('제목', { exact: true }).fill('다른 탭의 편집');
    await expect(other.getByRole('status').filter({ hasText: '다른 탭' })).toBeVisible();
    await expect(other.getByLabel('제목', { exact: true })).toHaveValue('다른 탭의 편집');
    await expect(other.getByRole('button', { name: '수정본 발행' })).toBeDisabled();
    const before = (await (await request.get('/api/posts/autosave-public-test')).json()).data;
    expect(before.title).toBe('처음 저장한 제목');
    await page.reload();
    await expect(title).toHaveValue('먼저 저장한 수정 초안');
    await page.getByRole('button', { name: '수정본 발행', exact: true }).click();
    await expect(page.getByText('글을 발행했습니다.')).toBeVisible();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/posts/autosave-public-test');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('먼저 저장한 수정 초안');
    const copy = page.getByRole('button', { name: '1번째 코드 블록 복사' });
    await copy.focus();
    await page.keyboard.press('Enter');
    await expect(copy).toHaveText('복사됨');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\r\n/g, '\n')).toBe('const example = 42;\n');
    expect(errors).toEqual([]);
  } finally {
    await other.close();
    await context.request.delete(`/api/posts/${id}`, { headers });
  }
});

test('발행 화면 미리보기는 저장 전 내용과 목차를 렌더링하고 편집 권한을 확인한다', async ({
  page,
  browser,
  context,
  request,
}) => {
  test.skip(process.env.CODELILY_AUTH_FIXTURE !== '1', 'Requires isolated fixture sessions.');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  await authenticate(context, 'editor');
  const headers = { origin: 'http://localhost:3000' };
  const input = {
    title: '미리보기 전용 글',
    slug: 'preview-fixture',
    excerpt: '공개 상세와 같은 요약',
    source:
      '## 준비\n\n본문입니다.\n\n### 실행\n\n```ts\nconst demo = true;\n```\n\n![이미지 대체 텍스트](/favicon.ico)',
    format: 'MARKDOWN',
    tags: ['공개준비'],
    status: 'DRAFT',
    categoryId: null,
  };
  const saved = await context.request.post('/api/posts', { headers, data: input });
  expect(saved.ok()).toBe(true);
  const { id } = (await saved.json()).data;
  try {
    const previewRoute = '/api/content/post-preview';
    const data = { ...input, id };
    expect((await request.post(previewRoute, { headers, data })).status()).toBe(401);
    for (const [role, status] of [
      ['member', 403],
      ['owner', 200],
    ] as const) {
      const other = await browser.newContext();
      try {
        await authenticate(other, role);
        expect((await other.request.post(previewRoute, { headers, data })).status()).toBe(status);
      } finally {
        await other.close();
      }
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
      await page.goto(`/manage/posts/${id}`);
      if (width === 390) await page.getByRole('button', { name: '라이트 테마로 변경' }).click();
      await page.getByRole('textbox', { name: '제목', exact: true }).fill('저장하지 않은 제목');
      const button = page.getByRole('button', { name: '발행 화면 미리보기' });
      const received = page.waitForResponse((response) => response.url().endsWith(previewRoute));
      await button.focus();
      await page.keyboard.press('Enter');
      expect((await received).headers()['cache-control']).toContain('private, no-store');
      const dialog = page.getByRole('dialog', { name: '발행 화면 미리보기' });
      await expect(dialog.getByRole('heading', { name: '저장하지 않은 제목' })).toBeVisible();
      await expect(dialog.getByText(input.excerpt)).toBeVisible();
      await expect(dialog.getByText('#공개준비')).toBeVisible();
      await expect(dialog.locator('.content-body')).toHaveCSS(
        'background-color',
        'rgba(0, 0, 0, 0)',
      );
      await expect(dialog.getByText('본문입니다.')).toHaveCSS(
        'color',
        width === 390 ? 'rgb(25, 36, 27)' : 'rgb(244, 243, 233)',
      );
      await expect(dialog.locator('pre code')).toHaveText(/const demo = true/);
      await expect
        .poll(() =>
          dialog
            .getByRole('img', { name: '이미지 대체 텍스트' })
            .evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      const toc = dialog.getByRole('navigation', { name: '본문 목차' });
      await expect(toc.getByRole('link')).toHaveCount(2);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      const audit = await new AxeBuilder({ page })
        .include('dialog[open]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
      if (process.env.CODELILY_EVIDENCE_DIR)
        await page.screenshot({
          path: path.join(process.env.CODELILY_EVIDENCE_DIR, `post-preview-${width}.png`),
        });
      await toc.getByRole('link', { name: '실행' }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog.getByRole('heading', { name: '실행' })).toBeFocused();
      await expect(page).toHaveURL(new RegExp(`/manage/posts/${id}$`));
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(button).toBeFocused();
    }
    const persisted = await context.request.get(`/api/posts/${id}`);
    expect((await persisted.json()).data.title).toBe(input.title);
    expect(errors).toEqual([]);
  } finally {
    await context.request.delete(`/api/posts/${id}`, { headers });
  }
});

test('시리즈는 공개 글만 순서대로 연결하고 사이트맵에서 비공개 전환을 반영한다', async ({
  page,
  browser,
  context,
  request,
}) => {
  test.skip(process.env.CODELILY_AUTH_FIXTURE !== '1', 'Requires isolated fixture sessions.');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  await authenticate(context, 'owner');
  const headers = { origin: 'http://localhost:3000' };
  await page.goto('/manage');
  await page
    .getByRole('navigation', { name: '관리 메뉴' })
    .getByRole('link', { name: '시리즈', exact: true })
    .click();
  await expect(page).toHaveURL(/\/manage\/series$/);
  await page.getByLabel('시리즈 이름').fill('운영기');
  const created = page.waitForResponse((response) => response.url().endsWith('/api/post-series'));
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const series = (await (await created).json()).data;
  await expect(page.getByText('운영기', { exact: true })).toBeVisible();
  const ids: string[] = [];
  const post = {
    title: '배포 준비',
    slug: 'series-prepare',
    excerpt: '',
    source: '## 설정\n\n배포 준비 글입니다.',
    format: 'MARKDOWN',
    status: 'PUBLISHED',
    categoryId: null,
  };
  try {
    await page.goto('/manage/posts/new');
    await page.getByLabel('제목', { exact: true }).fill(post.title);
    await page.getByLabel('글 주소', { exact: true }).fill(post.slug);
    await page.getByLabel('원본 형식', { exact: true }).selectOption(post.format);
    await page
      .getByRole('textbox', { name: '본문 편집 원본', exact: true })
      .filter({ visible: true })
      .fill(post.source);
    await page.getByLabel('시리즈', { exact: true }).selectOption({ label: series.name });
    await page.getByLabel('시리즈 순서').fill('1');
    const firstSaved = page.waitForResponse(
      (response) =>
        response.url().includes('/api/post-drafts/') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '발행', exact: true }).click();
    const first = await firstSaved;
    expect(first.ok()).toBe(true);
    ids.push((await first.json()).data.id);
    const last = {
      ...post,
      title: '운영 점검',
      slug: 'series-review',
      series: { id: series.id, position: 3 },
    };
    const middle = {
      ...post,
      title: '초안 검증',
      slug: 'series-hidden',
      status: 'DRAFT',
      series: { id: series.id, position: 2 },
    };
    for (const data of [last, middle]) {
      const saved = await context.request.post('/api/posts', { headers, data });
      expect(saved.ok()).toBe(true);
      ids.push((await saved.json()).data.id);
    }
    const collision = await context.request.post('/api/posts', {
      headers,
      data: { ...middle, slug: 'series-conflict' },
    });
    expect(collision.status()).toBe(409);
    await page.goto('/series');
    await expect(page.getByRole('heading', { name: '시리즈', exact: true })).toBeVisible();
    await expect(page.getByText('공개 글 2편')).toBeVisible();
    if (process.env.CODELILY_EVIDENCE_DIR)
      await page.screenshot({
        path: path.join(process.env.CODELILY_EVIDENCE_DIR, 'series-index.png'),
      });
    await page.getByRole('link', { name: '운영기', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/series/${series.id}$`));
    await expect(
      page.getByRole('list', { name: '시리즈 글 목록' }).getByRole('listitem'),
    ).toHaveText(['1편 · 배포 준비', '3편 · 운영 점검']);
    const editor = await browser.newContext();
    try {
      await authenticate(editor, 'editor');
      expect(
        (
          await editor.request.post('/api/posts', {
            headers,
            data: { ...last, slug: 'series-forbidden' },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await editor.request.post('/api/content/post-preview', {
            headers,
            data: { ...post, id: ids[0] },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await editor.request.post('/api/post-series', {
            headers,
            data: { id: series.id, name: '다른 작성자 시리즈' },
          })
        ).status(),
      ).toBe(403);
    } finally {
      await editor.close();
    }
    const edited = await context.request.put(`/api/posts/${ids[0]}`, { headers, data: post });
    expect((await edited.json()).data.series).toEqual({ id: series.id, position: 1 });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
      await page.goto(`/posts/${post.slug}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);
      const navigation = page.getByRole('navigation', { name: '시리즈 · 운영기' });
      await expect(navigation.getByRole('listitem')).toHaveText([
        '1편 · 배포 준비',
        '3편 · 운영 점검',
      ]);
      await expect(navigation.locator('[aria-current=page]')).toHaveText('1편 · 배포 준비');
      const audit = await new AxeBuilder({ page })
        .include('nav[aria-labelledby="post-series-heading"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (process.env.CODELILY_EVIDENCE_DIR)
        await navigation.screenshot({
          path: path.join(process.env.CODELILY_EVIDENCE_DIR, `post-series-${width}.png`),
        });
      const next = navigation.getByRole('link', { name: '다음 편 · 운영 점검' });
      await next.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`/posts/${last.slug}$`));
      await expect(navigation.getByRole('link', { name: '이전 편 · 배포 준비' })).toBeVisible();
    }
    const sitemapRoute = '/sitemap.xml';
    const sitemap = await request.get(sitemapRoute);
    expect(sitemap.headers()['content-type']).toContain('application/xml');
    expect(sitemap.headers()['cache-control']).toContain('must-revalidate');
    const xml = await sitemap.text();
    expect(xml).toContain(`<loc>http://localhost:3000/posts/${last.slug}</loc>`);
    expect(xml).not.toContain(middle.slug);
    expect(xml).not.toContain('/manage');
    expect(await (await request.get('/robots.txt')).text()).toContain(
      'Sitemap: http://localhost:3000/sitemap.xml',
    );
    expect(
      (
        await context.request.put(`/api/posts/${ids[1]}`, {
          headers,
          data: { ...last, status: 'DRAFT' },
        })
      ).ok(),
    ).toBe(true);
    expect(await (await request.get(sitemapRoute)).text()).not.toContain(last.slug);
    await page.goto(`/posts/${post.slug}`);
    await expect(
      page.getByRole('navigation', { name: '시리즈 · 운영기' }).getByRole('listitem'),
    ).toHaveCount(1);
    const inUse = await context.request.delete('/api/post-series', {
      headers,
      data: { id: series.id },
    });
    expect(inUse.status()).toBe(409);
    expect(errors).toEqual([]);
  } finally {
    for (const id of ids) await context.request.delete(`/api/posts/${id}`, { headers });
    await context.request.delete('/api/post-series', { headers, data: { id: series.id } });
  }
});

test('management pages explain denied access without exposing another author’s post', async ({
  browser,
  context,
  request,
}) => {
  test.skip(process.env.CODELILY_AUTH_FIXTURE !== '1', 'Requires isolated fixture sessions.');
  await authenticate(context, 'owner');
  const ids: string[] = [];
  try {
    for (const status of ['DRAFT', 'PUBLISHED']) {
      const saved = await context.request.post('/api/posts', {
        headers: { origin: 'http://localhost:3000' },
        data: {
          title: `권한 회귀 ${status}`,
          slug: `management-denied-${status.toLowerCase()}`,
          source: '다른 작성자의 편집 화면에 표시되면 안 되는 본문',
          format: 'MARKDOWN',
          excerpt: '',
          tags: [],
          status,
          categoryId: null,
        },
      });
      expect(saved.status()).toBe(200);
      ids.push((await saved.json()).data.id);
    }
    for (const role of ['member', 'editor']) {
      const restrictedContext = await browser.newContext();
      try {
        await authenticate(restrictedContext, role);
        const restricted = await restrictedContext.newPage();
        const routes =
          role === 'member'
            ? ['/manage', '/manage/posts/new']
            : [
                '/manage/about',
                '/manage/users',
                '/manage/analytics',
                ...ids.map((id) => `/manage/posts/${id}`),
              ];
        for (const route of routes) {
          await restricted.goto(route);
          await expect(
            restricted.getByRole('heading', { name: '페이지를 찾을 수 없습니다.' }),
          ).toBeVisible();
          await expect(
            restricted.getByText('주소가 변경되었거나 이 페이지를 열람할 권한이 없을 수 있습니다.'),
          ).toBeVisible();
          await expect(restricted.getByRole('textbox', { name: '제목', exact: true })).toHaveCount(
            0,
          );
          const denied = await restricted.request.get(route);
          // App Router may have sent the streaming shell before notFound resolves.
          expect([200, 404]).toContain(denied.status());
          expect(await denied.text()).toContain('noindex');
        }
      } finally {
        await restrictedContext.close();
      }
    }
    const anonymous = await request.get('/manage', { maxRedirects: 0 });
    expect([200, 307]).toContain(anonymous.status());
    if (anonymous.status() === 307) expect(anonymous.headers().location).toBe('/sign-in');
    else expect(await anonymous.text()).toContain('/sign-in');
  } finally {
    for (const id of ids) {
      expect(
        (
          await context.request.delete(`/api/posts/${id}`, {
            headers: { origin: 'http://localhost:3000' },
          })
        ).ok(),
      ).toBe(true);
    }
  }
});
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
  await page.getByRole('button', { name: '발행', exact: true }).click();
  await expect(page.getByText('글을 발행했습니다.')).toBeVisible();
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
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: '공개 해제', exact: true }).click();
  await expect(page.getByRole('button', { name: '발행', exact: true })).toBeVisible();
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
test('public archive and article reflect current published data while About retains ISR', async ({
  request,
}) => {
  test.skip(process.env.CODELILY_AUTH_FIXTURE !== '1', 'Requires production fixture.');
  for (const url of ['/', '/posts', '/posts/postgresql-small-pool']) {
    const response = await request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
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
  await page.getByRole('button', { name: '수정본 발행', exact: true }).click();
  await expect(page.getByText('글을 발행했습니다.')).toBeVisible();
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
