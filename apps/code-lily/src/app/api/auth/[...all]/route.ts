import { getAuth, googleConfigured } from '@/modules/identity/infrastructure/auth';
async function handler(request: Request) {
  if (!googleConfigured())
    return Response.json(
      { error: { message: 'Google OAuth 환경변수 설정이 필요합니다.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  return (await getAuth()).handler(request);
}
export const GET = handler;
export const POST = handler;
