import type { Post, PostDraftFields } from '../domain/models';

export function initialDraftFields(post?: Post): PostDraftFields {
  return {
    title: post?.title ?? '',
    slug: post?.slug ?? '',
    excerpt: post?.excerpt ?? '',
    source: post?.source ?? '',
    format: post?.format ?? 'MARKDOWN',
    tagsText: post?.tags.join(', ') ?? '',
    categoryId: post?.categoryId ?? null,
    seriesId: post?.series?.id ?? null,
    seriesPosition: post?.series ? String(post.series.position) : '',
  };
}

export function draftArticleInput(fields: PostDraftFields) {
  return {
    title: fields.title,
    slug: fields.slug,
    excerpt: fields.excerpt,
    source: fields.source,
    format: fields.format,
    categoryId: fields.categoryId,
    tags: fields.tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    series: fields.seriesId
      ? { id: fields.seriesId, position: Number(fields.seriesPosition) }
      : null,
  };
}
