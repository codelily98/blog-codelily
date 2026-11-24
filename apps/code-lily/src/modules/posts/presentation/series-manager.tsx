'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, Field, Input, useToast } from '@codelily/ui';
import { requestApi } from '@/presentation/client-api';
import type { PostSeries } from '../domain/models';

export function SeriesManager({ series }: { series: PostSeries[] }) {
  const [editing, setEditing] = useState<PostSeries | null>(null);
  const [deleting, setDeleting] = useState<PostSeries | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const toast = useToast();

  function select(item: PostSeries | null) {
    setEditing(item);
    setName(item?.name ?? '');
    setError('');
  }

  return (
    <section className="grid gap-8 md:grid-cols-2" aria-labelledby="series-manager-heading">
      <div>
        <h2 id="series-manager-heading" className="mb-4 text-xl font-bold">
          시리즈
        </h2>
        <p className="mb-4 text-sm text-muted">
          시리즈를 만든 뒤 글 편집 화면에서 시리즈와 순서를 지정할 수 있습니다.
        </p>
        {series.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {series.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 p-4">
                <span className="min-w-0 flex-1 break-words font-semibold">{item.name}</span>
                <Button
                  variant="ghost"
                  disabled={busy}
                  aria-label={`${item.name} 수정`}
                  onClick={() => select(item)}
                >
                  수정
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  className="text-danger"
                  aria-label={`${item.name} 삭제`}
                  onClick={() => {
                    setError('');
                    setDeleting(item);
                  }}
                >
                  삭제
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">아직 시리즈가 없습니다.</p>
        )}
      </div>
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await requestApi('/api/post-series', 'POST', { id: editing?.id, name });
            select(null);
            router.refresh();
            toast('시리즈를 저장했습니다.');
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-xl font-bold">{editing ? '시리즈 수정' : '새 시리즈 만들기'}</h2>
        <Field label="시리즈 이름" id="series-name">
          <Input
            id="series-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
          />
        </Field>
        {error && !deleting ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            저장
          </Button>
          {editing ? (
            <Button variant="secondary" disabled={busy} onClick={() => select(null)}>
              수정 취소
            </Button>
          ) : null}
        </div>
      </form>
      <Dialog
        title="시리즈 삭제"
        open={Boolean(deleting)}
        onClose={() => {
          setError('');
          setDeleting(null);
        }}
      >
        <p className="text-sm leading-7">“{deleting?.name}” 시리즈를 삭제할까요?</p>
        {error && deleting ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button
          variant="danger"
          className="mt-5"
          disabled={busy}
          onClick={async () => {
            if (!deleting) return;
            setBusy(true);
            setError('');
            try {
              await requestApi('/api/post-series', 'DELETE', { id: deleting.id });
              if (editing?.id === deleting.id) select(null);
              setDeleting(null);
              router.refresh();
              toast('시리즈를 삭제했습니다.');
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          삭제
        </Button>
      </Dialog>
    </section>
  );
}
