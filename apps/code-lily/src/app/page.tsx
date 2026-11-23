import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { services } from '@/composition';
import { PostCard } from '@/modules/posts/presentation/post-card';
import { feedPath, publicationDescription } from '@/presentation/publication';
import lilyCover from './lily-cover.webp';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'code-lily · 기술 블로그' },
  description: publicationDescription,
};

export default async function Home() {
  const { posts } = await services();
  const latest = await posts.list({ limit: 4 });

  return (
    <main id="main-content" className="publication-shell">
      <header className="publication-hero">
        <div>
          <h1 className="publication-display">배운 것을 기록합니다.</h1>
          <p className="mt-6 max-w-xl text-[1rem] leading-relaxed text-muted sm:text-xl">
            {publicationDescription}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-2 sm:mt-7">
            <Link href="/posts" className="publication-link">
              전체 글 보기 <ChevronRight size={17} aria-hidden="true" />
            </Link>
            <a href={feedPath} className="publication-link">
              RSS 구독 <ChevronRight size={17} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="publication-cover">
          <Image src={lilyCover} alt="" unoptimized preload className="publication-cover-photo" />
        </div>
      </header>

      <section aria-labelledby="latest-heading" className="border-t border-line">
        <div className="flex flex-wrap items-center justify-between gap-3 py-5 sm:py-6">
          <h2 id="latest-heading" className="publication-section-title">
            최근 글
          </h2>
          <Link href="/posts" className="publication-link">
            전체 글 <ChevronRight size={17} aria-hidden="true" />
          </Link>
        </div>
        {latest.length > 0 ? (
          <div className="divide-y divide-line border-y border-line">
            {latest.map((post) => (
              <PostCard key={post.id} post={post} heading="h3" />
            ))}
          </div>
        ) : (
          <p className="border-y border-line py-7 text-sm text-muted">아직 공개된 글이 없습니다.</p>
        )}
      </section>

      <section aria-labelledby="member-heading" className="mt-12 max-w-2xl sm:mt-16">
        <h2 id="member-heading" className="text-lg font-semibold">
          댓글과 Work 문서
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          만 14세 이상은 Google 계정으로 가입할 수 있습니다. 로그인하면 댓글을 작성하고 공개된 Work
          문서를 읽을 수 있습니다. Google의 기본 계정 정보는 로그인과 계정 식별에 사용합니다.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-6 text-sm">
          <Link href="/sign-in" className="publication-link">
            Google 로그인 안내
          </Link>
          <Link href="/work" className="publication-link">
            Work 문서 보기
          </Link>
        </div>
      </section>
    </main>
  );
}
