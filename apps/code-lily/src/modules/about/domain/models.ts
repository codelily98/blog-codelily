import type { ContentFormat } from '@codelily/content';
export interface AboutItem {
  label: string;
  detail: string;
  period: string;
  url: string;
}
export interface AboutSection {
  id: string;
  kind: 'INTRO' | 'EXPERIENCE' | 'INTERESTS' | 'CONTACT' | 'CUSTOM';
  title: string;
  subtitle: string;
  source: string;
  format: ContentFormat;
  renderedHtml: string;
  items: AboutItem[];
  sortOrder: number;
  published: boolean;
}
export type AboutInput = Omit<AboutSection, 'id' | 'renderedHtml'> & { id?: string };
export interface AboutRepository {
  list(includeDrafts?: boolean): Promise<AboutSection[]>;
  save(input: AboutInput & { renderedHtml: string }, actorId: string): Promise<AboutSection>;
  delete(id: string, actorId: string): Promise<void>;
}
