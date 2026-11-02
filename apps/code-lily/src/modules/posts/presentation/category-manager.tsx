'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, Field, Input, useToast } from '@codelily/ui';
import type { Category } from '../domain/models';
import { requestApi } from '@/presentation/client-api';
export function CategoryManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Category | null>(null);
  const toast = useToast();
  const router = useRouter();
  const clear = () => {
    setEditing(null);
    setName('');
    setSlug('');
    setError('');
  };
  return (
    <section className="grid gap-8 md:grid-cols-2">
      <div>
        <h2 className="mb-5 text-xl font-bold">카테고리</h2>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {categories.map((category) => (
            <li key={category.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{category.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {category.slug} · {category.count}편
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(category);
                  setName(category.name);
                  setSlug(category.slug);
                }}
              >
                수정
              </Button>
              <Button variant="ghost" className="text-danger" onClick={() => setDeleting(category)}>
                삭제
              </Button>
            </li>
          ))}
        </ul>
        {!categories.length ? (
          <p className="py-6 text-sm text-muted">아직 카테고리가 없습니다.</p>
        ) : null}
      </div>
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await requestApi('/api/categories', 'POST', { id: editing?.id, name, slug });
            clear();
            router.refresh();
            toast('카테고리를 저장했습니다.');
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-xl font-bold">{editing ? '카테고리 수정' : '카테고리 만들기'}</h2>
        <Field label="이름" id="category-name">
          <Input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
          />
        </Field>
        <Field label="주소" id="category-slug" hint="영문 소문자·숫자·하이픈으로 작성합니다.">
          <Input
            id="category-slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={100}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </Button>
          {editing ? (
            <Button variant="secondary" onClick={clear}>
              새 카테고리
            </Button>
          ) : null}
        </div>
      </form>
      <Dialog title="카테고리 삭제" open={Boolean(deleting)} onClose={() => setDeleting(null)}>
        <p className="text-sm leading-7">
          “{deleting?.name}” 카테고리를 삭제합니다. 포함된 글은 미분류로 유지됩니다.
        </p>
        <div className="mt-6 flex gap-3">
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (!deleting) return;
              setBusy(true);
              try {
                await requestApi('/api/categories', 'DELETE', { id: deleting.id });
                setDeleting(null);
                clear();
                router.refresh();
                toast('카테고리를 삭제했습니다.');
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
