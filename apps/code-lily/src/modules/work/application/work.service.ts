import { renderContent } from '@codelily/content';
import { AppError, authenticated, owner, type Actor } from '../../identity/domain/policy';
import type { CreateWorkNode, WorkChange, WorkRepository } from '../domain/models';

export class WorkService {
  constructor(private repository: WorkRepository) {}

  tree(actor: Actor | null) {
    authenticated(actor);
    return this.repository.tree(actor.role === 'OWNER');
  }

  async search(query: string, actor: Actor | null) {
    const tree = await this.tree(actor);
    const term = query.trim().toLocaleLowerCase('ko-KR');
    return tree.nodes
      .filter((node) => node.name.toLocaleLowerCase('ko-KR').includes(term))
      .slice(0, 50);
  }

  async read(id: string, actor: Actor | null) {
    authenticated(actor);
    const document = await this.repository.read(id, actor.role === 'OWNER');
    if (!document) throw new AppError(404, '문서를 찾을 수 없습니다.');
    const renderedHtml = await renderContent(document.content, 'MARKDOWN', { allowImages: false });
    return { ...document, content: actor.role === 'OWNER' ? document.content : '', renderedHtml };
  }

  create(input: CreateWorkNode, actor: Actor | null) {
    owner(actor);
    return this.repository.create(input, actor.id);
  }

  change(id: string, input: WorkChange, actor: Actor | null) {
    owner(actor);
    return this.repository.change(id, input, actor.id);
  }

  async save(id: string, content: string, version: number, actor: Actor | null) {
    owner(actor);
    await renderContent(content, 'MARKDOWN', { allowImages: false });
    return this.repository.save(id, content, version, actor.id);
  }

  preview(content: string, actor: Actor | null) {
    owner(actor);
    return renderContent(content, 'MARKDOWN', { allowImages: false });
  }

  trash(actor: Actor | null) {
    owner(actor);
    return this.repository.trash();
  }

  today(actor: Actor | null) {
    owner(actor);
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return this.repository.today(date, actor.id);
  }
}
