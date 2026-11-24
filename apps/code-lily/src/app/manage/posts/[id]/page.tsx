import { redirect } from 'next/navigation';
import { services } from '@/composition';
import { managementAccess, managementActor } from '@/presentation/manage-actor';
import { PostEditor } from '@/modules/posts/presentation/post-editor';
export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const actor = await managementActor();
  const { posts } = await services();
  const { id } = await params;
  const postWithSeries = managementAccess(async () => {
    const post = await posts.editablePost(id, actor);
    if (post.bodyRemoved) redirect('/manage?view=withdrawn');
    const seriesOptions = await posts.editableSeriesOptions(actor, post);
    return { post, seriesOptions };
  });
  const [{ post, seriesOptions }, categories] = await Promise.all([
    postWithSeries,
    posts.categories(),
  ]);
  return (
    <PostEditor
      post={post}
      seriesOptions={seriesOptions}
      categories={categories.filter(
        (category) => actor.role === 'OWNER' || category.ownerId === actor.id,
      )}
    />
  );
}
