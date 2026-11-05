import { notFound } from 'next/navigation';
import { WorkScreen } from '@/modules/work/presentation/work-screen';
import { workId } from '@/modules/work/presentation/schemas';
export default async function WorkDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const result = workId.safeParse((await params).id);
  if (!result.success) notFound();
  return <WorkScreen documentId={result.data} />;
}
