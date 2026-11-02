import { services } from '@/composition';
import { managementActor } from '@/presentation/manage-actor';
import { MembersManager } from '@/modules/identity/presentation/members-manager';
export default async function Members() {
  const actor = await managementActor(true);
  return <MembersManager members={await (await services()).members.list(actor)} />;
}
