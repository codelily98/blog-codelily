export function GET() {
  return Response.json(
    { status: 'ok', service: 'code-lily' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
