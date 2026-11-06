import { betterAuth } from 'better-auth';
import { PostgresDialect } from 'kysely';
import { getDatabase } from '../../../infrastructure/database';
import type { Actor } from '../domain/policy';
import { roleSchema } from '@codelily/contracts';
import {
  APIError,
  addOAuthServerContext,
  createAuthMiddleware,
  getOAuthState,
} from 'better-auth/api';
import { hasSignupDeclaration, membershipDeclarationVersion } from '../domain/membership';

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.BETTER_AUTH_SECRET,
  );
}
async function createAuth() {
  const pool = await getDatabase();
  if (!process.env.BETTER_AUTH_SECRET)
    throw new Error('Set BETTER_AUTH_SECRET before enabling Google login.');
  const owners = (process.env.OWNER_EMAILS || 'codelily98@gmail.com')
    .split(',')
    .map((email) => email.trim().toLowerCase());
  return betterAuth({
    appName: 'code-lily',
    baseURL: process.env.BETTER_AUTH_URL || process.env.APP_URL || 'http://localhost:3000',
    secret: process.env.BETTER_AUTH_SECRET,
    database: {
      dialect: new PostgresDialect({ pool: pool as never }),
      type: 'postgres',
      schemaName: 'blog_schema',
      transaction: true,
    },
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        prompt: 'select_account',
        disableImplicitSignUp: true,
      },
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'MEMBER', input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    account: { encryptOAuthTokens: true },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 60 },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== '/sign-in/social' || context.body?.requestSignUp !== true) return;
        if (!hasSignupDeclaration(context.body.additionalData))
          throw new APIError('BAD_REQUEST', {
            message: '가입하려면 만 14세 이상임을 확인하고 이용약관에 동의해 주세요.',
          });
        await addOAuthServerContext({ membershipDeclaration: membershipDeclarationVersion });
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const state = await getOAuthState();
            if (state?.serverContext?.membershipDeclaration !== membershipDeclarationVersion)
              throw new APIError('FORBIDDEN', {
                message: '가입 화면에서 연령 확인과 이용약관 동의를 다시 진행해 주세요.',
              });
            return {
              data: {
                ...user,
                role:
                  user.emailVerified && owners.includes(user.email.toLowerCase())
                    ? 'OWNER'
                    : 'MEMBER',
              },
            };
          },
        },
      },
      session: {
        create: {
          before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }),
        },
      },
    },
  });
}
const globalAuth = globalThis as unknown as { codeLilyAuth?: ReturnType<typeof createAuth> };
export function getAuth() {
  return (globalAuth.codeLilyAuth ??= createAuth());
}
export async function sessionActor(requestHeaders: Headers): Promise<Actor | null> {
  if (!googleConfigured()) return null;
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  // Always use a current server-side DB role; never trust a client-supplied role.
  const db = await getDatabase();
  const result = await db.query<{ id: string; name: string; email: string; role: string }>(
    'SELECT id,name,email,role FROM "user" WHERE id=$1',
    [session.user.id],
  );
  const user = result.rows[0];
  return user ? { ...user, role: roleSchema.parse(user.role) } : null;
}
