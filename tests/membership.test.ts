import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { runWithRequestState } from '@better-auth/core/context';
import { EmbeddedPool, type Database } from '../apps/code-lily/src/infrastructure/database';
import { hasAgeDeclaration } from '../apps/code-lily/src/modules/identity/domain/membership';

test('Google signup cannot create a user without a server-bound age declaration', async () => {
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
      { message: '가입 연령 확인을 다시 진행해 주세요.' },
    );
    assert.deepEqual((await engine.query('SELECT id FROM "user"')).rows, []);
    for (const input of [null, {}, { ageOver14: false }, { ageOver14: 'true' }, { ageOver14: 1 }])
      assert.equal(hasAgeDeclaration(input), false);
    assert.equal(hasAgeDeclaration({ ageOver14: true }), true);

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
    const start = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-in/social', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          callbackURL: 'http://localhost:3000',
          additionalData: { ageOver14: true, role: 'OWNER' },
        }),
      }),
    );
    assert.equal(start.status, 200);
    const redirect = new URL((await start.json()).url);
    const state = redirect.searchParams.get('state');
    assert.ok(state);
    const cookies = start.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const callback = await auth.handler(
      new Request(
        `http://localhost:3000/api/auth/callback/google?code=fixture&state=${encodeURIComponent(state)}`,
        { headers: { cookie: cookies } },
      ),
    );
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get('location'), 'http://localhost:3000');
    assert.deepEqual((await engine.query('SELECT email,role FROM "user"')).rows, [
      { email: 'age-ok@fixture.invalid', role: 'MEMBER' },
    ]);
  } finally {
    delete globals.codeLilyDatabase;
    await engine.close();
  }
});
