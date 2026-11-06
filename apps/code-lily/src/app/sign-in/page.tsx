import Link from 'next/link';
import { MembershipSignup } from '@/modules/identity/presentation/membership-signup';
import { GoogleLoginButton } from '@/modules/identity/presentation/session-provider';
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; mode?: string | string[] }>;
}) {
  const { error, mode } = await searchParams;
  const signupRequired =
    error === 'signup_disabled' || (Array.isArray(error) && error.includes('signup_disabled'));
  const signup = signupRequired || mode === 'signup';
  return (
    <main id="main-content" className="about-shell space-y-4 py-12 sm:py-20">
      <h1 className="text-3xl font-bold">{signup ? '회원가입' : 'Google 계정으로 로그인'}</h1>
      <p className="text-sm leading-7 text-muted">
        {signup
          ? 'Google 계정으로 가입하기 전에 이용약관을 읽고 아래 항목을 확인해 주세요.'
          : '가입할 때 사용한 Google 계정으로 로그인하세요.'}
      </p>
      {error && (
        <p role="alert" className="text-sm leading-7 text-danger">
          {signupRequired
            ? '가입되지 않은 Google 계정입니다. 처음 이용하신다면 아래에서 가입해 주세요.'
            : `${signup ? '가입' : '로그인'}을 완료하지 못했습니다. 다시 시도해 주세요.`}
        </p>
      )}
      <div className="flex flex-wrap gap-x-5 text-sm text-muted">
        <Link href="/privacy" className="flex min-h-11 items-center underline underline-offset-4">
          개인정보처리방침
        </Link>
        <Link href="/terms" className="flex min-h-11 items-center underline underline-offset-4">
          이용약관
        </Link>
      </div>
      {signup ? <MembershipSignup /> : <GoogleLoginButton intent="login" />}
      <p className="text-sm text-muted">
        <Link
          href={signup ? '/sign-in' : '/sign-in?mode=signup'}
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          {signup ? '이미 회원이신가요? 로그인' : '처음이신가요? 회원가입'}
        </Link>
      </p>
    </main>
  );
}
