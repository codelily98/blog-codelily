import { z } from 'zod';
import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { postSeriesSchema } from '@/presentation/schemas';

export function POST(request: Request) {
  return api(
    request,
    async (actor) => {
      const input = postSeriesSchema.parse(await jsonBody(request));
      return (await services()).posts.saveSeries(input, actor);
    },
    { mutation: true },
  );
}

export function DELETE(request: Request) {
  return api(
    request,
    async (actor) => {
      const { id } = z.object({ id: z.uuid() }).parse(await jsonBody(request));
      await (await services()).posts.deleteSeries(id, actor);
      return { deleted: true };
    },
    { mutation: true },
  );
}
