'use client';
import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Dialog, Field, Input, Select, Spinner, Textarea, useToast } from '@codelily/ui';
import type { Post, Category, PostReaderDetails, PostSeries } from '../domain/models';
import { requestApi } from '@/presentation/client-api';
import { R2ImageUpload } from '@/presentation/r2-image-upload';
import { PostArticle } from './post-article';
import type { ArticleContent } from './post-body';

type Preview = { details: PostReaderDetails; content: ArticleContent };

const ContentEditor = dynamic(
  () => import('@codelily/editor').then((module) => module.ContentEditor),
  { ssr: false, loading: () => <Spinner label="편집기 불러오는 중" /> },
);
export function PostEditor({
  post,
  categories,
  seriesOptions,
}: {
  post?: Post;
  categories: Category[];
  seriesOptions: PostSeries[];
}) {
  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [source, setSource] = useState(post?.source || '');
  const [format, setFormat] = useState<'HTML' | 'MARKDOWN'>(post?.format || 'HTML');
  const [category, setCategory] = useState(post?.categoryId || '');
  const [series, setSeries] = useState(post?.series?.id || '');
  const [position, setPosition] = useState(post?.series ? String(post.series.position) : '');
  const [tags, setTags] = useState(post?.tags.join(', ') || '');
  const [status, setStatus] = useState(post?.status || 'DRAFT');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewButton = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const router = useRouter();
  const articleInput = () => ({
    title,
    excerpt,
    source,
    format,
    categoryId: category || null,
    tags: tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  });
  return (
    <section className="max-w-4xl">
      <h2 className="mb-7 text-2xl font-bold">{post ? '글 수정' : '새 글 작성'}</h2>
      <form
        className="space-y-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError('');
          try {
            const saved = await requestApi<Post>(
              post ? `/api/posts/${post.id}` : '/api/posts',
              post ? 'PUT' : 'POST',
              {
                ...articleInput(),
                slug,
                status,
                series: series ? { id: series, position: Number(position) } : null,
              },
            );
            toast('글을 저장했습니다.');
            router.push(`/manage/posts/${saved.id}`);
            router.refresh();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <Field label="제목" id="post-title">
          <Input
            id="post-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={160}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="글 주소"
            id="post-slug"
            hint="영문 소문자·숫자·하이픈. 예: nextjs-architecture"
          >
            <div className="flex gap-2">
              <Input
                id="post-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                required
                maxLength={100}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
              />
              <Button
                variant="secondary"
                onClick={() => setSlug(`post-${crypto.randomUUID().slice(0, 8)}`)}
              >
                생성
              </Button>
            </div>
          </Field>
          <Field label="카테고리" id="post-category">
            <Select
              id="post-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">미분류</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {seriesOptions.length || series ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="시리즈" id="post-series">
              <Select
                id="post-series"
                value={series}
                onChange={(event) => setSeries(event.target.value)}
              >
                <option value="">시리즈 없음</option>
                {seriesOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            {series ? (
              <Field label="시리즈 순서" id="post-series-position">
                <Input
                  id="post-series-position"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  required
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
        <Field label="요약" id="post-excerpt" hint="비워두면 본문에서 자동으로 생성합니다.">
          <Textarea
            id="post-excerpt"
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            maxLength={300}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="원본 형식"
            id="post-format"
            hint="본문 작성 전 선택하세요. 작성 중에는 SunEditor의 HTML/Markdown 보기로 전환할 수 있습니다."
          >
            <Select
              id="post-format"
              value={format}
              disabled={Boolean(source.trim())}
              onChange={(event) => setFormat(event.target.value as 'HTML' | 'MARKDOWN')}
            >
              <option value="HTML">HTML · 서식 편집</option>
              <option value="MARKDOWN">Markdown · GFM</option>
            </Select>
          </Field>
          <Field label="태그" id="post-tags" hint="쉼표로 구분, 최대 10개">
            <Input
              id="post-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              maxLength={300}
            />
          </Field>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">본문</h3>
          <ContentEditor value={source} onChange={setSource} format={format} />
        </div>
        <R2ImageUpload
          onInsert={(url, alt) => {
            const safeAlt = alt.replace(/[<>"\[\]]/g, '');
            setSource(
              (current) =>
                current +
                (format === 'MARKDOWN'
                  ? `\n\n![${safeAlt}](${url})`
                  : `<p><img src="${url}" alt="${safeAlt}"></p>`),
            );
          }}
        />
        <Field label="공개 상태" id="post-status">
          <Select
            id="post-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as 'DRAFT' | 'PUBLISHED')}
          >
            <option value="DRAFT">초안 · 나만 보기</option>
            <option value="PUBLISHED">공개</option>
          </Select>
        </Field>
        {error ? (
          <p role="alert" className="rounded-lg border border-danger/40 p-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <Button type="submit" disabled={saving || previewing}>
            {saving ? '저장 중…' : '저장'}
          </Button>
          <Button
            variant="secondary"
            disabled={saving}
            aria-disabled={previewing || undefined}
            onClick={async (event) => {
              if (previewing) return;
              previewButton.current = event.currentTarget;
              setPreviewing(true);
              setError('');
              try {
                const result = await requestApi<Preview>('/api/content/post-preview', 'POST', {
                  ...articleInput(),
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
          <Link
            href="/manage"
            className="inline-flex min-h-11 items-center px-3 text-sm text-muted"
          >
            목록으로
          </Link>
          {post?.status === 'PUBLISHED' ? (
            <Link
              href={`/posts/${post.slug}`}
              className="inline-flex min-h-11 items-center px-3 text-sm underline"
            >
              공개 글 보기
            </Link>
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
