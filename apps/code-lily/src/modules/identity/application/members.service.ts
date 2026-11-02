import { AppError, owner, type Actor } from '../domain/policy';
export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}
export interface MemberRepository {
  list(): Promise<Member[]>;
  setRole(id: string, role: 'MEMBER' | 'EDITOR', actorId: string): Promise<boolean>;
}
export class MembersService {
  constructor(private repository: MemberRepository) {}
  list(actor: Actor | null) {
    owner(actor);
    return this.repository.list();
  }
  async setRole(id: string, role: 'MEMBER' | 'EDITOR', actor: Actor | null) {
    owner(actor);
    if (actor.id === id) throw new AppError(400, '자신의 권한은 변경할 수 없습니다.');
    if (!(await this.repository.setRole(id, role, actor.id)))
      throw new AppError(400, '관리자 계정의 권한은 이 화면에서 변경할 수 없습니다.');
    return { updated: true };
  }
}
