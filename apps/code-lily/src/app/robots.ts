import type { MetadataRoute } from 'next';
import { publicationUrl } from '@/presentation/publication';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: new URL('/sitemap.xml', publicationUrl()).href,
  };
}
