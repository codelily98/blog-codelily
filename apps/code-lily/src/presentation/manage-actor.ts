import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionActor } from '@/modules/identity/infrastructure/auth';
import { owner, writer } from '@/modules/identity/domain/policy';
export async function managementActor(requireOwner = false) {
  const actor = await sessionActor(await headers());
  if (!actor) redirect('/sign-in');
  if (requireOwner) owner(actor);
  else writer(actor);
  return actor;
}
