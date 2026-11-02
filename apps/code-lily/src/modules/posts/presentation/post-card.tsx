import Link from 'next/link';
import type { PostSummary } from '../domain/models';
export function PostCard({ post }: { post: PostSummary }) {
  const date = new Date(post.publishedAt || post.createdAt);
  const reading = post.readMinutes;
  return (
    <article className="group flex min-h-[232px] flex-col rounded-xl border border-line bg-surface p-6 transition-colors hover:border-muted/60">
      <div className="mb-3 flex flex-wrap items-center gap-x-2 text-xs leading-5 text-muted">
        <time dateTime={date.toISOString()}>
          {date.toISOString().slice(0, 10).replaceAll('-', '.')}
        </time>
        <span aria-hidden="true">·</span>
        <span>{reading}분</span>
        {post.categoryName ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{post.categoryName}</span>
          </>
        ) : null}
      </div>
      <h2 className="text-[19px] leading-[1.45] font-bold tracking-[-.035em]">
        <Link
          className="decoration-muted/50 underline-offset-4 group-hover:underline"
          href={`/posts/${post.slug}`}
        >
          {post.title}
        </Link>
      </h2>
      <p className="mt-3 line-clamp-2 text-sm leading-[1.8] text-muted">{post.excerpt}</p>
      <ul aria-label="글 태그" className="mt-auto flex flex-wrap gap-1.5 pt-4">
        {post.tags.slice(0, 4).map((tag) => (
          <li key={tag}>
            <Link
              href={`/posts?tag=${encodeURIComponent(tag)}`}
              className="inline-flex min-h-8 items-center rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-raised"
            >
              # {tag}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
