import Link from 'next/link';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { Category, PostSummary } from '../domain/models';
import { PostCard } from './post-card';
import { archiveHref, archiveLastPage, archivePageSize, type ArchiveQuery } from './archive-query';

export function Archive({
  records,
  categories,
  total,
  filters,
}: {
  records: PostSummary[];
  categories: Category[];
  total: number;
  filters: ArchiveQuery;
}) {
  const { category, tag, q, page } = filters;
  const selected = categories.find((item) => item.slug === category);
  const title = q ? `“${q}” 검색 결과` : tag ? `#${tag}` : selected?.name || '모든 글';
  const hasFilters = Boolean(category || tag || q);
  const hasNext = page < archiveLastPage && records.length > archivePageSize;

  return (
    <main id="main-content" className="publication-shell pt-9 sm:pt-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-b border-line pb-6">
        <div className="min-w-0">
          <h1 className="publication-post-title">{title}</h1>
          {!hasFilters ? <p className="mt-3 text-sm text-muted">전체 {total}편</p> : null}
          {q && (selected || tag) ? (
            <p className="mt-3 text-sm text-muted">
              {selected?.name}
              {tag ? ` #${tag}` : ''}
            </p>
          ) : null}
        </div>
        <form
          action="/posts"
          role="search"
          aria-label="아카이브 검색"
          className="flex w-full gap-2 sm:max-w-sm"
        >
          <label htmlFor="archive-search" className="sr-only">
            제목과 요약 검색
          </label>
          <input
            key={q}
            id="archive-search"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={100}
            placeholder="제목과 요약 검색"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 text-sm"
          />
          {category ? <input type="hidden" name="category" value={category} /> : null}
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          <button
            type="submit"
            className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-surface"
          >
            <Search size={16} aria-hidden="true" /> 검색
          </button>
        </form>
      </header>
      <div className="archive-layout">
        <aside className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold">카테고리</h2>
          <nav aria-label="카테고리">
            <ul className="flex gap-2 overflow-x-auto pb-2 md:block md:space-y-1">
              <li>
                <Link
                  aria-current={!hasFilters ? 'page' : undefined}
                  href="/posts"
                  className="flex min-h-11 items-center justify-between gap-4 whitespace-nowrap rounded-lg px-3 text-sm hover:bg-surface aria-[current=page]:bg-surface aria-[current=page]:font-bold"
                >
                  전체 <span className="text-xs text-muted">{total}</span>
                </Link>
              </li>
              {categories.map((item) => (
                <li key={item.id}>
                  <Link
                    href={archiveHref({ category: item.slug })}
                    aria-current={category === item.slug ? 'page' : undefined}
                    className="flex min-h-11 items-center justify-between gap-4 whitespace-nowrap rounded-lg px-3 text-sm hover:bg-surface aria-[current=page]:bg-surface aria-[current=page]:font-bold"
                  >
                    {item.name} <span className="text-xs text-muted">{item.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {hasFilters ? (
            <Link href="/posts" className="publication-link text-sm">
              필터 지우기
            </Link>
          ) : null}
        </aside>
        <section aria-label="글 목록" className="min-w-0">
          {records.length > 0 ? (
            <div className="divide-y divide-line border-y border-line">
              {records.slice(0, archivePageSize).map((post) => (
                <PostCard key={post.id} post={post} showTags />
              ))}
            </div>
          ) : (
            <div className="border-y border-line py-8 text-muted">
              <p>
                {hasFilters || page > 1
                  ? '조건에 맞는 글이 없습니다.'
                  : '아직 공개된 글이 없습니다.'}
              </p>
              {hasFilters || page > 1 ? (
                <Link href="/posts" className="publication-link text-sm">
                  모든 글 보기
                </Link>
              ) : null}
            </div>
          )}
          {page > 1 || hasNext ? (
            <nav
              aria-label="글 페이지"
              className="mt-4 flex flex-wrap items-center justify-between gap-x-4 text-sm"
            >
              {page > 1 ? (
                <Link
                  className="publication-link"
                  href={archiveHref({ ...filters, page: page - 1 })}
                >
                  <ChevronLeft size={16} aria-hidden="true" /> 이전
                </Link>
              ) : null}
              <span className="text-muted">{page}페이지</span>
              {hasNext ? (
                <Link
                  className="publication-link"
                  href={archiveHref({ ...filters, page: page + 1 })}
                >
                  다음 <ChevronRight size={16} aria-hidden="true" />
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
