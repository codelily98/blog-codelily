import { plainText, renderContent } from '@codelily/content';
import {
  AppError,
  authenticated,
  owned,
  owner,
  writer,
  type Actor,
} from '../../identity/domain/policy';
import type { PostInput, PostRepository, PostSummary } from '../domain/models';

export class PostsService {
  constructor(private repository: PostRepository) {}
  categories() {
    return this.repository.categories();
  }
  publishedCount() {
    return this.repository.publishedCount();
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
  async read(id: string, actor: Actor | null = null) {
    const post = await this.repository.find(id);
    if (!post) throw new AppError(404, '글을 찾을 수 없습니다.', 'NOT_FOUND');
    if (post.status !== 'PUBLISHED') owned(actor, post.authorId);
    return post;
  }
  async save(input: PostInput, actor: Actor | null) {
    writer(actor);
    if (input.id) {
      const existing = await this.repository.find(input.id);
      if (!existing) throw new AppError(404, '글을 찾을 수 없습니다.');
      owned(actor, existing.authorId);
      if (existing.bodyRemoved)
        throw new AppError(409, '탈퇴로 본문이 삭제된 글은 편집할 수 없습니다.');
    }
    if (input.categoryId) {
      const category = await this.repository.category(input.categoryId);
      if (!category) throw new AppError(400, '카테고리를 확인해주세요.');
      owned(actor, category.ownerId);
    }
    const renderedHtml = await renderContent(input.source, input.format);
    if (!plainText(renderedHtml) && !renderedHtml.includes('<img'))
      throw new AppError(400, '본문을 입력해주세요.');
    return this.repository.save(
      { ...input, renderedHtml, excerpt: input.excerpt || plainText(renderedHtml).slice(0, 180) },
      actor.id,
    );
  }
  async delete(id: string, actor: Actor | null) {
    const post = await this.read(id, actor);
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
    const post = await this.read(id);
    return this.repository.comments(post.id);
  }
  async addComment(id: string, body: string, actor: Actor | null) {
    authenticated(actor);
    const post = await this.read(id);
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
