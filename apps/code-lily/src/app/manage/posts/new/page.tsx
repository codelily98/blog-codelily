import { services } from '@/composition';
import { managementAccess, managementActor } from '@/presentation/manage-actor';
import { PostEditor } from '@/modules/posts/presentation/post-editor';
import { z } from 'zod';
import { notFound, redirect } from 'next/navigation';

export default async function NewPost({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const [actor, params] = await Promise.all([managementActor(), searchParams]);
  const { posts } = await services();
  const draftId = z.uuid().safeParse(params.draft);
  if (params.draft !== undefined && !draftId.success) notFound();
  const [categories, seriesOptions, draft] = await Promise.all([
    posts.categories(),
    posts.editableSeriesOptions(actor),
    draftId.success
      ? managementAccess(async () => {
          const result = await posts.findEditableDraft(draftId.data, actor);
          if (!result || result.postId) {
            await posts.editablePost(draftId.data, actor);
            redirect(`/manage/posts/${draftId.data}`);
          }
          return result;
        })
      : undefined,
  ]);
  return (
    <PostEditor
      key={draft?.id ?? 'new-post'}
      draft={draft}
      seriesOptions={seriesOptions}
      categories={categories.filter(
        (category) => actor.role === 'OWNER' || category.ownerId === actor.id,
      )}
    />
  );
}
