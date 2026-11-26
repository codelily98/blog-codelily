'use client';
import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  Dialog,
  EditorActions,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '@codelily/ui';
import type { Post, Category, PostDraft, PostReaderDetails, PostSeries } from '../domain/models';
import { ApiError, requestApi } from '@/presentation/client-api';
import { R2ImageUpload } from '@/presentation/r2-image-upload';
import { PostArticle } from './post-article';
import type { ArticleContent } from './post-body';
import { draftArticleInput } from './draft-fields';
import { usePostDraft } from './use-post-draft';

type Preview = { details: PostReaderDetails; content: ArticleContent };
const saveTime = new Intl.DateTimeFormat('ko-KR', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Seoul',
});

const ContentEditor = dynamic(
  () => import('@codelily/editor').then((module) => module.ContentEditor),
  { ssr: false, loading: () => <Spinner label="편집기 불러오는 중" /> },
);
export function PostEditor({
  post,
  draft,
  categories,
  seriesOptions,
}: {
  post?: Post;
  draft?: PostDraft;
  categories: Category[];
  seriesOptions: PostSeries[];
}) {
  const [acting, setActing] = useState(false);
  const editor = usePostDraft(post, draft, acting);
  const { fields, change } = editor;
  const { title, slug, excerpt, source, format, categoryId, seriesId, seriesPosition, tagsText } =
    fields;
  const [baseConflict, setBaseConflict] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewButton = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const router = useRouter();
  const published = post?.status === 'PUBLISHED';
  const baseChanged = post && editor.baseVersion !== post.editVersion;
  const editHref = post ? `/manage/posts/${post.id}` : `/manage/posts/new?draft=${editor.id}`;
  const time = editor.updatedAt ? saveTime.format(new Date(editor.updatedAt)) : '';
  const statusText = {
    idle: '편집을 시작하면 초안이 자동으로 저장됩니다.',
    pending: '초안 저장 대기 중',
    saving: '초안 저장 중…',
    saved: `초안 저장됨 · ${time}`,
    error: '초안을 저장하지 못했습니다.',
    conflict: '다른 탭에서 초안이 변경되었습니다.',
  }[editor.status];
  const saveDisabled =
    acting || editor.composing || editor.status === 'saving' || editor.status === 'conflict';
  const formatLocked = Boolean(source.trim());

  async function runAction(operation: () => Promise<void>) {
    if (acting) return;
    setActing(true);
    setError('');
    try {
      await operation();
    } catch (error) {
      setError((error as Error).message);
      setBaseConflict(
        error instanceof ApiError &&
          ['POST_BASE_CONFLICT', 'POST_DRAFT_CONFLICT', 'NOT_FOUND'].includes(error.code ?? ''),
      );
    } finally {
      setActing(false);
    }
  }

  async function publish() {
    if (
      baseChanged &&
      !window.confirm('편집을 시작한 뒤 기존 글이 변경됐습니다. 현재 초안을 발행하시겠습니까?')
    )
      return;
    await runAction(async () => {
      const saved = await editor.flush(true);
      if (!saved) return;
      const result = await requestApi<{ id: string }>(`/api/post-drafts/${saved.id}`, 'POST', {
        version: saved.version,
        postVersion: post?.editVersion ?? null,
        confirmBase: Boolean(baseChanged),
      });
      toast('글을 발행했습니다.');
      router.replace(`/manage/posts/${result.id}`);
      router.refresh();
    });
  }
  return (
    <section className="min-w-0">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-4 sm:mb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {post ? '글 수정' : '새 글 작성'}
        </h1>
        <Link href="/manage" className="publication-link text-sm">
          목록으로
        </Link>
      </header>
      <form
        className="space-y-4 sm:space-y-6"
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (
            !(event.ctrlKey || event.metaKey) ||
            event.altKey ||
            event.shiftKey ||
            event.key.toLowerCase() !== 's'
          )
            return;
          event.preventDefault();
          if (!saveDisabled && !event.nativeEvent.isComposing) void editor.flush(true);
        }}
      >
        <EditorActions
          status={
            <p role="status" aria-label="초안 저장 상태" className="text-sm text-muted">
              {statusText}
            </p>
          }
        >
          <Button
            variant="secondary"
            disabled={saveDisabled}
            aria-keyshortcuts="Control+S Meta+S"
            onClick={() => void editor.flush(true)}
          >
            {editor.status === 'error' ? '저장 재시도' : '초안 저장'}
          </Button>
          <Button
            variant="secondary"
            disabled={acting}
            aria-disabled={previewing || undefined}
            onClick={async (event) => {
              if (previewing) return;
              previewButton.current = event.currentTarget;
              setPreviewing(true);
              setError('');
              try {
                const result = await requestApi<Preview>('/api/content/post-preview', 'POST', {
                  ...draftArticleInput(fields),
                  id: post?.id,
                });
                setPreview(result);
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setPreviewing(false);
              }
            }}
          >
            {previewing ? '미리보기 준비 중…' : '발행 화면 미리보기'}
          </Button>
          <Button
            disabled={acting || previewing || editor.composing || editor.status === 'conflict'}
            onClick={(event) => {
              if (event.currentTarget.form?.reportValidity()) void publish();
            }}
          >
            {acting ? '처리 중…' : published ? '수정본 발행' : '발행'}
          </Button>
        </EditorActions>
        {published ? (
          <p className="text-sm text-muted">수정 내용은 수정본을 발행할 때 공개 글에 반영됩니다.</p>
        ) : null}
        {baseChanged ? (
          <p className="text-sm text-muted">
            초안을 저장한 이후 기존 글이 변경되었습니다. 발행 전에 현재 글을 확인해주세요.
          </p>
        ) : null}
        {error || editor.saveError ? (
          <p role="alert" className="rounded-lg border border-danger/40 p-4 text-sm text-danger">
            {error || editor.saveError}
          </p>
        ) : null}
        {editor.status === 'conflict' || baseConflict ? (
          <Link href={editHref} target="_blank" className="publication-link text-sm">
            최신 편집 화면 열기 (새 탭)
          </Link>
        ) : null}
        <fieldset
          disabled={acting}
          inert={acting}
          className="min-w-0"
          onCompositionStart={() => editor.setComposing(true)}
          onCompositionEnd={() => editor.setComposing(false)}
        >
          <legend className="sr-only">글 작성 내용</legend>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,3fr)]">
            <div className="min-w-0 space-y-4 sm:space-y-5">
              <Field label="제목" id="post-title">
                <Input
                  id="post-title"
                  className="h-12 font-semibold sm:h-14 sm:text-xl"
                  placeholder="글 제목을 입력하세요"
                  value={title}
                  onChange={(event) => change('title', event.target.value)}
                  required
                  maxLength={160}
                />
              </Field>
              <section aria-labelledby="post-body-heading" className="min-w-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 id="post-body-heading" className="text-[1rem] font-semibold text-ink">
                    본문
                  </h2>
                  <div className="w-fit min-w-0">
                    <label className="sr-only" htmlFor="post-format">
                      원본 형식
                    </label>
                    <Select
                      id="post-format"
                      aria-describedby="post-format-hint"
                      value={format}
                      disabled={formatLocked}
                      onChange={(event) =>
                        change('format', event.target.value as 'HTML' | 'MARKDOWN')
                      }
                    >
                      <option value="MARKDOWN">Markdown · 원본 편집</option>
                      <option value="HTML">HTML · 서식 편집</option>
                    </Select>
                    <p id="post-format-hint" className="sr-only">
                      본문이 비어 있을 때 형식을 바꿀 수 있습니다.
                    </p>
                  </div>
                </div>
                <ContentEditor
                  value={source}
                  onChange={(value) => change('source', value)}
                  format={format}
                />
              </section>
              <R2ImageUpload
                onInsert={(url, alt) => {
                  const safeAlt = alt.replace(/[<>"\[\]]/g, '');
                  editor.appendSource(
                    format === 'MARKDOWN'
                      ? `\n\n![${safeAlt}](${url})`
                      : `<p><img src="${url}" alt="${safeAlt}"></p>`,
                  );
                }}
              />
            </div>
            <section
              aria-labelledby="post-settings-heading"
              className="min-w-0 space-y-5 rounded-xl border border-line bg-surface p-4 sm:p-5"
            >
              <h2 id="post-settings-heading" className="text-[1rem] font-semibold text-ink">
                게시 설정
              </h2>
              <Field
                label="글 주소"
                id="post-slug"
                hint="영문 소문자·숫자·하이픈. 예: nextjs-architecture"
              >
                <div className="flex gap-2">
                  <Input
                    id="post-slug"
                    className="min-w-0"
                    aria-describedby="post-slug-hint"
                    value={slug}
                    onChange={(event) => change('slug', event.target.value)}
                    required
                    maxLength={100}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  />
                  <Button
                    variant="secondary"
                    className="shrink-0 px-3"
                    aria-label="글 주소 생성"
                    onClick={() => change('slug', `post-${crypto.randomUUID().slice(0, 8)}`)}
                  >
                    생성
                  </Button>
                </div>
              </Field>
              <Field label="카테고리" id="post-category">
                <Select
                  id="post-category"
                  value={categoryId ?? ''}
                  onChange={(event) => change('categoryId', event.target.value || null)}
                >
                  <option value="">미분류</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {seriesOptions.length || seriesId ? (
                <>
                  <Field label="시리즈" id="post-series">
                    <Select
                      id="post-series"
                      value={seriesId ?? ''}
                      onChange={(event) => change('seriesId', event.target.value || null)}
                    >
                      <option value="">시리즈 없음</option>
                      {seriesOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {seriesId ? (
                    <Field label="시리즈 순서" id="post-series-position">
                      <Input
                        id="post-series-position"
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        required
                        value={seriesPosition}
                        onChange={(event) => change('seriesPosition', event.target.value)}
                      />
                    </Field>
                  ) : null}
                </>
              ) : null}
              <Field label="요약" id="post-excerpt" hint="비워두면 본문에서 자동으로 생성합니다.">
                <Textarea
                  id="post-excerpt"
                  aria-describedby="post-excerpt-hint"
                  value={excerpt}
                  onChange={(event) => change('excerpt', event.target.value)}
                  maxLength={300}
                />
              </Field>
              <Field label="태그" id="post-tags" hint="쉼표로 구분, 최대 10개">
                <Input
                  id="post-tags"
                  aria-describedby="post-tags-hint"
                  value={tagsText}
                  onChange={(event) => change('tagsText', event.target.value)}
                  maxLength={320}
                />
              </Field>
            </section>
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4">
          {published ? (
            <Link
              href={`/posts/${post.slug}`}
              target="_blank"
              className="inline-flex min-h-11 items-center px-3 text-sm underline"
            >
              공개 글 보기 (새 탭)
            </Link>
          ) : null}
          {published ? (
            <Button
              variant="ghost"
              disabled={acting || editor.composing}
              onClick={() => {
                if (!window.confirm('이 글을 비공개로 전환하시겠습니까?')) return;
                void runAction(async () => {
                  if (
                    ['pending', 'saving', 'error', 'conflict'].includes(editor.status) &&
                    !(await editor.flush())
                  )
                    return;
                  await requestApi(`/api/post-drafts/${post.id}`, 'PATCH', {
                    postVersion: post.editVersion,
                  });
                  window.location.assign(editHref);
                });
              }}
            >
              공개 해제
            </Button>
          ) : null}
          {editor.version && editor.status !== 'conflict' ? (
            <Button
              variant="ghost"
              className="text-danger"
              disabled={acting || editor.status === 'saving'}
              onClick={() => {
                if (!window.confirm('이 편집 초안을 삭제하시겠습니까?')) return;
                void runAction(async () => {
                  await requestApi(`/api/post-drafts/${editor.id}`, 'DELETE', {
                    version: editor.version,
                  });
                  editor.allowExit();
                  window.location.assign(post ? editHref : '/manage');
                });
              }}
            >
              초안 삭제
            </Button>
          ) : null}
        </div>
      </form>
      <Dialog
        title="발행 화면 미리보기"
        wide
        returnFocusRef={previewButton}
        open={preview !== null}
        onClose={() => setPreview(null)}
      >
        {preview ? (
          <div className="post-shell publication-reader">
            <PostArticle {...preview} preview />
          </div>
        ) : null}
      </Dialog>
    </section>
  );
}
