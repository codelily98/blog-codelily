import type { Database } from '../../../infrastructure/database';
import type { TelemetryRepository, EventRow, AuditRow } from '../domain/models';
export class PostgresTelemetryRepository implements TelemetryRepository {
  constructor(private db: Database) {}
  async record(browserId: string, path: string, kind: 'PAGE_VIEW' | 'HEARTBEAT') {
    await this.db.query(
      `INSERT INTO telemetry_events(browser_id,path,kind)
      SELECT $1,$2,$3 WHERE (SELECT count(*) FROM telemetry_events WHERE browser_id=$1 AND created_at>now()-interval '1 minute')<6
      AND NOT EXISTS(SELECT 1 FROM telemetry_events WHERE browser_id=$1 AND path=$2 AND kind=$3 AND created_at>now()-interval '30 seconds')`,
      [browserId, path, kind],
    );
  }
  async analytics(days: number) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [metrics, daily, events, logs] = await Promise.all([
      this.db.query<{ pageViews: number; uniqueBrowsers: number; publishedPosts: number }>(
        `SELECT
      (SELECT count(*)::int FROM telemetry_events WHERE kind='PAGE_VIEW' AND created_at>=$1) AS "pageViews",
      (SELECT count(DISTINCT browser_id)::int FROM telemetry_events WHERE kind='PAGE_VIEW' AND created_at>=$1) AS "uniqueBrowsers",
      (SELECT count(*)::int FROM posts WHERE status='PUBLISHED') AS "publishedPosts"`,
        [since],
      ),
      this.db.query<{ day: string; views: number }>(
        `SELECT to_char(created_at AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD') AS day,count(*)::int AS views FROM telemetry_events WHERE kind='PAGE_VIEW' AND created_at>=$1 GROUP BY day ORDER BY day`,
        [since],
      ),
      this.db.query<EventRow>(
        `SELECT id,left(browser_id,12) AS "browserId",path,kind,created_at AS "createdAt" FROM telemetry_events WHERE created_at>=$1 ORDER BY created_at DESC LIMIT 200`,
        [since],
      ),
      this.db.query<AuditRow>(
        `SELECT a.id,u.name AS "actorName",a.action,a.entity_id AS "entityId",a.created_at AS "createdAt" FROM audit_logs a LEFT JOIN "user" u ON u.id=a.actor_id WHERE a.created_at>=$1 ORDER BY a.created_at DESC LIMIT 200`,
        [since],
      ),
    ]);
    return JSON.parse(
      JSON.stringify({
        ...metrics.rows[0],
        daily: daily.rows,
        events: events.rows,
        logs: logs.rows,
      }),
    );
  }
}
