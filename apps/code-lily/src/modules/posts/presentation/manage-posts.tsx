'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, EmptyState, useToast } from '@codelily/ui';
import { Plus, ArrowUpRight, Pencil } from 'lucide-react';
import type { PostSummary } from '../domain/models';
import { requestApi } from '@/presentation/client-api';
export function ManagePosts({ posts }: { posts: PostSummary[] }) {
  const [deleting, setDeleting] = useState<PostSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          Posts 관리 <span className="ml-2 text-sm font-normal text-muted">{posts.length}편</span>
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
                <div className="mb-2 flex gap-3 text-xs text-muted">
                  <span>{post.status === 'PUBLISHED' ? '공개' : '초안'}</span>
                  <span>{post.categoryName || '미분류'}</span>
                </div>
                <Link
                  href={`/manage/posts/${post.id}`}
                  className="text-base font-semibold hover:underline"
                >
                  {post.title}
                </Link>
              </div>
              <div className="flex items-center gap-1">
                {post.status === 'PUBLISHED' ? (
                  <Link
                    href={`/posts/${post.slug}`}
                    className="inline-flex min-h-11 items-center gap-1 px-3 text-xs text-muted"
                  >
                    보기
                    <ArrowUpRight size={14} />
                  </Link>
                ) : null}
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
              </div>
            </li>
          ))}
        </ul>
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
