import type { PostSummary } from '../domain/models';
import { feedPath, publicationDescription, publicationName } from '@/presentation/publication';

const xmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function xmlText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replace(/[&<>"']/g, (character) => xmlEntities[character]);
}

export function renderFeed(site: string, posts: PostSummary[]) {
  const home = new URL('/', site).href;
  const feed = new URL(feedPath, site).href;
  const items = posts.map((post) => {
    const link = new URL(`/posts/${encodeURIComponent(post.slug)}`, site).href;
    return `    <item>
      <title>${xmlText(post.title)}</title>
      <link>${xmlText(link)}</link>
      <guid isPermaLink="false">urn:uuid:${xmlText(post.id)}</guid>
      <description>${xmlText(xmlText(post.excerpt))}</description>
      <pubDate>${new Date(post.publishedAt || post.createdAt).toUTCString()}</pubDate>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${publicationName}</title>
    <link>${xmlText(home)}</link>
    <atom:link href="${xmlText(feed)}" rel="self" type="application/rss+xml" />
    <description>${publicationDescription}</description>
    <language>ko</language>
${items.join('\n')}
  </channel>
</rss>
`;
}
