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
    const [series, entries] = await Promise.all([
      this.repository.findSeries(post.series.id),
      this.repository.publishedSeriesEntries(post.series.id),
    ]);
    const index = entries.findIndex((entry) => entry.slug === post.slug);
    if (!series || index < 0) return null;
    return { name: series.name, entries, index };
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
    const post = await this.read(idOrSlug, actor);
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
    return this.repository.save(
      { ...input, renderedHtml, excerpt: postExcerpt(input.excerpt, bodyText) },
      actor.id,
    );
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
