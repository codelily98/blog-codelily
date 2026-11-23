import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArrowLeft } from 'lucide-react';
import { services } from '@/composition';
import { Comments } from '@/modules/posts/presentation/comments';
import { PostDate } from '@/modules/posts/presentation/post-date';
import { PostBody } from '@/modules/posts/presentation/post-body';
import { archiveHref } from '@/modules/posts/presentation/archive-query';
import { AppError } from '@/modules/identity/domain/policy';
import { feedPath } from '@/presentation/publication';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };
const publishedPost = cache(async (slug: string) => {
  const { posts } = await services();
  try {
    return await posts.readBySlug(slug);
  } catch (error) {
    if (error instanceof AppError && [401, 403, 404].includes(error.status)) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await publishedPost((await params).slug);
  if (!post) return { title: '글을 찾을 수 없습니다', robots: { index: false } };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/posts/${encodeURIComponent(post.slug)}`,
      types: { 'application/rss+xml': feedPath },
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt || post.createdAt,
      modifiedTime: post.updatedAt,
    },
  };
}

export default async function PostDetail({ params }: Props) {
  const post = await publishedPost((await params).slug);
  if (!post) notFound();

  const { posts } = await services();
  const comments = await posts.comments(post.id).catch((error) => {
    if (error instanceof AppError && [401, 403, 404].includes(error.status)) notFound();
    throw error;
  });
  return (
    <main id="main-content" className="post-shell publication-reader">
      <Link href="/posts" className="publication-link mb-7 text-sm sm:mb-10">
        <ArrowLeft size={17} aria-hidden="true" /> 모든 글
      </Link>
      <article>
        <header className="mb-9 border-b border-line pb-8">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-accent">
            <span className="font-mono">
              <PostDate value={post.publishedAt || post.createdAt} />
            </span>
            {post.categoryName ? <span>{post.categoryName}</span> : null}
            {post.bodyRemoved ? null : <span>{post.readMinutes}분 읽기</span>}
          </div>
          <h1 className="publication-post-title mt-4">{post.title}</h1>
          {post.excerpt ? (
            <p className="mt-5 text-[1rem] leading-8 text-muted sm:text-lg">{post.excerpt}</p>
          ) : null}
          <p className="mt-5 text-sm text-muted">{post.authorName}</p>
        </header>
        {post.bodyRemoved ? (
          <p className="rounded-lg border border-line p-5 text-sm leading-7 text-muted">
            회원 탈퇴 요청에 따라 글 본문이 삭제되었습니다. 다른 회원이 작성한 댓글은 아래에서 볼 수
            있습니다.
          </p>
        ) : (
          <PostBody renderedHtml={post.renderedHtml} />
        )}
        {post.tags.length > 0 ? (
          <ul
            className="mt-8 flex flex-wrap gap-x-5 border-t border-line pt-3 text-sm"
            aria-label="글 태그"
          >
            {[...new Set(post.tags)].map((tag) => (
              <li key={tag}>
                <Link href={archiveHref({ tag })} className="publication-link">
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
      <Comments key={post.id} postId={post.id} initialComments={comments} />
    </main>
  );
}
