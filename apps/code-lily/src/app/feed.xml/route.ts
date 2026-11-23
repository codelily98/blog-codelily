import { services } from '@/composition';
import { renderFeed } from '@/modules/posts/presentation/feed';
import { publicationUrl } from '@/presentation/publication';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { posts } = await services();
  return new Response(renderFeed(publicationUrl(), await posts.list({ limit: 24 })), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, no-cache',
    },
  });
}
