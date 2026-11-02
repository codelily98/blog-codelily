import { services } from '@/composition';
import { managementActor } from '@/presentation/manage-actor';
import { AnalyticsDashboard } from '@/modules/telemetry/presentation/analytics-dashboard';
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const actor = await managementActor(true);
  const days = Math.min(30, Math.max(1, Number((await searchParams).days) || 7));
  return (
    <AnalyticsDashboard
      data={await (await services()).telemetry.analytics(actor, days)}
      days={days}
    />
  );
}
