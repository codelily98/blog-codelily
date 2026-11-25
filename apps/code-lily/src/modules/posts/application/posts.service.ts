import { plainText, renderContent } from '@codelily/content';
import {
  AppError,
  authenticated,
  owned,
  owner,
  writer,
  type Actor,
} from '../../identity/domain/policy';
import type {
  Post,
  PostDraft,
  PostDraftWrite,
  PostInput,
  PostPreviewInput,
  PostReaderDetails,
  PostRepository,
  PostSummary,
} from '../domain/models';

export class PostsService {
  constructor(private repository: PostRepository) {}
  categories() {
    return this.repository.categories();
  }
  publishedCount() {
    return this.repository.publishedCount();
  }
  sitemapEntries() {
    return this.repository.sitemapEntries();
  }
  async relatedPosts(post: Post) {
    if (post.status !== 'PUBLISHED' || post.bodyRemoved || (!post.categoryId && !post.tags.length))
      return [];
    return this.repository.findRelatedPublished(post.id, 3);
  }
  seriesManagement(actor: Actor | null) {
    writer(actor);
    return this.repository.listSeries(actor.role === 'OWNER' ? undefined : actor.id);
  }
  async editableSeriesOptions(actor: Actor | null, post?: Post) {
    writer(actor);
    if (post) owned(actor, post.authorId);
    return this.repository.listSeries(post ? post.authorId : actor.id);
  }
  async saveSeries(input: { id?: string; name: string }, actor: Actor | null) {
    writer(actor);
    if (input.id) await this.manageSeries(input.id, actor);
    return this.repository.saveSeries(input, actor.id);
  }
  async deleteSeries(id: string, actor: Actor | null) {
    writer(actor);
    await this.manageSeries(id, actor);
    return this.repository.deleteSeries(id, actor.id);
  }
  private async manageSeries(id: string, actor: Actor) {
    const series = await this.repository.findSeries(id);
    if (!series) throw new AppError(404, '시리즈를 찾을 수 없습니다.');
    owned(actor, series.ownerId);
  }
  async publicSeries(post: Post) {
    if (!post.series || post.status !== 'PUBLISHED' || post.bodyRemoved) return null;
    const series = await this.publicSeriesById(post.series.id);
    if (!series) return null;
    const index = series.entries.findIndex((entry) => entry.slug === post.slug);
    return index < 0 ? null : { ...series, index };
  }
  publicSeriesPage(page: number) {
    return this.repository.publicSeriesPage((page - 1) * 24, 25);
  }
  async publicSeriesById(id: string) {
    const [series, entries] = await Promise.all([
      this.repository.findSeries(id),
      this.repository.publishedSeriesEntries(id),
    ]);
    return series && entries.length ? { id, name: series.name, entries } : null;
  }
  list(filters: Parameters<PostRepository['list']>[0]) {
    return this.repository.list({ ...filters, includeDrafts: false });
  }
  async management(actor: Actor | null) {
    writer(actor);
    return this.repository.list({
      authorId: actor.role === 'OWNER' ? undefined : actor.id,
      includeDrafts: true,
      limit: 100,
    });
  }
  withdrawn(actor: Actor | null, page: number) {
    owner(actor);
    return this.repository.list({
      withdrawn: true,
      includeDrafts: true,
      limit: 26,
      offset: (page - 1) * 25,
    });
  }
  async setWithdrawnVisibility(id: string, status: PostSummary['status'], actor: Actor | null) {
    owner(actor);
    if (!(await this.repository.setWithdrawnVisibility(id, status, actor.id)))
      throw new AppError(404, '탈퇴 회원의 글을 찾을 수 없습니다.');
  }
  async read(idOrSlug: string, actor: Actor | null = null) {
    const post =
      (await this.repository.findById(idOrSlug)) ?? (await this.repository.findBySlug(idOrSlug));
    return this.checkReadAccess(post, actor);
  }
  async readById(id: string, actor: Actor | null = null) {
    return this.checkReadAccess(await this.repository.findById(id), actor);
  }
  async readBySlug(slug: string) {
    return this.checkReadAccess(await this.repository.findBySlug(slug), null);
  }
  async readForApi(idOrSlug: string, actor: Actor | null) {
    const { editVersion: _editVersion, ...post } = await this.read(idOrSlug, actor);
    if (actor?.role === 'OWNER' || (actor?.role === 'EDITOR' && actor.id === post.authorId)) {
      return post;
    }
    const { source: _source, ...published } = post;
    return published;
  }
  private checkReadAccess(post: Post | null, actor: Actor | null) {
    if (!post) throw new AppError(404, '글을 찾을 수 없습니다.', 'NOT_FOUND');
    if (post.status !== 'PUBLISHED') owned(actor, post.authorId);
    return post;
  }
  async editablePost(id: string, actor: Actor | null) {
    writer(actor);
    const post = await this.repository.findById(id);
    if (!post) throw new AppError(404, '글을 찾을 수 없습니다.');
    owned(actor, post.authorId);
    return post;
  }
  listDrafts(actor: Actor | null) {
    writer(actor);
    return this.repository.listDrafts(actor.role === 'OWNER' ? undefined : actor.id);
  }
  async findEditableDraft(id: string, actor: Actor | null) {
    writer(actor);
    const draft = await this.repository.findDraft(id);
    if (!draft) return null;
    owned(actor, draft.ownerId);
    if (draft.postId) {
      const post = await this.editablePost(draft.postId, actor);
      if (post.bodyRemoved) throw new AppError(404, '초안을 찾을 수 없습니다.');
    }
    return draft;
  }
  async readDraft(id: string, actor: Actor | null) {
    const draft = await this.findEditableDraft(id, actor);
    if (!draft) throw new AppError(404, '초안을 찾을 수 없습니다.');
    return draft;
  }
  async saveDraft(input: PostDraftWrite, actor: Actor | null) {
    writer(actor);
    if (
      (input.postId !== null && input.postId !== input.id) ||
      (input.postId === null) !== (input.baseVersion === null)
    )
      throw new AppError(400, '초안 대상을 확인해주세요.');
    const [existing, post] = await Promise.all([
      this.repository.findDraft(input.id),
      input.postId ? this.editablePost(input.postId, actor) : null,
    ]);
    if (existing) owned(actor, existing.ownerId);
    if (
      existing &&
      (input.postId !== existing.postId ||
        (input.version && input.baseVersion !== existing.baseVersion))
    )
      throw draftConflict();
    if (post?.bodyRemoved) throw new AppError(409, '본문이 삭제된 글은 편집할 수 없습니다.');
    const ownerId = existing?.ownerId ?? post?.authorId ?? actor.id;
    const draft = await this.repository.saveDraft(input, ownerId);
    if (!draft) throw draftConflict();
    return { version: draft.version, updatedAt: draft.updatedAt, baseVersion: draft.baseVersion };
  }
  async deleteDraft(id: string, version: string, actor: Actor | null) {
    const draft = await this.readDraft(id, actor);
    if (draft.version !== version || !(await this.repository.deleteDraft(draft)))
      throw draftConflict();
  }
  async publishDraft(
    draft: PostDraft,
    input: PostInput,
    postVersion: number | null,
    confirmBase: boolean,
    actor: Actor | null,
  ) {
    writer(actor);
    owned(actor, draft.ownerId);
    const { post, prepared } = await this.prepare(
      { ...input, id: draft.postId ?? undefined, status: 'PUBLISHED' },
      actor,
    );
    if (
      (post?.editVersion ?? null) !== postVersion ||
      (draft.baseVersion !== postVersion && !confirmBase)
    )
      throw new AppError(
        409,
        '공개본이 변경되었습니다. 현재 글을 확인한 뒤 발행해주세요.',
        'POST_BASE_CONFLICT',
      );
    const id = await this.repository.applyDraft(draft, prepared, actor.id, postVersion);
    return { id };
  }
  async unpublish(id: string, postVersion: number, actor: Actor | null) {
    writer(actor);
    await this.editablePost(id, actor);
    if (!(await this.repository.unpublish(id, postVersion, actor.id)))
      throw new AppError(
        409,
        '공개 상태가 바뀌었습니다. 현재 글을 다시 확인해주세요.',
        'POST_BASE_CONFLICT',
      );
  }
  private async editableContent(input: Pick<PostInput, 'id' | 'categoryId'>, actor: Actor) {
    const post = input.id ? await this.editablePost(input.id, actor) : null;
    if (post?.bodyRemoved) throw new AppError(409, '탈퇴로 본문이 삭제된 글은 편집할 수 없습니다.');
    const category = input.categoryId ? await this.repository.category(input.categoryId) : null;
    if (input.categoryId && !category) throw new AppError(400, '카테고리를 확인해주세요.');
    if (category) owned(actor, category.ownerId);
    return { post, category };
  }
  async preview(input: PostPreviewInput, actor: Actor | null) {
    writer(actor);
    const { post, category } = await this.editableContent(input, actor);
    const renderedHtml = await renderContent(input.source, input.format);
    const details: PostReaderDetails = {
      title: input.title || '제목 없음',
      excerpt: postExcerpt(input.excerpt, plainText(renderedHtml)),
      tags: input.tags,
      categoryName: category?.name ?? null,
      authorName: post?.authorName ?? actor.name,
      date: post?.publishedAt || new Date().toISOString(),
      readMinutes: Math.max(1, Math.ceil(Array.from(input.source).length / 700)),
      bodyRemoved: false,
    };
    return { details, renderedHtml };
  }
  async save(input: PostInput, actor: Actor | null) {
    writer(actor);
    return this.repository.save((await this.prepare(input, actor)).prepared, actor.id);
  }
  private async prepare(input: PostInput, actor: Actor) {
    const { post } = await this.editableContent(input, actor);
    if (input.series) {
      const series = await this.repository.findSeries(input.series.id);
      if (!series) throw new AppError(400, '시리즈를 확인해주세요.');
      if (series.ownerId !== (post ? post.authorId : actor.id))
        throw new AppError(403, '글 작성자의 시리즈만 선택할 수 있습니다.');
    }
    const renderedHtml = await renderContent(input.source, input.format);
    const bodyText = plainText(renderedHtml);
    if (!bodyText && !renderedHtml.includes('<img'))
      throw new AppError(400, '본문을 입력해주세요.');
    return {
      post,
      prepared: { ...input, renderedHtml, excerpt: postExcerpt(input.excerpt, bodyText) },
    };
  }
  async delete(id: string, actor: Actor | null) {
    const post = await this.readById(id, actor);
    owned(actor, post.authorId);
    if (post.bodyRemoved)
      throw new AppError(409, '댓글을 보존하는 글은 비공개로 전환할 수 있습니다.');
    return this.repository.delete(post.id, actor.id);
  }
  async saveCategory(input: { id?: string; name: string; slug: string }, actor: Actor | null) {
    writer(actor);
    if (input.id) {
      const category = await this.repository.category(input.id);
      if (!category) throw new AppError(404, '카테고리가 없습니다.');
      owned(actor, category.ownerId);
    }
    return this.repository.saveCategory(input, actor.id);
  }
  async deleteCategory(id: string, actor: Actor | null) {
    writer(actor);
    const category = await this.repository.category(id);
    if (!category) throw new AppError(404, '카테고리가 없습니다.');
    owned(actor, category.ownerId);
    return this.repository.deleteCategory(id, actor.id);
  }
  async comments(id: string) {
    const post = await this.readById(id);
    return this.repository.comments(post.id);
  }
  async addComment(id: string, body: string, actor: Actor | null) {
    authenticated(actor);
    const post = await this.readById(id);
    return this.repository.addComment(post.id, body, actor.id);
  }
  async deleteComment(id: string, actor: Actor | null) {
    authenticated(actor);
    const comment = await this.repository.comment(id);
    if (!comment) throw new AppError(404, '댓글이 없습니다.');
    if (actor.role !== 'OWNER' && actor.id !== comment.authorId)
      throw new AppError(403, '자신의 댓글만 삭제할 수 있습니다.');
    return this.repository.deleteComment(id, actor.id);
  }
}

function postExcerpt(excerpt: string, bodyText: string) {
  return excerpt || bodyText.slice(0, 180);
}

function draftConflict() {
  return new AppError(
    409,
    '다른 탭에서 초안이 저장되었거나 삭제되었습니다.',
    'POST_DRAFT_CONFLICT',
  );
}
