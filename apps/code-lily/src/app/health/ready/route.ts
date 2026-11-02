import { getDatabase } from '@/infrastructure/database';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const db = await getDatabase();
    await db.query(
      'SELECT version FROM blog_schema.schema_migrations ORDER BY version DESC LIMIT 1',
    );
    return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
