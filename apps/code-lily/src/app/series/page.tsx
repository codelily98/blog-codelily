import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { services } from '@/composition';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: '시리즈',
  description: '연재 글을 주제별로 모아 읽습니다.',
};

export default async function SeriesArchive({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: requested } = await searchParams;
  const page = requested === undefined ? 1 : Number(requested);
  if (!Number.isInteger(page) || page < 1 || page > 400) notFound();
  const items = await (await services()).posts.publicSeriesPage(page);
  if (page > 1 && !items.length) notFound();
  return (
    <main id="main-content" className="page-shell">
      <h1 className="publication-section-title mb-6">시리즈</h1>
      {items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.slice(0, 24).map((series) => (
            <li key={series.id} className="min-w-0 rounded-lg border border-line bg-surface p-5">
              <h2 className="break-words text-lg font-bold">
                <Link href={`/series/${series.id}`} className="publication-link">
                  {series.name}
                </Link>
              </h2>
              <p className="text-sm text-muted">공개 글 {series.count}편</p>
              <Link
                href={`/posts/${encodeURIComponent(series.firstSlug)}`}
                className="publication-link mt-2 text-sm"
                aria-label={`${series.name} 첫 글 읽기`}
              >
                첫 글 읽기
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">아직 공개된 시리즈가 없습니다.</p>
      )}
      {page > 1 || items.length > 24 ? (
        <nav className="mt-6 flex flex-wrap items-center gap-4 text-sm" aria-label="시리즈 페이지">
          {page > 1 ? (
            <Link
              className="publication-link"
              href={page === 2 ? '/series' : `/series?page=${page - 1}`}
            >
              이전
            </Link>
          ) : null}
          <span>{page}페이지</span>
          {items.length > 24 && page < 400 ? (
            <Link className="publication-link" href={`/series?page=${page + 1}`}>
              다음
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
