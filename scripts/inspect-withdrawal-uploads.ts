import { createInterface } from 'node:readline/promises';
import { getDatabase } from '../apps/code-lily/src/infrastructure/database';
import { inspectWithdrawalUploads } from '../apps/code-lily/src/modules/uploads/infrastructure/withdrawal-upload-inspection';
import { storageFromEnvironment } from '../packages/storage/src/index';

const [choice, option, ...extra] = process.argv.slice(2);
if (
  (choice !== 'keep' && choice !== 'delete') ||
  (option !== undefined && option !== '--r2') ||
  extra.length ||
  !process.stdin.isTTY ||
  !process.env.DATABASE_URL
) {
  console.error('Use an interactive terminal and an explicit DATABASE_URL: keep|delete [--r2]');
  process.exit(1);
}

const input = createInterface({ input: process.stdin, output: process.stdout });
try {
  const memberId = (await input.question('확인된 회원 내부 ID: ')).trim();
  const cursor = (await input.question('이전 페이지 next 값 (첫 페이지는 Enter): ')).trim();
  if (!memberId || (cursor && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(cursor)))
    throw new Error('Invalid input');

  const db = await getDatabase();
  try {
    const review = await inspectWithdrawalUploads(db, memberId, choice, cursor || null);
    const storage = option === '--r2' && review.uploads.length ? storageFromEnvironment() : null;
    const signal = AbortSignal.timeout(60000);
    await storage?.checkBuckets(signal);
    const uploads = [];
    for (const upload of review.uploads) {
      const presence =
        storage && upload.expectedKey
          ? await storage.inspectUpload(upload.id, upload.bucketKind === 'PUBLIC', signal)
          : null;
      uploads.push({ ...upload, presence });
    }
    console.log(JSON.stringify({ ...review, uploads }, null, 2));
  } finally {
    await db.end();
  }
} catch {
  console.error('업로드 미리보기에 실패했습니다. 입력·DB 접근·R2 권한을 확인한 뒤 재시도하세요.');
  process.exitCode = 1;
} finally {
  input.close();
}
