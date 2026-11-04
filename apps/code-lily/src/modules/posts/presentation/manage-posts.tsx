'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, EmptyState, useToast } from '@codelily/ui';
import { Plus, ArrowUpRight, Pencil } from 'lucide-react';
import type { PostSummary } from '../domain/models';
import { requestApi } from '@/presentation/client-api';
export function ManagePosts({
  posts,
  canManageWithdrawn,
  withdrawn,
}: {
  posts: PostSummary[];
  canManageWithdrawn: boolean;
  withdrawn: boolean;
}) {
  const [deleting, setDeleting] = useState<PostSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  async function changeVisibility(post: PostSummary) {
    if (busy || refreshing) return;
    const status = post.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setBusy(true);
    try {
      await requestApi(`/api/posts/${post.id}`, 'PATCH', { status });
      startTransition(() => router.refresh());
      toast(status === 'PUBLISHED' ? '글을 공개했습니다.' : '글을 비공개로 전환했습니다.');
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          {withdrawn ? '탈퇴 회원 글 관리' : 'Posts 관리'}{' '}
          <span className="ml-2 text-sm font-normal text-muted">{posts.length}편</span>
        </h2>
        <Link
          href="/manage/posts/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-[var(--cl-base)]"
        >
          <Plus size={16} />새 글 작성
        </Link>
      </div>
      {posts.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {posts.map((post) => (
            <li key={post.id} className="flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted">
                  <span>
                    {post.status === 'PUBLISHED'
                      ? '공개'
                      : post.authorId === null
                        ? '비공개'
                        : '초안'}
                  </span>
                  <span>{post.categoryName || '미분류'}</span>
                  {post.authorId === null ? <span>탈퇴한 회원</span> : null}
                  {post.bodyRemoved ? <span>본문 삭제 · 댓글 보존</span> : null}
                </div>
                {post.bodyRemoved ? (
                  <span className="text-[1rem] font-semibold text-ink">{post.title}</span>
                ) : (
                  <Link
                    href={`/manage/posts/${post.id}`}
                    className="text-[1rem] font-semibold text-ink hover:underline"
                  >
                    {post.title}
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {post.status === 'PUBLISHED' ? (
                  <Link
                    href={`/posts/${post.slug}`}
                    className="inline-flex min-h-11 items-center gap-1 px-3 text-xs text-muted"
                  >
                    보기
                    <ArrowUpRight size={14} />
                  </Link>
                ) : null}
                {canManageWithdrawn && post.authorId === null ? (
                  <Button
                    variant="secondary"
                    className="px-3 text-xs aria-disabled:opacity-60"
                    aria-label={`${post.title} ${post.status === 'PUBLISHED' ? '비공개로 전환' : '공개로 전환'}`}
                    aria-disabled={busy || refreshing}
                    onClick={() => void changeVisibility(post)}
                  >
                    {post.status === 'PUBLISHED' ? '비공개로 전환' : '공개로 전환'}
                  </Button>
                ) : null}
                {post.bodyRemoved ? null : (
                  <>
                    <Link
                      href={`/manage/posts/${post.id}`}
                      className="inline-flex min-h-11 items-center gap-1 px-3 text-xs"
                    >
                      <Pencil size={14} />
                      수정
                    </Link>
                    <Button
                      variant="ghost"
                      className="px-3 text-xs text-danger"
                      onClick={() => setDeleting(post)}
                    >
                      삭제
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : withdrawn ? (
        <EmptyState
          title="이 페이지에 탈퇴 회원 글이 없습니다"
          description="공개 여부를 관리할 글이 여기에 표시됩니다."
        />
      ) : (
        <EmptyState
          title="첫 번째 기록을 남겨보세요"
          description="카테고리를 만들고 새로운 글을 작성할 수 있습니다."
        />
      )}
      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title="글 삭제">
        <p className="text-sm leading-7">
          “{deleting?.title}” 글과 댓글을 삭제합니다. 계속하시겠습니까?
        </p>
        <div className="mt-6 flex gap-3">
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (!deleting) return;
              setBusy(true);
              try {
                await requestApi(`/api/posts/${deleting.id}`, 'DELETE');
                setDeleting(null);
                router.refresh();
                toast('글을 삭제했습니다.');
              } catch (error) {
                toast((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            삭제
          </Button>
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            취소
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
