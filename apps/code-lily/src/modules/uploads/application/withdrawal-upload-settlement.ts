import type { UploadRecord } from './uploads.service';

export type WithdrawalChoice = 'keep' | 'delete';
export type UploadDisposition = 'retain-public' | 'removed';

export interface UploadReview {
  id: string;
  bucketKind: UploadRecord['bucketKind'];
  status: UploadRecord['status'];
  expectedKey: boolean;
  putWindowElapsed: boolean;
  postReferences: number;
  aboutReferences: number;
  commentReferences: number;
}

interface SettlementStorage {
  checkBuckets(signal: AbortSignal): Promise<void>;
  inspectWithdrawalObjects(
    id: string,
    signal: AbortSignal,
  ): Promise<{
    pending: boolean;
    privateCompleted: boolean;
    publicCompleted: boolean;
  }>;
  publicObjectStatus(id: string, signal: AbortSignal): Promise<number>;
}

export function eligibleForSettlement(upload: UploadReview, disposition: UploadDisposition) {
  if (!upload.expectedKey || !upload.putWindowElapsed) return false;
  const hasReferences =
    upload.postReferences + upload.aboutReferences + upload.commentReferences > 0;
  if (disposition === 'removed') return !hasReferences;
  return hasReferences && upload.bucketKind === 'PUBLIC' && upload.status === 'READY';
}

export async function verifyWithdrawalObjects(
  storage: SettlementStorage,
  upload: UploadReview,
  disposition: UploadDisposition,
  signal: AbortSignal,
) {
  await storage.checkBuckets(signal);
  const objects = await storage.inspectWithdrawalObjects(upload.id, signal);
  const retaining = disposition === 'retain-public';
  const originVerified =
    !objects.pending && !objects.privateCompleted && objects.publicCompleted === retaining;
  // A removal probe must not refill the cache from an origin object that still exists.
  const publicStatus =
    originVerified && upload.bucketKind === 'PUBLIC'
      ? await storage.publicObjectStatus(upload.id, signal)
      : null;
  const verified =
    originVerified &&
    (retaining ? publicStatus === 200 : upload.bucketKind === 'PRIVATE' || publicStatus === 404);
  return { ...objects, publicStatus, verified };
}
