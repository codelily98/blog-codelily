import Link from 'next/link';
import { MembershipLogin } from '@/modules/identity/presentation/membership-login';
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main id="main-content" className="about-shell py-20">
      <h1 className="text-3xl font-bold">Google 계정으로 시작하기</h1>
      <p className="mt-5 mb-7 text-sm leading-7 text-muted">
        별도의 회원가입 없이 Google 계정으로 로그인합니다.
        <br />
        처음 로그인하면 댓글을 작성할 수 있는 회원 계정이 만들어집니다.
        <br />
        글과 About 편집에는 관리자가 부여한 권한이 필요합니다.
      </p>
      {error && (
        <p role="alert" className="mb-5 text-sm leading-7 text-muted">
          로그인을 완료하지 못했습니다. 가입 연령을 확인한 뒤 다시 시도해 주세요.
        </p>
      )}
      <MembershipLogin />
      <div className="mt-5 flex flex-wrap gap-x-5 text-sm text-muted">
        <Link href="/privacy" className="flex min-h-11 items-center underline underline-offset-4">
          개인정보처리방침
        </Link>
        <Link href="/terms" className="flex min-h-11 items-center underline underline-offset-4">
          이용약관
        </Link>
      </div>
    </main>
  );
}
