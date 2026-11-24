import { z } from 'zod';
import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import {
  draftApplySchema,
  draftWriteSchema,
  postSchema,
  postVersionSchema,
} from '@/presentation/schemas';
import { invalidatePosts } from '@/presentation/invalidate';
import { draftArticleInput } from '@/modules/posts/presentation/draft-fields';
import { AppError } from '@/modules/identity/domain/policy';

type Context = { params: Promise<{ id: string }> };
const idFrom = async (context: Context) => z.uuid().parse((await context.params).id);

export function PUT(request: Request, context: Context) {
  return api(
    request,
    async (actor) => {
      const id = await idFrom(context);
      const input = draftWriteSchema.parse(await jsonBody(request));
      return (await services()).posts.saveDraft({ ...input, id }, actor);
    },
    { mutation: true },
  );
}

export function POST(request: Request, context: Context) {
  return api(
    request,
    async (actor) => {
      const id = await idFrom(context);
      const { version, postVersion, confirmBase } = draftApplySchema.parse(await jsonBody(request));
      const { posts } = await services();
      const draft = await posts.readDraft(id, actor);
      if (draft.version !== version)
        throw new AppError(409, '다른 탭에서 초안이 변경되었습니다.', 'POST_DRAFT_CONFLICT');
      const input = postSchema.parse({ ...draftArticleInput(draft.fields), status: 'PUBLISHED' });
      const published = await posts.publishDraft(draft, input, postVersion, confirmBase, actor);
      invalidatePosts();
      return published;
    },
    { mutation: true },
  );
}

export function PATCH(request: Request, context: Context) {
  return api(
    request,
    async (actor) => {
      const id = await idFrom(context);
      const { postVersion } = z
        .strictObject({ postVersion: postVersionSchema })
        .parse(await jsonBody(request));
      await (await services()).posts.unpublish(id, postVersion, actor);
      invalidatePosts();
      return { status: 'DRAFT' };
    },
    { mutation: true },
  );
}

export function DELETE(request: Request, context: Context) {
  return api(
    request,
    async (actor) => {
      const id = await idFrom(context);
      const { version } = z.strictObject({ version: z.uuid() }).parse(await jsonBody(request));
      await (await services()).posts.deleteDraft(id, version, actor);
      return { deleted: true };
    },
    { mutation: true },
  );
}
