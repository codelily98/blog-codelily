import { services } from '@/composition';
import { managementActor } from '@/presentation/manage-actor';
import { ManagePosts } from '@/modules/posts/presentation/manage-posts';
export default async function Manage() {
  const actor = await managementActor();
  return <ManagePosts posts={await (await services()).posts.management(actor)} />;
}
