import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArrowLeft } from 'lucide-react';
import { prepareArticleContent } from '@codelily/content/article';
import { services } from '@/composition';
import { Comments } from '@/modules/posts/presentation/comments';
import { PostArticle } from '@/modules/posts/presentation/post-article';
import { SeriesNavigation } from '@/modules/posts/presentation/series-navigation';
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
  const [comments, series] = await Promise.all([
    posts.comments(post.id).catch((error) => {
      if (error instanceof AppError && [401, 403, 404].includes(error.status)) notFound();
      throw error;
    }),
    posts.publicSeries(post),
  ]);
  return (
    <main id="main-content" className="post-shell publication-reader">
      <Link href="/posts" className="publication-link mb-7 text-sm sm:mb-10">
        <ArrowLeft size={17} aria-hidden="true" /> 모든 글
      </Link>
      <PostArticle
        key={`${post.id}:${post.editVersion}`}
        details={{ ...post, date: post.publishedAt || post.createdAt }}
        content={post.bodyRemoved ? null : prepareArticleContent(post.renderedHtml)}
      />
      {series ? <SeriesNavigation {...series} /> : null}
      <Comments key={post.id} postId={post.id} initialComments={comments} />
    </main>
  );
}
