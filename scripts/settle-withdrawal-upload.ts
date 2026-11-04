import { createInterface } from 'node:readline/promises';
import { getDatabase } from '../apps/code-lily/src/infrastructure/database';
import {
  eligibleForSettlement,
  verifyWithdrawalObjects,
  type UploadDisposition,
  type WithdrawalChoice,
} from '../apps/code-lily/src/modules/uploads/application/withdrawal-upload-settlement';
import {
  assertSettlementRole,
  reviewWithdrawalUpload,
  settleVerifiedWithdrawalUpload,
} from '../apps/code-lily/src/modules/uploads/infrastructure/withdrawal-upload-inspection';
import { storageFromEnvironment } from '../packages/storage/src/index';

const [choice, disposition, option, ...extra] = process.argv.slice(2);
if (
  (choice !== 'keep' && choice !== 'delete') ||
  (disposition !== 'retain-public' && disposition !== 'removed') ||
  (option !== undefined && option !== '--apply') ||
  extra.length ||
  !process.stdin.isTTY ||
  !process.env.DATABASE_URL
) {
  console.error(
    'Use an interactive terminal and DATABASE_URL: keep|delete retain-public|removed [--apply]',
  );
  process.exit(1);
}

const input = createInterface({ input: process.stdin, output: process.stdout });
async function run(choice: WithdrawalChoice, disposition: UploadDisposition, apply: boolean) {
  const memberId = (await input.question('확인된 회원 내부 ID: ')).trim();
  const uploadId = (await input.question('확인된 업로드 ID: ')).trim();
  if (!memberId || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(uploadId))
    throw new Error('Invalid input');

  const db = await getDatabase();
  try {
    await assertSettlementRole(db);
    const review = await reviewWithdrawalUpload(db, memberId, choice, uploadId);
    if (!review) {
      console.log('해당 회원이 현재 소유한 업로드가 없습니다. 완료 기록과 대상 ID를 확인하세요.');
      return 1;
    }
    if (!eligibleForSettlement(review, disposition)) {
      console.log(JSON.stringify({ status: 'blocked', disposition, review }, null, 2));
      return 1;
    }

    const storage = storageFromEnvironment();
    const verify = () =>
      verifyWithdrawalObjects(storage, review, disposition, AbortSignal.timeout(30000));
    const preview = await verify();
    console.log(JSON.stringify({ status: 'preview', disposition, review, ...preview }, null, 2));
    if (!preview.verified) return 1;
    if (!apply) return 0;

    const confirmation = await input.question(
      `앱 중지·서명 URL 만료·참조 검토 완료 시 ${disposition} ${uploadId} 입력: `,
    );
    if (confirmation.trim() !== `${disposition} ${uploadId}`) {
      console.log('취소했습니다.');
      return 1;
    }
    if (!(await verify()).verified) {
      console.log('R2 또는 공개 URL 응답이 바뀌었습니다. 미리보기부터 다시 확인하세요.');
      return 1;
    }
    const status = await settleVerifiedWithdrawalUpload(db, memberId, choice, review, disposition);
    console.log(JSON.stringify({ status, disposition }));
    return status === 'applied' ? 0 : 1;
  } finally {
    await db.end();
  }
}

try {
  process.exitCode = await run(choice, disposition, option === '--apply');
} catch {
  console.error('업로드 처리를 확인하지 못했습니다. DB 역할·잠금·R2 권한·공개 응답을 확인하세요.');
  process.exitCode = 1;
} finally {
  input.close();
}
