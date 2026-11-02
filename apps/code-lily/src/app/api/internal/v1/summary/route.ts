import { timingSafeEqual } from 'node:crypto';
import { services } from '@/composition';
export async function GET(request: Request) {
  const expected = process.env.INTERNAL_API_TOKEN;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (
    !expected ||
    !supplied ||
    expected.length < 32 ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)) ||
    request.headers.get('x-service-audience') !== 'code-lily'
  )
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  return Response.json(await (await services()).telemetry.summary(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
