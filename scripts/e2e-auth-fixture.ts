// Test-only setup, executed against the isolated in-memory wire database.
// This is not a web route and is never included in the runtime image.
import { writeFile, mkdir } from 'node:fs/promises';
import { getAuth } from '../apps/code-lily/src/modules/identity/infrastructure/auth';
import { getDatabase } from '../apps/code-lily/src/infrastructure/database';
import { makeSignature } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';
if (process.env.CODELILY_AUTH_FIXTURE !== '1')
  throw new Error('Explicit test fixture mode required.');
const auth = await getAuth();
const context = await auth.$context;
const db = await getDatabase();
try {
  const result: Record<string, { name: string; value: string }> = {};
  for (const [key, email, role] of [
    ['owner', 'codelily98@gmail.com', 'OWNER'],
    ['editor', 'editor@fixture.invalid', 'EDITOR'],
    ['member', 'member@fixture.invalid', 'MEMBER'],
  ]) {
    const user = { id: randomUUID() };
    await db.query(
      'INSERT INTO "user" (id,name,email,"emailVerified",role,"createdAt","updatedAt") VALUES ($1,$2,$3,true,$4,now(),now())',
      [user.id, `Fixture ${key}`, email, role],
    );
    const session = await context.internalAdapter.createSession(user.id);
    if (!session) throw new Error('Fixture session creation failed');
    result[key] = {
      name: context.authCookies.sessionToken.name,
      value: encodeURIComponent(
        `${session.token}.${await makeSignature(session.token, process.env.BETTER_AUTH_SECRET!)}`,
      ),
    };
  }
  await mkdir('.local', { recursive: true });
  await writeFile('.local/e2e-sessions.json', JSON.stringify(result));
  console.log('Isolated test sessions created. Google OAuth provider round-trip is not exercised.');
} finally {
  await db.end();
}
