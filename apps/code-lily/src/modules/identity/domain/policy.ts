import type { Role } from '@codelily/contracts';
export interface Actor {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'REQUEST_FAILED',
  ) {
    super(message);
  }
}
export function authenticated(actor: Actor | null): asserts actor is Actor {
  if (!actor) throw new AppError(401, 'Google 로그인이 필요합니다.', 'UNAUTHENTICATED');
}
export function writer(actor: Actor | null): asserts actor is Actor {
  authenticated(actor);
  if (actor.role === 'MEMBER') throw new AppError(403, '글 작성 권한이 필요합니다.', 'FORBIDDEN');
}
export function owner(actor: Actor | null): asserts actor is Actor {
  authenticated(actor);
  if (actor.role !== 'OWNER') throw new AppError(403, '관리자 권한이 필요합니다.', 'FORBIDDEN');
}
export function owned(actor: Actor | null, authorId: string): asserts actor is Actor {
  writer(actor);
  if (actor.role !== 'OWNER' && actor.id !== authorId)
    throw new AppError(403, '자신의 콘텐츠만 수정할 수 있습니다.', 'FORBIDDEN');
}
