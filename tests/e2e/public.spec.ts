import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

test('public homepage explains the service and links the same policy and login pages', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  for (const viewport of [
    { width: 1440, height: 1100 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '기술을 배우고, 기록하고, 나누는 공간',
    );
    const main = page.getByRole('main');
    for (const [name, href] of [
      ['Posts 글 보기', '/posts'],
      ['About 소개 보기', '/about'],
      ['Work 문서 보기', '/work'],
      ['개인정보처리방침', '/privacy'],
      ['이용약관', '/terms'],
      ['Google 로그인 안내', '/sign-in'],
    ])
      await expect(
        main.getByRole('link', { name, exact: name === '개인정보처리방침' || name === '이용약관' }),
      ).toHaveAttribute('href', href);
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
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page.getByRole('heading', { name: '“PostgreSQL” 검색 결과' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: '방문 기록 설정' }).click();
  await page.getByRole('button', { name: '거부', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
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
