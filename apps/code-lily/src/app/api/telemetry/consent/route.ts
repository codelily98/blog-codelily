import { cookies } from 'next/headers';
import { z } from 'zod';
import { api, jsonBody } from '@/presentation/http';
export function POST(request: Request) {
  return api(
    request,
    async () => {
      const { choice } = z.object({ choice: z.enum(['yes', 'no']) }).parse(await jsonBody(request));
      const jar = await cookies();
      jar.set('cl-analytics', choice, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 86400 * 30,
      });
      if (choice === 'no') jar.delete('cl-browser');
      return { choice };
    },
    { mutation: true, public: true },
  );
}
