import { services } from '@/composition';
import { managementActor } from '@/presentation/manage-actor';
import { PostEditor } from '@/modules/posts/presentation/post-editor';
export default async function NewPost() {
  const actor = await managementActor();
  const categories = await (await services()).posts.categories();
  return (
    <PostEditor
      categories={categories.filter(
        (category) => actor.role === 'OWNER' || category.ownerId === actor.id,
      )}
    />
  );
}
