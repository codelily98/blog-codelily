'use client';
import { useState } from 'react';
import { Button, Textarea, useToast } from '@codelily/ui';
import { useRouter } from 'next/navigation';
import type { Comment } from '../domain/models';
import { GoogleLoginButton, useSession } from '@/modules/identity/presentation/session-provider';
import { requestApi } from '@/presentation/client-api';
export function Comments({
  postId,
  initialComments,
}: {
  postId: string;
  initialComments: Comment[];
}) {
  const { actor } = useSession();
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const router = useRouter();
  return (
    <section aria-labelledby="comments-title" className="mt-14 border-t border-line pt-9">
      <h2 id="comments-title" className="text-xl font-bold">
        댓글 <span className="ml-1 text-sm font-normal text-muted">{comments.length}</span>
      </h2>
      {actor ? (
        <form
          className="mt-5 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError('');
            try {
              const comment = await requestApi<Comment>('/api/comments', 'POST', { postId, body });
              setComments((current) => [...current, comment]);
              setBody('');
              toast('댓글을 등록했습니다.');
              router.refresh();
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <label htmlFor="comment-body" className="sr-only">
            댓글 내용
          </label>
          <Textarea
            id="comment-body"
            placeholder="생각을 나눠주세요. 서로를 존중하는 대화를 부탁드립니다."
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            maxLength={2000}
          />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={saving}>
            {saving ? '등록 중…' : '댓글 등록'}
          </Button>
        </form>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-line p-5">
          <p className="text-sm text-muted">Google 계정으로 로그인하면 댓글을 남길 수 있습니다.</p>
          <GoogleLoginButton />
        </div>
      )}
      <ul className="mt-6 divide-y divide-line">
        {comments.map((comment) => (
          <li key={comment.id} className="py-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold">{comment.authorName}</span>
              <time dateTime={comment.createdAt} className="text-xs text-muted">
                {new Date(comment.createdAt).toLocaleDateString('ko-KR', {
                  timeZone: 'Asia/Seoul',
                })}
              </time>
              {actor && (actor.id === comment.authorId || actor.role === 'OWNER') ? (
                <Button
                  variant="ghost"
                  className="ml-auto px-2 text-xs"
                  onClick={async () => {
                    try {
                      await requestApi('/api/comments', 'DELETE', { id: comment.id });
                      setComments((current) => current.filter((item) => item.id !== comment.id));
                      toast('댓글을 삭제했습니다.');
                    } catch (error) {
                      toast((error as Error).message);
                    }
                  }}
                >
                  삭제
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-7 whitespace-pre-wrap">{comment.body}</p>
          </li>
        ))}
      </ul>
      {!comments.length ? (
        <p className="mt-6 text-sm text-muted">첫 번째 생각을 남겨주세요.</p>
      ) : null}
    </section>
  );
}
