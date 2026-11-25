import Link from 'next/link';
import type { RelatedPost } from '../domain/models';

export function RelatedPosts({ posts }: { posts: RelatedPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="related-posts-heading" className="mt-10 border-t border-line pt-6">
      <h2 id="related-posts-heading" className="mb-3 text-lg font-bold">
        관련 글
      </h2>
      <ul role="list" className="grid gap-3 sm:auto-cols-fr sm:grid-flow-col">
        {posts.map((post) => (
          <li key={post.id} className="min-w-0 rounded-lg border border-line bg-surface px-4 py-2">
            <Link
              href={`/posts/${encodeURIComponent(post.slug)}`}
              prefetch={false}
              className="publication-link"
            >
              {post.title}
            </Link>
            {post.excerpt ? (
              <p className="mb-2 break-words text-sm leading-relaxed text-muted">{post.excerpt}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
