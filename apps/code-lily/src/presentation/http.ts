import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AppError, authenticated, type Actor } from '../modules/identity/domain/policy';
import { sessionActor } from '../modules/identity/infrastructure/auth';

export function requireSameOrigin(request: Request) {
  const expected = new URL(process.env.APP_URL || 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== expected)
    throw new AppError(403, '허용되지 않은 요청 출처입니다.', 'ORIGIN_REJECTED');
}
export async function jsonBody(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > 600_000)
    throw new AppError(413, '요청이 너무 큽니다.');
  const text = await request.text();
  if (Buffer.byteLength(text) > 600_000) throw new AppError(413, '요청이 너무 큽니다.');
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, '올바른 JSON 요청이 필요합니다.');
  }
}
export async function api(
  request: Request,
  handler: (actor: Actor | null) => Promise<unknown>,
  options: { public?: boolean; mutation?: boolean } = {},
) {
  const requestId = randomUUID();
  try {
    if (options.mutation) requireSameOrigin(request);
    const actor = options.public ? null : await sessionActor(request.headers);
    if (options.mutation && !options.public) authenticated(actor);
    const data = await handler(actor);
    return Response.json(
      { data, requestId },
      { headers: { 'Cache-Control': 'private, no-store', 'X-Request-Id': requestId } },
    );
  } catch (error) {
    let status = 500;
    let message = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
    if (error instanceof AppError) {
      status = error.status;
      message = error.message;
    } else if (error instanceof ZodError) {
      status = 400;
      message = error.issues[0]?.message || '입력값을 확인해주세요.';
    } else if ((error as { code?: string }).code === '23505') {
      status = 409;
      message = '이미 사용 중인 이름 또는 주소입니다.';
    } else if (
      [
        'ECONNREFUSED',
        'ECONNRESET',
        'ENOTFOUND',
        'EAI_AGAIN',
        'ETIMEDOUT',
        '57P01',
        '53300',
        '08006',
        '57014',
      ].includes((error as { code?: string }).code || '') ||
      /^(Connection terminated(?: unexpectedly| due to connection timeout)?|timeout exceeded when trying to connect)$/.test(
        (error as Error).message || '',
      )
    ) {
      status = 503;
      message = '데이터 연결을 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
    }
    if (status >= 500)
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'code-lily',
          event: 'request.failed',
          requestId,
          code: (error as { code?: string }).code || 'INTERNAL',
        }),
      );
    return Response.json(
      {
        error: { message, code: error instanceof AppError ? error.code : 'REQUEST_FAILED' },
        requestId,
      },
      { status, headers: { 'Cache-Control': 'private, no-store', 'X-Request-Id': requestId } },
    );
  }
}
