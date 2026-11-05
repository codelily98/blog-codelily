import { redirect } from 'next/navigation';
import { services } from '@/composition';
import { managementAccess, managementActor } from '@/presentation/manage-actor';
import { owned } from '@/modules/identity/domain/policy';
import { PostEditor } from '@/modules/posts/presentation/post-editor';
export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const actor = await managementActor();
  const { posts } = await services();
  const [post, categories] = await Promise.all([
    managementAccess(async () => {
      const post = await posts.read((await params).id, actor);
      owned(actor, post.authorId);
      return post;
    }),
    posts.categories(),
  ]);
  if (post.bodyRemoved) redirect('/manage?view=withdrawn');
  return (
    <PostEditor
      post={post}
      categories={categories.filter(
        (category) => actor.role === 'OWNER' || category.ownerId === actor.id,
      )}
    />
  );
}
