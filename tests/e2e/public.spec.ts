import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

test('public homepage renders recent articles, RSS, Pretendard and policy links', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  for (const viewport of [
    { width: 1440, height: 1100 },
    { width: 1487, height: 1058 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('배운 것을 기록합니다.');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: '최근 글' })).toBeVisible();
    await expect(main.getByRole('article')).toHaveCount(4);
    await expect(main.locator('article p').first()).toHaveCSS('color', 'rgb(187, 199, 188)');
    await expect(
      page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: 'Posts' }),
    ).toHaveCSS('color', 'rgb(244, 243, 233)');
    await expect(main.getByRole('heading', { level: 1 })).toHaveCSS('font-family', /Pretendard/);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          await document.fonts.ready;
          return [...document.fonts].some(
            (font) => font.family.includes('Pretendard') && font.status === 'loaded',
          );
        }),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page
          .locator('.publication-cover-photo')
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    for (const [name, href] of [
      ['전체 글 보기', '/posts'],
      ['RSS 구독', '/feed.xml'],
      ['Work 문서 보기', '/work'],
      ['Google 로그인 안내', '/sign-in'],
    ])
      await expect(main.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    const footer = page.getByRole('contentinfo');
    const headerLogo = page.getByRole('link', { name: 'code-lily 홈' }).locator('img');
    const footerLogo = footer.getByRole('link', { name: 'code-lily', exact: true }).locator('img');
    await expect(headerLogo).toHaveAttribute('src', /\/icon\.[^/]+\.svg$/);
    await expect(footerLogo).toHaveAttribute('src', (await headerLogo.getAttribute('src'))!);
    await expect
      .poll(() => headerLogo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
    await expect(footer.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    await expect(footer.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (process.env.CODELILY_EVIDENCE_DIR)
      await page.screenshot({
        path: path.join(process.env.CODELILY_EVIDENCE_DIR, `public-home-${viewport.width}.png`),
        fullPage: true,
      });
    await main.getByRole('link', { name: 'Google 로그인 안내', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Google 계정으로 로그인' })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('the SVG icon and multi-size ICO favicon are served directly', async ({ page, request }) => {
  await page.goto('/');
  const svg = await page.locator('link[rel="icon"][href^="/icon.svg"]').getAttribute('href');
  const ico = await page.locator('link[rel="icon"][href^="/favicon.ico"]').getAttribute('href');
  expect(svg).toBeTruthy();
  expect(ico).toBeTruthy();

  const vector = await request.get(svg!, { maxRedirects: 0 });
  expect(vector.status()).toBe(200);
  expect(vector.headers()['content-type']).toContain('image/svg+xml');

  const favicon = await request.get(ico!, { maxRedirects: 0 });
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()['content-type']).toMatch(/image\/(x-icon|vnd\.microsoft\.icon)/);
  const body = await favicon.body();
  expect(body.readUInt32LE(0)).toBe(0x0001_0000);
  const sizes = Array.from(
    { length: body.readUInt16LE(4) },
    (_, index) => body[6 + index * 16] || 256,
  );
  expect(sizes).toEqual([16, 24, 32, 48, 64, 128, 256]);
});

test('Google login skips consent and signup requires both declarations; policy review is accessible', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  await page.goto('/sign-in?error=login');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '로그인을 완료하지 못했습니다',
  );
  const main = page.getByRole('main');
  const login = main.getByRole('button', { name: 'Google 로그인', exact: true });
  await expect(login).toBeEnabled();
  await expect(main.getByRole('checkbox')).toHaveCount(0);
  await page.route('https://accounts.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Google OAuth fixture</title>' }),
  );
  if (process.env.CODELILY_AUTH_FIXTURE === '1') {
    const loginRequest = page.waitForRequest('**/api/auth/sign-in/social');
    await login.click();
    const payload = (await loginRequest).postDataJSON();
    expect(payload.provider).toBe('google');
    expect(payload).not.toHaveProperty('requestSignUp');
    expect(payload).not.toHaveProperty('additionalData');
    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
  }
  await page.goto('/sign-in');
  await main.getByRole('link', { name: '처음이신가요? 회원가입' }).click();
  await expect(page).toHaveURL(/\/sign-in\?mode=signup$/);
  const signup = main.getByRole('button', { name: 'Google로 가입하기', exact: true });
  const age = main.getByRole('checkbox', { name: '만 14세 이상입니다.' });
  const terms = main.getByRole('checkbox', { name: '이용약관에 동의합니다.' });
  await expect(signup).toBeDisabled();
  await age.press('Space');
  await expect(signup).toBeDisabled();
  await terms.press('Space');
  await expect(signup).toBeEnabled();
  await age.uncheck();
  await expect(signup).toBeDisabled();
  await age.check();
  if (process.env.CODELILY_AUTH_FIXTURE === '1') {
    const signupRequest = page.waitForRequest('**/api/auth/sign-in/social');
    await signup.click();
    expect((await signupRequest).postDataJSON()).toMatchObject({
      provider: 'google',
      requestSignUp: true,
      additionalData: { ageOver14: true, termsAccepted: true },
    });
    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
  }
  await page.goto('/sign-in?error=signup_disabled');
  await expect(main.getByRole('alert')).toContainText('가입되지 않은 Google 계정');
  await expect(signup).toBeDisabled();
  await main.getByRole('link', { name: '이미 회원이신가요? 로그인' }).click();
  await expect(login).toBeEnabled();

  for (const viewport of [
    { width: 1440, height: 1100 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of ['/privacy', '/terms', '/sign-in', '/sign-in?mode=signup']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('nextjs-portal')).toHaveCount(0);
      if (route === '/sign-in')
        await expect(
          page.getByRole('main').getByText('Google 로그인', { exact: true }),
        ).toBeVisible();
      if (route === '/sign-in?mode=signup') {
        await expect(main.getByRole('link', { name: '이용약관', exact: true })).toHaveAttribute(
          'href',
          '/terms',
        );
        await expect(age).not.toBeChecked();
        await expect(terms).not.toBeChecked();
        await expect(signup).toBeDisabled();
      }
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      if (route === '/privacy') {
        await expect(page.getByRole('heading', { name: 'Work 문서와 공개 범위' })).toBeVisible();
        await expect(page.locator('time')).toHaveAttribute('datetime', '2026-11-05');
        await expect(page.getByText('공개 전 검토본', { exact: true })).toBeVisible();
      }
      if (process.env.CODELILY_EVIDENCE_DIR && route.startsWith('/sign-in'))
        await page.screenshot({
          path: path.join(
            process.env.CODELILY_EVIDENCE_DIR,
            `membership-${route.includes('signup') ? 'signup' : 'login'}-${viewport.width}.png`,
          ),
          fullPage: true,
        });
    }
  }
  expect(errors).toEqual([]);
});

test('Posts → category → detail → About; light/dark, mobile and accessibility', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/posts');
  await expect(page).toHaveTitle(/code-lily/);
  await expect(page.getByRole('heading', { name: '모든 글', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(6);
  const evidence = process.env.CODELILY_EVIDENCE_DIR;
  if (evidence)
    await page.screenshot({
      path: path.join(evidence, 'code-lily-posts-dark.png'),
      fullPage: true,
    });
  await page
    .getByRole('navigation', { name: '카테고리', exact: true })
    .getByRole('link')
    .filter({ hasText: 'React' })
    .click();
  await expect(page.getByRole('heading', { name: 'React', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page
    .getByRole('link', { name: 'React 서버 컴포넌트의 경계 이해하기', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'React 서버 컴포넌트의 경계 이해하기', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.content-body pre')).toBeVisible();
  await expect(page.getByText('Google 계정으로 로그인하면 댓글을 남길 수 있습니다.')).toBeVisible();
  if (evidence)
    await page.screenshot({
      path: path.join(evidence, 'code-lily-reader-dark.png'),
      fullPage: true,
    });
  await page.getByRole('link', { name: '#nextjs', exact: true }).click();
  await expect(page.getByRole('heading', { name: '#nextjs', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page
    .getByRole('navigation', { name: '주 메뉴' })
    .getByRole('link', { name: 'About', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: /안녕하세요/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '경력', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '관심사', exact: true })).toBeVisible();
  if (evidence)
    await page.screenshot({
      path: path.join(evidence, 'code-lily-about-dark.png'),
      fullPage: true,
    });
  const darkAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(darkAudit.violations).toEqual([]);
  await page.getByRole('button', { name: '라이트 테마로 변경' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  if (evidence)
    await page.screenshot({
      path: path.join(evidence, 'code-lily-about-light.png'),
      fullPage: true,
    });
  const lightAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(lightAudit.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/posts');
  await expect(page.getByRole('heading', { name: '모든 글', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  if (evidence)
    await page.screenshot({
      path: path.join(evidence, 'code-lily-posts-mobile.png'),
      fullPage: true,
    });
  await page.getByRole('button', { name: '글 검색', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '검색어', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: '글 검색', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '글 검색', exact: true }).click();
  await page.getByRole('textbox', { name: '검색어', exact: true }).fill('PostgreSQL');
  await page.getByRole('dialog').getByRole('button', { name: '검색', exact: true }).click();
  await expect(page.getByRole('heading', { name: '“PostgreSQL” 검색 결과' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: '방문 기록 설정' }).click();
  await page.getByRole('button', { name: '거부', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('공개 글과 목차의 공유 링크를 복사하고 클립보드 거부 시 직접 선택한다', async ({
  baseURL,
  context,
  page,
}) => {
  const articlePath = '/posts/small-server-architecture';
  const articleUrl = new URL(articlePath, baseURL).href;
  const fragment = '#article-section-2';
  const sectionUrl = `${articleUrl}${fragment}`;
  const outline = page.getByRole('navigation', { name: '본문 목차' });
  const sectionCopy = outline.getByRole('button', { name: '기본 원칙 링크 복사', exact: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  for (const viewport of [
    { width: 1440, height: 1100 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const visited = `${articleUrl}?utm_source=fixture#article-section-1`;
    expect((await page.goto(visited))?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '작은 서버에서 시작하는 단단한 아키텍처',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', articleUrl);
    if (viewport.width === 390)
      await page.getByRole('button', { name: '라이트 테마로 변경' }).click();
    const articleCopy = page.getByRole('button', { name: '글 링크 복사', exact: true });
    await articleCopy.focus();
    await expect(articleCopy).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(articleUrl);
    await expect(page.getByRole('status').filter({ hasText: '링크를 복사했습니다.' })).toHaveCount(
      1,
    );

    await expect(outline.getByRole('link', { name: '기본 원칙', exact: true })).toHaveAttribute(
      'href',
      fragment,
    );
    await sectionCopy.press('Space');
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(sectionUrl);
    await expect(page).toHaveURL(visited);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect((await page.goto(copied))?.status()).toBe(200);
    await expect(page.locator('.content-body :target')).toHaveText('기본 원칙');
    await expect(page.getByRole('heading', { name: '기본 원칙', exact: true })).toBeInViewport();
    const audit = await new AxeBuilder({ page })
      .include('main > article')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }

  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      async value() {
        throw new DOMException('Clipboard permission denied', 'NotAllowedError');
      },
    });
  });
  await page.goto(articleUrl);
  await sectionCopy.click();
  const manualLink = page.getByRole('textbox', { name: '복사할 링크', exact: true });
  await expect(manualLink).toBeVisible();
  await expect(manualLink).not.toBeEditable();
  await expect(manualLink).toHaveValue(sectionUrl);
  await manualLink.press('ControlOrMeta+a');
  expect(
    await manualLink.evaluate((input: HTMLInputElement) =>
      input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0),
    ),
  ).toBe(sectionUrl);
  expect(errors).toEqual([]);
});

test('archive search is server-rendered and RSS exposes only publication summaries', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/posts');
    await page.getByRole('searchbox', { name: '제목과 요약 검색' }).fill('PostgreSQL');
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await expect(page.getByRole('heading', { name: '“PostgreSQL” 검색 결과' })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.goto('/posts?q=일치하지않는값');
    await expect(page.getByText('조건에 맞는 글이 없습니다.')).toBeVisible();
    await page.getByRole('link', { name: '필터 지우기' }).click();
    await expect(page.getByRole('article')).toHaveCount(6);
    await page.goto('/posts?page=2');
    await expect(page.getByRole('link', { name: '이전', exact: true })).toHaveAttribute(
      'href',
      '/posts',
    );
    await page.goto('/posts/small-server-architecture');
    const outline = page.getByRole('navigation', { name: '본문 목차' });
    await expect(page.getByRole('button', { name: '글 링크 복사', exact: true })).toHaveCount(0);
    await expect(outline.getByRole('button', { name: /링크 복사$/ })).toHaveCount(0);
    await outline.getByRole('link', { name: '기본 원칙', exact: true }).click();
    await expect(page).toHaveURL(/#article-section-2$/);
    await expect(page.getByRole('heading', { name: '기본 원칙', exact: true })).toBeFocused();
  } finally {
    await context.close();
  }
  const feed = await request.get('/feed.xml');
  expect(feed.ok()).toBe(true);
  expect(feed.headers()['content-type']).toContain('application/rss+xml');
  const xml = await feed.text();
  expect(xml).toContain('<rss version="2.0"');
  expect(xml).toContain('/posts/postgresql-small-pool');
  expect(xml.match(/<item>/g)).toHaveLength(6);
  const published = await request.get('/api/posts/postgresql-small-pool');
  expect(published.ok()).toBe(true);
  const { data } = await published.json();
  expect(data.renderedHtml).toContain('<table>');
  expect(data).not.toHaveProperty('source');
  expect(published.headers()['cache-control']).toContain('no-store');
  expect(published.headers()['content-security-policy']).toContain("object-src 'none'");
});
test('unauthorized management/write/internal endpoints reject access', async ({ request }) => {
  const write = await request.post('/api/posts', {
    headers: { origin: 'http://localhost:3000' },
    data: {},
  });
  expect(write.status()).toBe(401);
  const crossOrigin = await request.post('/api/posts', {
    headers: { origin: 'https://untrusted.invalid' },
    data: {},
  });
  expect(crossOrigin.status()).toBe(403);
  const internal = await request.get('/api/internal/v1/summary');
  expect(internal.status()).toBe(401);
  const auth = await request.get('/api/auth/get-session');
  expect(auth.status()).toBe(process.env.CODELILY_AUTH_FIXTURE === '1' ? 200 : 503);
  const ready = await request.get('/health/ready');
  expect(ready.status()).toBe(200);
});
