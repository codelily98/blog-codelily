import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { services } from '@/composition';
import { sessionActor } from '@/modules/identity/infrastructure/auth';
import { WorkWorkspace } from './work-workspace';

export async function WorkScreen({ documentId = null }: { documentId?: string | null }) {
  const actor = await sessionActor(await headers());
  if (!actor) redirect('/sign-in');
  const tree = await (await services()).work.tree(actor);
  return (
    <WorkWorkspace
      initialTree={tree}
      initialDocumentId={documentId}
      manage={actor.role === 'OWNER'}
    />
  );
}
