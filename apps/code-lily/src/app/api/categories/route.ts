import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { categorySchema } from '@/presentation/schemas';
import { z } from 'zod';
import { invalidatePosts } from '@/presentation/invalidate';
export function GET(request: Request) {
  return api(request, async () => (await services()).posts.categories(), { public: true });
}
export function POST(request: Request) {
  return api(
    request,
    async (actor) => {
      const category = await (
        await services()
      ).posts.saveCategory(categorySchema.parse(await jsonBody(request)), actor);
      invalidatePosts();
      return category;
    },
    { mutation: true },
  );
}
export function DELETE(request: Request) {
  return api(
    request,
    async (actor) => {
      const { id } = z.object({ id: z.uuid() }).parse(await jsonBody(request));
      await (await services()).posts.deleteCategory(id, actor);
      invalidatePosts();
      return { deleted: true };
    },
    { mutation: true },
  );
}
