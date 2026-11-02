import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { z } from 'zod';
import { invalidatePosts } from '@/presentation/invalidate';
export function POST(request: Request) {
  return api(
    request,
    async (actor) => {
      const input = z
        .object({
          postId: z.uuid(),
          body: z.string().trim().min(1, '댓글을 입력해주세요.').max(2000),
        })
        .parse(await jsonBody(request));
      const comment = await (await services()).posts.addComment(input.postId, input.body, actor);
      invalidatePosts();
      return comment;
    },
    { mutation: true },
  );
}
export function DELETE(request: Request) {
  return api(
    request,
    async (actor) => {
      const { id } = z.object({ id: z.uuid() }).parse(await jsonBody(request));
      await (await services()).posts.deleteComment(id, actor);
      invalidatePosts();
      return { deleted: true };
    },
    { mutation: true },
  );
}
