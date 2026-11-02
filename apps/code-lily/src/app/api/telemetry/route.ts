import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { z } from 'zod';
import { cookies } from 'next/headers';
const secret = () => process.env.TELEMETRY_SECRET || process.env.BETTER_AUTH_SECRET;
const sign = (value: string, key: string) => createHmac('sha256', key).update(value).digest('hex');
export function POST(request: Request) {
  return api(
    request,
    async () => {
      const cookieJar = await cookies();
      if (cookieJar.get('cl-analytics')?.value !== 'yes' || !secret()) return { recorded: false };
      const { path, kind } = z
        .object({
          path: z
            .string()
            .max(200)
            .regex(/^\/(?:posts(?:\/[a-z0-9-]+)?|about)?$/),
          kind: z.enum(['PAGE_VIEW', 'HEARTBEAT']),
        })
        .parse(await jsonBody(request));
      let signed = cookieJar.get('cl-browser')?.value;
      const valid = () => {
        if (!signed) return false;
        const [id, signature] = signed.split('.');
        if (!id || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
        return timingSafeEqual(Buffer.from(sign(id, secret()!)), Buffer.from(signature));
      };
      if (!valid()) {
        const id = randomUUID();
        signed = `${id}.${sign(id, secret()!)}`;
        cookieJar.set('cl-browser', signed, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 86400 * 30,
          path: '/',
        });
      }
      const browserId = sign(signed!.split('.')[0], secret()!);
      await (await services()).telemetry.record(browserId, path, kind);
      return { recorded: true };
    },
    { mutation: true, public: true },
  );
}
