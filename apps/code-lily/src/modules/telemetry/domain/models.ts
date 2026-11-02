export interface EventRow {
  id: string;
  browserId: string;
  path: string;
  kind: string;
  createdAt: string;
}
export interface AuditRow {
  id: string;
  actorName: string | null;
  action: string;
  entityId: string;
  createdAt: string;
}
export interface Analytics {
  pageViews: number;
  uniqueBrowsers: number;
  publishedPosts: number;
  daily: { day: string; views: number }[];
  events: EventRow[];
  logs: AuditRow[];
}
export interface TelemetryRepository {
  record(browserId: string, path: string, kind: 'PAGE_VIEW' | 'HEARTBEAT'): Promise<void>;
  analytics(days: number): Promise<Analytics>;
}
