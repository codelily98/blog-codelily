import { services } from '@/composition';
import { managementActor } from '@/presentation/manage-actor';
import { PostEditor } from '@/modules/posts/presentation/post-editor';
export default async function NewPost() {
  const actor = await managementActor();
  const { posts } = await services();
  const [categories, seriesOptions] = await Promise.all([
    posts.categories(),
    posts.editableSeriesOptions(actor),
  ]);
  return (
    <PostEditor
      seriesOptions={seriesOptions}
      categories={categories.filter(
        (category) => actor.role === 'OWNER' || category.ownerId === actor.id,
      )}
    />
  );
}
