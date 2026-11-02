import { renderContent } from '@codelily/content';
import { AppError, owner, type Actor } from '../../identity/domain/policy';
import type { AboutInput, AboutRepository } from '../domain/models';
export class AboutService {
  constructor(private repository: AboutRepository) {}
  list() {
    return this.repository.list();
  }
  management(actor: Actor | null) {
    owner(actor);
    return this.repository.list(true);
  }
  async save(input: AboutInput, actor: Actor | null) {
    owner(actor);
    if (
      input.kind === 'INTRO' &&
      (await this.repository.list(true)).some(
        (section) => section.kind === 'INTRO' && section.id !== input.id,
      )
    )
      throw new AppError(409, '소개 항목은 하나만 등록할 수 있습니다. 기존 소개를 수정해주세요.');
    return this.repository.save(
      { ...input, renderedHtml: await renderContent(input.source, input.format) },
      actor.id,
    );
  }
  async delete(id: string, actor: Actor | null) {
    owner(actor);
    return this.repository.delete(id, actor.id);
  }
}
