import { services } from '@/composition';
import { SeriesManager } from '@/modules/posts/presentation/series-manager';
import { managementActor } from '@/presentation/manage-actor';

export default async function ManageSeries() {
  const actor = await managementActor();
  const series = await (await services()).posts.seriesManagement(actor);
  return <SeriesManager series={series} />;
}
