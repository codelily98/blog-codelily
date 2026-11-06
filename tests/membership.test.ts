import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { runWithRequestState } from '@better-auth/core/context';
import { EmbeddedPool, type Database } from '../apps/code-lily/src/infrastructure/database';
import { membershipDeclarationVersion } from '../apps/code-lily/src/modules/identity/domain/membership';

test('Google requires server-bound consent only when creating a member', async () => {
  const engine = await PGlite.create();
  const globals = globalThis as unknown as { codeLilyDatabase?: Promise<Database> };
  await engine.exec('CREATE SCHEMA blog_schema');
  await engine.exec(await readFile('apps/code-lily/migrations/001_initial.sql', 'utf8'));
  globals.codeLilyDatabase = Promise.resolve(new EmbeddedPool(engine));
  process.env.BETTER_AUTH_SECRET = 'membership-test-secret-only-0123456789-abcdefgh';
  process.env.APP_URL = 'http://localhost:3000';
  process.env.BETTER_AUTH_URL = 'http://localhost:3000';
  process.env.GOOGLE_CLIENT_ID = 'membership-fixture.invalid';
  process.env.GOOGLE_CLIENT_SECRET = 'membership-fixture-only';
  const { getAuth } = await import('../apps/code-lily/src/modules/identity/infrastructure/auth');
  try {
    const auth = await getAuth();
    const context = await auth.$context;
    await assert.rejects(
      runWithRequestState(new WeakMap(), () =>
        context.internalAdapter.createUser({
          name: 'Unconfirmed fixture',
          email: 'unconfirmed@fixture.invalid',
          emailVerified: true,
        }),
      ),
      { message: '가입 화면에서 연령 확인과 이용약관 동의를 다시 진행해 주세요.' },
    );
    assert.deepEqual((await engine.query('SELECT id FROM "user"')).rows, []);

    // Exercise Better Auth's real state/callback/database path. Only the Google
    // token exchange and user-info responses are synthetic; no Google request occurs.
    const google = context.socialProviders.find((provider) => provider.id === 'google')!;
    google.validateAuthorizationCode = async () => ({
      accessToken: 'fixture-access-only',
      scopes: ['openid', 'email', 'profile'],
    });
    google.getUserInfo = async () => ({
      user: {
        id: 'age-fixture-subject',
        email: 'age-ok@fixture.invalid',
        emailVerified: true,
        name: 'Age accepted fixture',
        image: null,
      },
      data: { sub: 'age-fixture-subject' },
    });
    const origin = 'http://localhost:3000';
    const start = async (fields: Record<string, unknown> = {}) => {
      // Each scenario starts with its own rate-limit budget.
      await engine.exec('DELETE FROM "rateLimit"');
      return auth.handler(
        new Request(`${origin}/api/auth/sign-in/social`, {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify({
            provider: 'google',
            callbackURL: origin,
            errorCallbackURL: `${origin}/sign-in`,
            ...fields,
          }),
        }),
      );
    };
    const finish = async (response: Response) => {
      assert.equal(response.status, 200);
      const state = new URL((await response.json()).url).searchParams.get('state');
      assert.ok(state);
      const cookies = response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      const callback = await auth.handler(
        new Request(
          `${origin}/api/auth/callback/google?code=fixture&state=${encodeURIComponent(state)}`,
          { headers: { cookie: cookies } },
        ),
      );
      assert.equal(callback.status, 302);
      return callback;
    };

    for (const additionalData of [
      undefined,
      { ageOver14: true, termsAccepted: false },
      { ageOver14: true, termsAccepted: 'true' },
      { ageOver14: 'true', termsAccepted: true },
      { ageOver14: true, serverContext: { membershipDeclaration: membershipDeclarationVersion } },
    ]) {
      assert.equal((await start({ requestSignUp: true, additionalData })).status, 400);
    }
    const declarations = { ageOver14: true, termsAccepted: true };
    const firstLogin = await finish(await start({ additionalData: declarations }));
    assert.equal(firstLogin.headers.get('location'), `${origin}/sign-in?error=signup_disabled`);
    assert.deepEqual((await engine.query('SELECT id FROM "user"')).rows, []);
    assert.deepEqual((await engine.query('SELECT id FROM "session"')).rows, []);

    const signup = await finish(
      await start({ requestSignUp: true, additionalData: { ...declarations, role: 'OWNER' } }),
    );
    assert.equal(signup.headers.get('location'), origin);
    assert.equal((await engine.query('SELECT id FROM "session"')).rows.length, 1);

    const returningLogin = await finish(await start());
    assert.equal(returningLogin.headers.get('location'), origin);
    assert.equal((await engine.query('SELECT id FROM "session"')).rows.length, 2);
    assert.deepEqual((await engine.query('SELECT email,role FROM "user"')).rows, [
      { email: 'age-ok@fixture.invalid', role: 'MEMBER' },
    ]);
  } finally {
    delete globals.codeLilyDatabase;
    await engine.close();
  }
});
