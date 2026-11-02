'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Category, PostSummary } from '../domain/models';
import { PostCard } from './post-card';
import { EmptyState, Spinner } from '@codelily/ui';
import { useSession } from '@/modules/identity/presentation/session-provider';
import { requestApi } from '@/presentation/client-api';
function QueryObserver({ onChange }: { onChange: (query: string) => void }) {
  const params = useSearchParams();
  const query = params.toString();
  useEffect(() => onChange(query), [query, onChange]);
  return null;
}
export function Archive({
  initialPosts,
  categories,
  total,
}: {
  initialPosts: PostSummary[];
  categories: Category[];
  total: number;
}) {
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState(initialPosts);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { actor } = useSession();
  useEffect(() => {
    let active = true;
    if (!query) {
      setPosts(initialPosts);
      setPending(false);
      setError('');
      return;
    }
    setPending(true);
    setError('');
    requestApi<PostSummary[]>(`/api/posts?${query}`)
      .then((data) => {
        if (active) setPosts(data);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [query, initialPosts]);
  const params = new URLSearchParams(query);
  const category = params.get('category');
  const tag = params.get('tag');
  const search = params.get('q');
  const selected = categories.find((item) => item.slug === category);
  const title = search ? `“${search}” 검색 결과` : tag ? `# ${tag}` : selected?.name || '모든 글';
  const tags = Array.from(new Set(initialPosts.flatMap((post) => post.tags))).slice(0, 15);
  return (
    <main id="main-content" className="page-shell">
      <Suspense>
        <QueryObserver onChange={setQuery} />
      </Suspense>
      <div className="archive-layout">
        <aside aria-label="카테고리와 태그" className="min-w-0">
          <h2 className="mb-4 text-[11px] font-bold tracking-[.12em] text-muted">CATEGORIES</h2>
          <nav aria-label="카테고리">
            <ul className="flex gap-1 overflow-x-auto pb-2 md:block md:space-y-0.5">
              <li>
                <Link
                  aria-current={!category && !tag && !search ? 'page' : undefined}
                  href="/posts"
                  className={`flex min-h-11 shrink-0 items-center justify-between gap-6 rounded-lg px-3 text-sm font-semibold ${!category && !tag && !search ? 'bg-surface text-ink' : 'text-muted hover:text-ink'}`}
                >
                  <span>전체</span>
                  <span className="text-xs text-muted">{total}</span>
                </Link>
              </li>
              {categories.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/posts?category=${item.slug}`}
                    aria-current={category === item.slug ? 'page' : undefined}
                    className={`flex min-h-11 shrink-0 items-center justify-between gap-6 rounded-lg px-3 text-sm font-semibold ${category === item.slug ? 'bg-surface text-ink' : 'text-ink hover:bg-surface'}`}
                  >
                    <span className="whitespace-nowrap">{item.name}</span>
                    <span className="text-xs font-normal text-muted">{item.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-7 hidden border-t border-line pt-5 md:block">
            <h2 className="mb-4 text-[11px] font-bold tracking-[.12em] text-muted">TAGS</h2>
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((item) => (
                <li key={item}>
                  <Link
                    href={`/posts?tag=${encodeURIComponent(item)}`}
                    className={`inline-flex min-h-8 items-center rounded-full border border-line px-2.5 py-1 text-[11px] font-medium ${tag === item ? 'bg-ink text-[var(--cl-base)]' : 'hover:bg-surface'}`}
                  >
                    # {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <section aria-label="글 목록" aria-busy={pending} className="min-w-0">
          <div className="mb-7 flex items-start justify-between gap-4 border-b border-line pb-7">
            <div>
              <p className="mb-3 text-[11px] font-bold tracking-[.12em] text-muted">ARCHIVE</p>
              <h1 className="text-4xl leading-tight font-bold tracking-[-.055em]">{title}</h1>
              <p className="mt-3 text-sm text-muted">
                {search || tag || category ? `${posts.length}편의 기록` : `전체 ${total}편의 기록`}
              </p>
            </div>
            {actor && actor.role !== 'MEMBER' ? (
              <Link
                href="/manage/posts/new"
                className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-[var(--cl-base)]"
              >
                글 쓰기
              </Link>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="mb-6 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {pending ? (
            <div className="mb-5">
              <Spinner label="글을 찾는 중" />
            </div>
          ) : null}
          {posts.length ? (
            <>
              <p className="mb-4 text-xs font-semibold text-muted">
                {new Date(posts[0].publishedAt || posts[0].createdAt).getFullYear()}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="아직 글이 없습니다"
              description="다른 카테고리를 선택하거나 새로운 기록을 기다려주세요."
              action={
                <Link href="/posts" className="underline">
                  모든 글 보기
                </Link>
              }
            />
          )}
          <nav aria-label="글 페이지" className="mt-8 flex gap-5 text-sm">
            {Number(params.get('page') || 1) > 1 ? (
              <Link
                className="flex min-h-11 items-center underline"
                href={`/posts?${new URLSearchParams({ ...Object.fromEntries(params), page: String(Number(params.get('page')) - 1) })}`}
              >
                이전 글
              </Link>
            ) : null}
            {posts.length === 24 ? (
              <Link
                className="flex min-h-11 items-center underline"
                href={`/posts?${new URLSearchParams({ ...Object.fromEntries(params), page: String(Number(params.get('page') || 1) + 1) })}`}
              >
                다음 글
              </Link>
            ) : null}
          </nav>
        </section>
      </div>
    </main>
  );
}
