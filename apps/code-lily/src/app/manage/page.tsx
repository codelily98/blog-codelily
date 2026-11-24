import Link from 'next/link';
import { services } from '@/composition';
import { managementActor } from '@/presentation/manage-actor';
import { ManagePosts } from '@/modules/posts/presentation/manage-posts';
import { PostDate } from '@/modules/posts/presentation/post-date';
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
  const [rows, drafts] = await Promise.all([
    withdrawn ? posts.withdrawn(actor, page) : posts.management(actor),
    withdrawn ? [] : posts.listDrafts(actor),
  ]);
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
      {drafts.length ? (
        <section className="mb-8" aria-labelledby="drafts-heading">
          <h2 id="drafts-heading" className="mb-4 text-xl font-bold">
            미발행 초안
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-x-4 px-4 py-1"
              >
                <Link
                  className="publication-link"
                  href={
                    draft.postId
                      ? `/manage/posts/${draft.postId}`
                      : `/manage/posts/new?draft=${draft.id}`
                  }
                >
                  {draft.title || '제목 없는 초안'}
                </Link>
                <span className="text-sm text-muted">
                  {draft.postId ? '기존 글 편집 · ' : ''}
                  <PostDate value={draft.updatedAt} />
                </span>
              </li>
            ))}
          </ul>
        </section>
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
