import Link from 'next/link';
import { services } from '@/composition';
import { managementActor } from '@/presentation/manage-actor';
import { ManagePosts } from '@/modules/posts/presentation/manage-posts';
export default async function Manage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const [actor, params] = await Promise.all([managementActor(), searchParams]);
  const canManageWithdrawn = actor.role === 'OWNER';
  const withdrawn = canManageWithdrawn && params.view === 'withdrawn';
  const requestedPage = Number(params.page);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(401, requestedPage) : 1;
  const { posts } = await services();
  const rows = await (withdrawn ? posts.withdrawn(actor, page) : posts.management(actor));
  const navigationLink =
    'inline-flex min-h-11 items-center px-2 text-sm font-semibold underline underline-offset-4';
  return (
    <>
      {canManageWithdrawn ? (
        <nav aria-label="글 관리 보기" className="mb-4 flex flex-wrap gap-3">
          <Link
            href="/manage"
            aria-current={withdrawn ? undefined : 'page'}
            className={navigationLink}
          >
            전체 글
          </Link>
          <Link
            href="/manage?view=withdrawn"
            aria-current={withdrawn ? 'page' : undefined}
            className={navigationLink}
          >
            탈퇴 회원 글
          </Link>
        </nav>
      ) : null}
      <ManagePosts
        posts={withdrawn ? rows.slice(0, 25) : rows}
        canManageWithdrawn={canManageWithdrawn}
        withdrawn={withdrawn}
      />
      {withdrawn && (page > 1 || rows.length > 25) ? (
        <nav aria-label="탈퇴 회원 글 페이지" className="mt-4 flex items-center gap-4">
          {page > 1 ? (
            <Link className={navigationLink} href={`/manage?view=withdrawn&page=${page - 1}`}>
              이전
            </Link>
          ) : null}
          <span className="text-sm text-muted">{page}페이지</span>
          {rows.length > 25 && page < 401 ? (
            <Link className={navigationLink} href={`/manage?view=withdrawn&page=${page + 1}`}>
              다음
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
