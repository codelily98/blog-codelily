import { prepareArticleContent } from '@codelily/content/article';
import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { postPreviewSchema } from '@/presentation/schemas';

export function POST(request: Request) {
  return api(
    request,
    async (actor) => {
      const input = postPreviewSchema.parse(await jsonBody(request));
      const { details, renderedHtml } = await (await services()).posts.preview(input, actor);
      return { details, content: prepareArticleContent(renderedHtml) };
    },
    { mutation: true },
  );
}
