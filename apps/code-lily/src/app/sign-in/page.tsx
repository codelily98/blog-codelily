import Link from 'next/link';
import { GoogleLoginButton } from '@/modules/identity/presentation/session-provider';
export default function SignIn() {
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
      <GoogleLoginButton />
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
