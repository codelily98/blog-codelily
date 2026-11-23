import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { postSchema } from '@/presentation/schemas';
import { invalidatePosts } from '@/presentation/invalidate';
import { archivePageSize, archiveQuery } from '@/modules/posts/presentation/archive-query';
export function GET(request: Request) {
  return api(
    request,
    async () => {
      const search = new URL(request.url).searchParams;
      const { q, category, tag, page } = archiveQuery((key) => search.get(key) ?? undefined);
      return (await services()).posts.list({
        q,
        category,
        tag,
        limit: archivePageSize,
        offset: (page - 1) * archivePageSize,
      });
    },
    { public: true },
  );
}
export function POST(request: Request) {
  return api(
    request,
    async (actor) => {
      const post = await (
        await services()
      ).posts.save(postSchema.parse(await jsonBody(request)), actor);
      invalidatePosts();
      return post;
    },
    { mutation: true },
  );
}
