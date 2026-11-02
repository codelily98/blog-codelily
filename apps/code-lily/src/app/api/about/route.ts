import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { aboutSchema } from '@/presentation/schemas';
import { z } from 'zod';
import { invalidateAbout } from '@/presentation/invalidate';
export function POST(request: Request) {
  return api(
    request,
    async (actor) => {
      const section = await (
        await services()
      ).about.save(aboutSchema.parse(await jsonBody(request)), actor);
      invalidateAbout();
      return section;
    },
    { mutation: true },
  );
}
export function DELETE(request: Request) {
  return api(
    request,
    async (actor) => {
      const { id } = z.object({ id: z.uuid() }).parse(await jsonBody(request));
      await (await services()).about.delete(id, actor);
      invalidateAbout();
      return { deleted: true };
    },
    { mutation: true },
  );
}
