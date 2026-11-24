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
}
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
  listSeries(ownerId?: string | null): Promise<PostSeries[]>;
  findSeries(id: string): Promise<PostSeries | null>;
  saveSeries(input: { id?: string; name: string }, actorId: string): Promise<PostSeries>;
  deleteSeries(id: string, actorId: string): Promise<void>;
  publishedSeriesEntries(id: string): Promise<SeriesEntry[]>;
  findById(id: string): Promise<Post | null>;
  findBySlug(slug: string): Promise<Post | null>;
  save(input: PostInput & { renderedHtml: string }, actorId: string): Promise<Post>;
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
