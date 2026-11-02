import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { z } from 'zod';
export function PATCH(request: Request) {
  return api(
    request,
    async (actor) => {
      const { id, role } = z
        .object({ id: z.string().min(1).max(100), role: z.enum(['MEMBER', 'EDITOR']) })
        .parse(await jsonBody(request));
      return (await services()).members.setRole(id, role, actor);
    },
    { mutation: true },
  );
}
