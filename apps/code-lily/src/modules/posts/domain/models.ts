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
}
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
  find(idOrSlug: string): Promise<Post | null>;
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
