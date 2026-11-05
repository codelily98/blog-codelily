import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { workContent } from '@/modules/work/presentation/schemas';
import { z } from 'zod';
export function POST(request: Request) {
  return api(
    request,
    async (actor) => {
      const { content } = z
        .object({ content: workContent })
        .strict()
        .parse(await jsonBody(request));
      return (await services()).work.preview(content, actor);
    },
    { mutation: true },
  );
}
