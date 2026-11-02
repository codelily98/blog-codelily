import Link from 'next/link';
import { managementActor } from '@/presentation/manage-actor';
export const dynamic = 'force-dynamic';
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const actor = await managementActor();
  return (
    <main id="main-content" className="page-shell">
      <header className="mb-8 border-b border-line pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">내 작업 공간</h1>
          <p className="text-xs text-muted">
            {actor.name} · {actor.role}
          </p>
        </div>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="관리 메뉴">
          <Link
            href="/manage"
            className="flex min-h-11 items-center rounded-lg border border-line px-4 text-sm"
          >
            Posts
          </Link>
          <Link
            href="/manage/categories"
            className="flex min-h-11 items-center rounded-lg border border-line px-4 text-sm"
          >
            카테고리
          </Link>
          {actor.role === 'OWNER' ? (
            <>
              <Link
                href="/manage/about"
                className="flex min-h-11 items-center rounded-lg border border-line px-4 text-sm"
              >
                About
              </Link>
              <Link
                href="/manage/analytics"
                className="flex min-h-11 items-center rounded-lg border border-line px-4 text-sm"
              >
                통계 · 발자취 · 로그
              </Link>
              <Link
                href="/manage/users"
                className="flex min-h-11 items-center rounded-lg border border-line px-4 text-sm"
              >
                회원 권한
              </Link>
            </>
          ) : null}
        </nav>
      </header>
      {children}
    </main>
  );
}
