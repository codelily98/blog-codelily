import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { services } from '@/composition';
import { Archive } from '@/modules/posts/presentation/archive';
import { archivePageSize, archiveQuery } from '@/modules/posts/presentation/archive-query';

export const metadata: Metadata = { title: '모든 글' };

export default async function PostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ archive?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [route, search] = await Promise.all([params, searchParams]);
  if (route.archive?.length) notFound();
  const filters = archiveQuery((key) => {
    const value = search[key];
    return Array.isArray(value) ? value[0] : value;
  });

  const { posts } = await services();
  const [records, categories, total] = await Promise.all([
    posts.list({
      ...filters,
      limit: archivePageSize + 1,
      offset: (filters.page - 1) * archivePageSize,
    }),
    posts.categories(),
    posts.publishedCount(),
  ]);
  return <Archive records={records} categories={categories} total={total} filters={filters} />;
}
