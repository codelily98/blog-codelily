import { revalidatePath } from 'next/cache';
export function invalidatePosts() {
  revalidatePath('/');
  revalidatePath('/posts');
  revalidatePath('/posts/[[...archive]]', 'page');
  revalidatePath('/posts/[slug]', 'page');
}
export function invalidateAbout() {
  revalidatePath('/about');
  revalidatePath('/about/[[...section]]', 'page');
}
