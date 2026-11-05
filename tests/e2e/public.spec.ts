import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

test('sign-in requires an age declaration before Google redirect; policy review is accessible', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/sign-in?error=login');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '로그인을 완료하지 못했습니다',
  );
  const login = page.getByRole('main').getByRole('button', { name: 'Google 로그인', exact: true });
  await expect(login).toBeDisabled();
  await page.getByRole('checkbox', { name: '만 14세 이상입니다.' }).focus();
  await page.keyboard.press('Space');
  await expect(login).toBeEnabled();
  await page.getByRole('checkbox', { name: '만 14세 이상입니다.' }).uncheck();
  await expect(login).toBeDisabled();
  if (process.env.CODELILY_AUTH_FIXTURE === '1') {
    for (const additionalData of [
      undefined,
      { ageOver14: 'true', serverContext: { membershipDeclaration: '2026-11-05' } },
    ]) {
      const result = await request.post('/api/auth/sign-in/social', {
        headers: { origin: 'http://localhost:3000' },
        data: { provider: 'google', callbackURL: 'http://localhost:3000', additionalData },
      });
      expect(result.status()).toBe(400);
    }
    const allowed = await request.post('/api/auth/sign-in/social', {
      headers: { origin: 'http://localhost:3000' },
      data: {
        provider: 'google',
        callbackURL: 'http://localhost:3000',
        additionalData: { ageOver14: true },
      },
    });
    expect(allowed.status()).toBe(200);
    const { url } = await allowed.json();
    expect(new URL(url).hostname).toBe('accounts.google.com');
  }
  for (const viewport of [
    { width: 1440, height: 1100 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of ['/privacy', '/terms', '/sign-in']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (route === '/sign-in')
        await expect(
          page.getByRole('main').getByText('Google 로그인', { exact: true }),
        ).toBeVisible();
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
      if (process.env.CODELILY_EVIDENCE_DIR && route === '/sign-in')
        await page.screenshot({
          path: path.join(
            process.env.CODELILY_EVIDENCE_DIR,
            `membership-login-${viewport.width}.png`,
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
