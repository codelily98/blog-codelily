import { services } from '@/composition';
import { managementActor } from '@/presentation/manage-actor';
import { CategoryManager } from '@/modules/posts/presentation/category-manager';
export default async function Categories() {
  const actor = await managementActor();
  const categories = await (await services()).posts.categories();
  return (
    <CategoryManager
      categories={categories.filter(
        (category) => actor.role === 'OWNER' || category.ownerId === actor.id,
      )}
    />
  );
}
