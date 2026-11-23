export const archivePageSize = 24;
export const archiveLastPage = 400;

export function archiveQuery(value: (key: string) => string | undefined) {
  const page = value('page');
  return {
    q: value('q')?.trim().slice(0, 100) || undefined,
    category: value('category')?.slice(0, 100) || undefined,
    tag: value('tag')?.slice(0, 30) || undefined,
    page: page && /^[1-9][0-9]*$/.test(page) ? Math.min(Number(page), archiveLastPage) : 1,
  };
}

export type ArchiveQuery = ReturnType<typeof archiveQuery>;

export function archiveHref({ q, category, tag, page }: Partial<ArchiveQuery> = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (tag) params.set('tag', tag);
  if (page && page > 1) params.set('page', String(page));
  const search = params.toString();
  return search ? `/posts?${search}` : '/posts';
}
