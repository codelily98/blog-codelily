import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { PostSummary } from '../domain/models';
import { PostDate } from './post-date';

export function PostCard({
  post,
  heading: Heading = 'h2',
  showTags = false,
}: {
  post: PostSummary;
  heading?: 'h2' | 'h3';
  showTags?: boolean;
}) {
  return (
    <article className="publication-entry">
      <div className="publication-entry-meta">
        <span className="font-mono">
          <PostDate value={post.publishedAt || post.createdAt} />
        </span>
        {post.categoryName ? <span>{post.categoryName}</span> : null}
        {post.bodyRemoved ? <span>본문 삭제</span> : null}
      </div>
      <div className="min-w-0">
        <Heading className="publication-entry-title">
          <Link className="publication-entry-link" href={`/posts/${encodeURIComponent(post.slug)}`}>
            {post.title}
            <ArrowRight size={21} strokeWidth={1.6} aria-hidden="true" />
          </Link>
        </Heading>
        {post.excerpt ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted sm:text-[1rem]">
            {post.excerpt}
          </p>
        ) : null}
        {showTags && post.tags.length > 0 ? (
          <ul aria-label="글 태그" className="relative mt-1 flex flex-wrap gap-x-4 text-sm">
            {[...new Set(post.tags)].slice(0, 4).map((tag) => (
              <li key={tag}>
                <Link href={`/posts?tag=${encodeURIComponent(tag)}`} className="publication-link">
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
