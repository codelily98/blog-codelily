import { services } from '@/composition';
import { managementActor } from '@/presentation/manage-actor';
import { owned } from '@/modules/identity/domain/policy';
import { PostEditor } from '@/modules/posts/presentation/post-editor';
export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const actor = await managementActor();
  const { posts } = await services();
  const [post, categories] = await Promise.all([
    posts.read((await params).id, actor),
    posts.categories(),
  ]);
  owned(actor, post.authorId);
  return (
    <PostEditor
      post={post}
      categories={categories.filter(
        (category) => actor.role === 'OWNER' || category.ownerId === actor.id,
      )}
    />
  );
}
