import { z } from 'zod';
import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { postSchema } from '@/presentation/schemas';
import { invalidatePosts } from '@/presentation/invalidate';
type Context = { params: Promise<{ id: string }> };
export function GET(request: Request, context: Context) {
  return api(request, async (actor) =>
    (await services()).posts.read((await context.params).id, actor),
  );
}
export function PUT(request: Request, context: Context) {
  return api(
    request,
    async (actor) => {
      const post = await (
        await services()
      ).posts.save(
        postSchema.parse({ ...(await jsonBody(request)), id: (await context.params).id }),
        actor,
      );
      invalidatePosts();
      return post;
    },
    { mutation: true },
  );
}
export function PATCH(request: Request, context: Context) {
  return api(
    request,
    async (actor) => {
      const id = z.uuid().parse((await context.params).id);
      const { status } = z
        .strictObject({ status: postSchema.shape.status })
        .parse(await jsonBody(request));
      await (await services()).posts.setWithdrawnVisibility(id, status, actor);
      invalidatePosts();
      return { status };
    },
    { mutation: true },
  );
}
export function DELETE(request: Request, context: Context) {
  return api(
    request,
    async (actor) => {
      await (await services()).posts.delete((await context.params).id, actor);
      invalidatePosts();
      return { deleted: true };
    },
    { mutation: true },
  );
}
