import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { services } from '@/composition';
import { Comments } from '@/modules/posts/presentation/comments';
import { AppError } from '@/modules/identity/domain/policy';
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const post = await (await services()).posts.read((await params).slug);
    return {
      title: post.title,
      description: post.excerpt,
      alternates: { canonical: `/posts/${post.slug}` },
    };
  } catch {
    return { title: '글을 찾을 수 없습니다' };
  }
}
export default async function PostDetail({ params }: Props) {
  const { posts } = await services();
  const slug = (await params).slug;
  const post = await posts.read(slug).catch((error) => {
    if (error instanceof AppError && [401, 403, 404].includes(error.status)) return null;
    throw error;
  });
  if (!post) notFound();
  const comments = await posts.comments(post.id);
  return (
    <main id="main-content" className="post-shell">
      <Link
        href="/posts"
        className="mb-10 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={16} />
        모든 글
      </Link>
      <article>
        <header className="mb-10 border-b border-line pb-9">
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <span>{post.categoryName}</span>
            <time dateTime={post.publishedAt || post.createdAt}>
              {(post.publishedAt || post.createdAt).slice(0, 10).replaceAll('-', '.')}
            </time>
            {post.bodyRemoved ? null : <span>{post.readMinutes}분 읽기</span>}
          </div>
          <h1 className="mt-5 text-3xl leading-[1.4] font-bold tracking-[-.045em] sm:text-[40px]">
            {post.title}
          </h1>
          <p className="mt-5 text-sm leading-7 text-muted">{post.excerpt}</p>
          <p className="mt-5 text-xs text-muted">{post.authorName}</p>
        </header>
        {post.bodyRemoved ? (
          <p className="rounded-lg border border-line p-5 text-sm leading-7 text-muted">
            회원 탈퇴 요청에 따라 글 본문이 삭제되었습니다. 다른 회원이 작성한 댓글은 아래에서 볼 수
            있습니다.
          </p>
        ) : (
          <div
            className="content-body sun-editor-editable"
            dangerouslySetInnerHTML={{ __html: post.renderedHtml }}
          />
        )}
        <ul className="mt-10 flex flex-wrap gap-2" aria-label="글 태그">
          {post.tags.map((tag) => (
            <li key={tag}>
              <Link
                href={`/posts?tag=${encodeURIComponent(tag)}`}
                className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs text-muted"
              >
                # {tag}
              </Link>
            </li>
          ))}
        </ul>
      </article>
      <Comments key={post.id} postId={post.id} initialComments={comments} />
    </main>
  );
}
