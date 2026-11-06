'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createAuthClient } from 'better-auth/react';
import type { Actor } from '../domain/policy';
import { Button, Dialog, useToast } from '@codelily/ui';
import { LogIn, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
const authClient = createAuthClient();
const SessionContext = createContext<{
  actor: Actor | null;
  loading: boolean;
  configured: boolean;
}>({ actor: null, loading: true, configured: false });
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    actor: null as Actor | null,
    loading: true,
    configured: false,
  });
  useEffect(() => {
    let active = true;
    fetch('/api/me')
      .then((response) => response.json())
      .then((result) => {
        if (active)
          setState({
            actor: result.data?.actor ?? null,
            loading: false,
            configured: Boolean(result.data?.googleConfigured),
          });
      })
      .catch(() => {
        if (active) setState({ actor: null, loading: false, configured: false });
      });
    return () => {
      active = false;
    };
  }, []);
  return <SessionContext value={state}>{children}</SessionContext>;
}
export const useSession = () => useContext(SessionContext);
export function GoogleLoginButton(
  props: { intent?: 'entry' | 'login' } | { intent: 'signup'; confirmed: boolean },
) {
  const { intent = 'entry' } = props;
  const label = intent === 'signup' ? 'Google로 가입하기' : 'Google 로그인';
  const router = useRouter();
  const { actor, configured, loading } = useSession();
  const [setup, setSetup] = useState(false);
  const toast = useToast();
  if (actor)
    return (
      <Button
        variant="ghost"
        onClick={async () => {
          await authClient.signOut();
          window.location.assign('/');
        }}
        aria-label={`${actor.name} 로그아웃`}
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">로그아웃</span>
      </Button>
    );
  return (
    <>
      <Button
        variant="secondary"
        className={intent === 'entry' ? 'max-sm:w-11 max-sm:px-0' : undefined}
        aria-label={label}
        disabled={loading || (props.intent === 'signup' && !props.confirmed)}
        onClick={async () => {
          if (intent === 'entry') {
            router.push('/sign-in');
            return;
          }
          if (!configured) {
            setSetup(true);
            return;
          }
          const result = await authClient.signIn.social({
            provider: 'google',
            callbackURL: window.location.origin,
            errorCallbackURL: `${window.location.origin}/sign-in${intent === 'signup' ? '?mode=signup' : ''}`,
            ...(intent === 'signup'
              ? { requestSignUp: true, additionalData: { ageOver14: true, termsAccepted: true } }
              : {}),
          });
          if (result.error)
            toast(
              `Google ${intent === 'signup' ? '가입' : '로그인'}에 실패했습니다. 다시 시도해 주세요.`,
            );
        }}
      >
        <LogIn size={16} />
        <span className={intent === 'entry' ? 'hidden sm:inline' : undefined}>{label}</span>
      </Button>
      <Dialog open={setup} onClose={() => setSetup(false)} title="Google 로그인 설정">
        <p className="text-sm leading-7 text-muted">
          이 사이트는 Google 계정으로만 로그인합니다. 현재 실행 환경에는 Google OAuth 설정이
          없습니다. 관리자가 Client ID·Secret과 인증 URL을 설정하면 사용할 수 있습니다.
        </p>
        <Button className="mt-5" onClick={() => setSetup(false)}>
          확인
        </Button>
      </Dialog>
    </>
  );
}
