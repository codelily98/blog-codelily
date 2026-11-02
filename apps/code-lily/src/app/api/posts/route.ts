import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { postSchema } from '@/presentation/schemas';
import { invalidatePosts } from '@/presentation/invalidate';
export function GET(request: Request) {
  return api(
    request,
    async () => {
      const url = new URL(request.url);
      const page = Math.min(400, Math.max(1, Number(url.searchParams.get('page') || 1) || 1));
      return (await services()).posts.list({
        q: url.searchParams.get('q')?.slice(0, 100),
        category: url.searchParams.get('category') || undefined,
        tag: url.searchParams.get('tag') || undefined,
        offset: (page - 1) * 24,
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
