import { services } from '@/composition';
import { managementActor } from '@/presentation/manage-actor';
import { AboutManager } from '@/modules/about/presentation/about-manager';
export default async function ManageAbout() {
  const actor = await managementActor(true);
  return <AboutManager sections={await (await services()).about.management(actor)} />;
}
