import { notFound } from 'next/navigation';
import { services } from '@/composition';
import { Archive } from '@/modules/posts/presentation/archive';
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}
export default async function PostsPage({ params }: { params: Promise<{ archive?: string[] }> }) {
  if ((await params).archive?.length) notFound();
  const { posts } = await services();
  const [records, categories, total] = await Promise.all([
    posts.list({}),
    posts.categories(),
    posts.publishedCount(),
  ]);
  return <Archive initialPosts={records} categories={categories} total={total} />;
}
