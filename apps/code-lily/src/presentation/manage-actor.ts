import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { sessionActor } from '@/modules/identity/infrastructure/auth';
import { AppError, owner, writer } from '@/modules/identity/domain/policy';
export async function managementAccess<T>(operation: () => T | Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }
}
export async function managementActor(requireOwner = false) {
  const actor = await sessionActor(await headers());
  if (!actor) redirect('/sign-in');
  await managementAccess(() => {
    if (requireOwner) owner(actor);
    else writer(actor);
  });
  return actor;
}
