import type { MetadataRoute } from 'next';
import { services } from '@/composition';
import { publicationUrl } from '@/presentation/publication';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = publicationUrl();
  const pages = ['/', '/posts', '/about'].map((path) => ({ url: new URL(path, site).href }));
  const entries = await (await services()).posts.sitemapEntries();
  return [
    ...pages,
    ...entries.map((post) => ({
      url: new URL(`/posts/${encodeURIComponent(post.slug)}`, site).href,
      lastModified: post.updatedAt,
    })),
  ];
}
