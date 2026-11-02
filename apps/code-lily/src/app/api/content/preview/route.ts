import { renderContent } from '@codelily/content';
import { api, jsonBody } from '@/presentation/http';
import { writer } from '@/modules/identity/domain/policy';
import { z } from 'zod';
export function POST(request: Request) {
  return api(
    request,
    async (actor) => {
      writer(actor);
      const { source, format } = z
        .object({ source: z.string().max(500000), format: z.enum(['HTML', 'MARKDOWN']) })
        .parse(await jsonBody(request));
      return renderContent(source, format);
    },
    { mutation: true },
  );
}
