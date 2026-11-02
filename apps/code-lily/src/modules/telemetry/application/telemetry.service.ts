import { owner, type Actor } from '../../identity/domain/policy';
import type { TelemetryRepository } from '../domain/models';
export class TelemetryService {
  constructor(private repository: TelemetryRepository) {}
  record(browserId: string, path: string, kind: 'PAGE_VIEW' | 'HEARTBEAT') {
    return this.repository.record(browserId, path, kind);
  }
  analytics(actor: Actor | null, days: number) {
    owner(actor);
    return this.repository.analytics(Math.min(30, Math.max(1, days)));
  }
  async summary() {
    const data = await this.repository.analytics(1);
    return {
      version: 1 as const,
      service: 'code-lily',
      asOf: new Date().toISOString(),
      status: 'ok' as const,
      metrics: {
        pageViews: data.pageViews,
        uniqueBrowsers: data.uniqueBrowsers,
        publishedPosts: data.publishedPosts,
      },
    };
  }
}
