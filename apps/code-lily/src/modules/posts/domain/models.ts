import type { ContentFormat } from '@codelily/content';
export interface Category {
  id: string;
  name: string;
  slug: string;
  ownerId: string | null;
  count: number;
}
export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  readMinutes: number;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  categoryId: string | null;
  categoryName: string | null;
  authorId: string | null;
  authorName: string;
  bodyRemoved: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}
export interface Post extends PostSummary {
  source: string;
  format: ContentFormat;
  renderedHtml: string;
  series: PostSeriesPlacement | null;
  editVersion: number;
}
export type PostDraftFields = Pick<
  PostInput,
  'slug' | 'title' | 'excerpt' | 'source' | 'format' | 'categoryId'
> & {
  tagsText: string;
  seriesId: string | null;
  seriesPosition: string;
};
export interface PostDraftWrite {
  id: string;
  postId: string | null;
  baseVersion: number | null;
  version: string | null;
  fields: PostDraftFields;
}
export interface PostDraft extends Omit<PostDraftWrite, 'version'> {
  ownerId: string;
  version: string;
  updatedAt: string;
}
export type DraftSummary = Pick<PostDraft, 'id' | 'postId' | 'updatedAt'> & { title: string };
export type PreparedPost = PostInput & { renderedHtml: string };
export interface PostSeriesPlacement {
  id: string;
  position: number;
}
export interface PostSeries {
  id: string;
  name: string;
  ownerId: string | null;
}
export type SeriesEntry = Pick<PostSummary, 'slug' | 'title'> & { position: number };
export type RelatedPost = Pick<PostSummary, 'id' | 'slug' | 'title' | 'excerpt'>;
export interface PublicSeriesSummary {
  id: string;
  name: string;
  count: number;
  firstSlug: string;
}
export type PostReaderDetails = Pick<
  PostSummary,
  'title' | 'excerpt' | 'tags' | 'categoryName' | 'authorName' | 'readMinutes' | 'bodyRemoved'
> & { date: string };
export type PostPreviewInput = Pick<
  PostInput,
  'id' | 'title' | 'excerpt' | 'source' | 'format' | 'tags' | 'categoryId'
>;
export interface PostInput {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  source: string;
  format: ContentFormat;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  categoryId: string | null;
  series?: PostSeriesPlacement | null;
}
export interface Comment {
  id: string;
  postId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}
export interface PostRepository {
  categories(): Promise<Category[]>;
  category(id: string): Promise<Category | null>;
  saveCategory(
    input: { id?: string; name: string; slug: string },
    actorId: string,
  ): Promise<Category>;
  deleteCategory(id: string, actorId: string): Promise<void>;
  list(filters: {
    category?: string;
    tag?: string;
    q?: string;
    authorId?: string;
    withdrawn?: boolean;
    includeDrafts?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<PostSummary[]>;
  publishedCount(): Promise<number>;
  sitemapEntries(): Promise<Pick<PostSummary, 'slug' | 'updatedAt'>[]>;
  findRelatedPublished(postId: string, limit: number): Promise<RelatedPost[]>;
  listSeries(ownerId?: string | null): Promise<PostSeries[]>;
  findSeries(id: string): Promise<PostSeries | null>;
  saveSeries(input: { id?: string; name: string }, actorId: string): Promise<PostSeries>;
  deleteSeries(id: string, actorId: string): Promise<void>;
  publishedSeriesEntries(id: string): Promise<SeriesEntry[]>;
  publicSeriesPage(offset: number, limit: number): Promise<PublicSeriesSummary[]>;
  findById(id: string): Promise<Post | null>;
  findBySlug(slug: string): Promise<Post | null>;
  save(input: PreparedPost, actorId: string): Promise<Post>;
  findDraft(id: string): Promise<PostDraft | null>;
  listDrafts(actorId?: string): Promise<DraftSummary[]>;
  saveDraft(input: PostDraftWrite, ownerId: string): Promise<PostDraft | null>;
  applyDraft(
    draft: PostDraft,
    input: PreparedPost,
    actorId: string,
    postVersion: number | null,
  ): Promise<string>;
  deleteDraft(draft: PostDraft): Promise<boolean>;
  unpublish(id: string, postVersion: number, actorId: string): Promise<boolean>;
  setWithdrawnVisibility(
    id: string,
    status: PostSummary['status'],
    actorId: string,
  ): Promise<boolean>;
  delete(id: string, actorId: string): Promise<void>;
  comments(postId: string): Promise<Comment[]>;
  addComment(postId: string, body: string, actorId: string): Promise<Comment>;
  comment(id: string): Promise<Comment | null>;
  deleteComment(id: string, actorId: string): Promise<void>;
}
