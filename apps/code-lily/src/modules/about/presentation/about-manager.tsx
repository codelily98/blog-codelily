'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Button, Dialog, Field, Input, Select, Spinner, useToast } from '@codelily/ui';
import type { AboutInput, AboutSection, AboutItem } from '../domain/models';
import { requestApi } from '@/presentation/client-api';
import { R2ImageUpload } from '@/presentation/r2-image-upload';
const ContentEditor = dynamic(
  () => import('@codelily/editor').then((module) => module.ContentEditor),
  { ssr: false, loading: () => <Spinner label="편집기 불러오는 중" /> },
);
const kindLabels = {
  INTRO: '소개',
  EXPERIENCE: '경력',
  INTERESTS: '관심사',
  CONTACT: '연락처',
  CUSTOM: '자유 항목',
};
const initial = (): AboutInput => ({
  kind: 'CUSTOM',
  title: '',
  subtitle: '',
  source: '',
  format: 'HTML',
  items: [],
  sortOrder: 10,
  published: true,
});
export function AboutManager({ sections }: { sections: AboutSection[] }) {
  const [form, setForm] = useState<AboutInput>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<AboutSection | null>(null);
  const toast = useToast();
  const router = useRouter();
  const field = <K extends keyof AboutInput>(key: K, value: AboutInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updateItem = (index: number, key: keyof AboutItem, value: string) =>
    field(
      'items',
      form.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">About 항목 관리</h2>
        <Button
          variant="secondary"
          onClick={() => {
            setForm(initial());
            setError('');
          }}
        >
          새 항목
        </Button>
      </div>
      <ul className="mb-8 grid gap-3 sm:grid-cols-2">
        {sections.map((section) => (
          <li
            key={section.id}
            className="flex items-center gap-3 rounded-xl border border-line p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs text-muted">
                {kindLabels[section.kind]} · 순서 {section.sortOrder} ·{' '}
                {section.published ? '공개' : '비공개'}
              </p>
              <p className="truncate text-sm font-semibold">{section.title}</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setForm({ ...section });
                setError('');
              }}
            >
              수정
            </Button>
            <Button variant="ghost" className="text-danger" onClick={() => setDeleting(section)}>
              삭제
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="max-w-4xl space-y-6 border-t border-line pt-7"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            const saved = await requestApi<AboutSection>('/api/about', 'POST', form);
            setForm(saved);
            router.refresh();
            toast('About 항목을 저장했습니다.');
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3 className="text-lg font-bold">{form.id ? '항목 수정' : '항목 등록'}</h3>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="항목 유형" id="about-kind">
            <Select
              id="about-kind"
              value={form.kind}
              onChange={(event) => field('kind', event.target.value as AboutInput['kind'])}
            >
              {Object.entries(kindLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="노출 순서" id="about-order">
            <Input
              id="about-order"
              type="number"
              min={0}
              max={999}
              value={form.sortOrder}
              onChange={(event) => field('sortOrder', Number(event.target.value))}
            />
          </Field>
          <Field label="공개 상태" id="about-published">
            <Select
              id="about-published"
              value={String(form.published)}
              onChange={(event) => field('published', event.target.value === 'true')}
            >
              <option value="true">공개</option>
              <option value="false">비공개</option>
            </Select>
          </Field>
        </div>
        <Field label="제목" id="about-title">
          <Input
            id="about-title"
            value={form.title}
            onChange={(event) => field('title', event.target.value)}
            required
            maxLength={160}
          />
        </Field>
        <Field label="보조 설명" id="about-subtitle">
          <Input
            id="about-subtitle"
            value={form.subtitle}
            onChange={(event) => field('subtitle', event.target.value)}
            maxLength={300}
          />
        </Field>
        <Field label="본문 형식" id="about-format">
          <Select
            id="about-format"
            disabled={Boolean(form.source.trim())}
            value={form.format}
            onChange={(event) => field('format', event.target.value as 'HTML' | 'MARKDOWN')}
          >
            <option value="HTML">HTML</option>
            <option value="MARKDOWN">Markdown</option>
          </Select>
        </Field>
        <ContentEditor
          key={`${form.id || 'new'}-${form.format}`}
          label="About 본문 편집"
          value={form.source}
          format={form.format}
          onChange={(value) => field('source', value)}
        />
        <R2ImageUpload
          onInsert={(url, alt) => {
            const description = alt.replace(/[<>"\[\]]/g, '');
            field(
              'source',
              form.source +
                (form.format === 'MARKDOWN'
                  ? `\n\n![${description}](${url})`
                  : `<p><img src="${url}" alt="${description}"></p>`),
            );
          }}
        />
        {form.kind !== 'INTRO' ? (
          <fieldset className="space-y-4 rounded-xl border border-line p-4">
            <legend className="px-2 text-sm font-semibold">
              {kindLabels[form.kind]}의 세부 항목
            </legend>
            {form.items.map((item, index) => (
              <div key={index} className="grid gap-3 border-b border-line pb-4 sm:grid-cols-2">
                <Field
                  label={form.kind === 'CONTACT' ? '링크 이름' : '이름 / 직무'}
                  id={`item-label-${index}`}
                >
                  <Input
                    id={`item-label-${index}`}
                    value={item.label}
                    onChange={(event) => updateItem(index, 'label', event.target.value)}
                    maxLength={160}
                  />
                </Field>
                <Field label="기간" id={`item-period-${index}`}>
                  <Input
                    id={`item-period-${index}`}
                    placeholder="2024.08 — 현재"
                    value={item.period}
                    onChange={(event) => updateItem(index, 'period', event.target.value)}
                    maxLength={100}
                  />
                </Field>
                <Field label="설명" id={`item-detail-${index}`}>
                  <Input
                    id={`item-detail-${index}`}
                    value={item.detail}
                    onChange={(event) => updateItem(index, 'detail', event.target.value)}
                    maxLength={500}
                  />
                </Field>
                <Field label="링크 URL" id={`item-url-${index}`}>
                  <Input
                    id={`item-url-${index}`}
                    placeholder="https:// 또는 mailto:"
                    value={item.url}
                    onChange={(event) => updateItem(index, 'url', event.target.value)}
                    maxLength={2000}
                  />
                </Field>
                <Button
                  variant="ghost"
                  className="justify-self-start text-danger"
                  onClick={() =>
                    field(
                      'items',
                      form.items.filter((_, i) => i !== index),
                    )
                  }
                >
                  세부 항목 삭제
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              disabled={form.items.length >= 40}
              onClick={() =>
                field('items', [...form.items, { label: '', detail: '', period: '', url: '' }])
              }
            >
              세부 항목 추가
            </Button>
          </fieldset>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? '저장 중…' : '항목 저장'}
        </Button>
      </form>
      <Dialog title="About 항목 삭제" open={Boolean(deleting)} onClose={() => setDeleting(null)}>
        <p className="text-sm">“{deleting?.title}” 항목을 삭제하시겠습니까?</p>
        <div className="mt-6 flex gap-3">
          <Button
            variant="danger"
            onClick={async () => {
              if (!deleting) return;
              try {
                await requestApi('/api/about', 'DELETE', { id: deleting.id });
                setDeleting(null);
                setForm(initial());
                router.refresh();
                toast('항목을 삭제했습니다.');
              } catch (error) {
                toast((error as Error).message);
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
