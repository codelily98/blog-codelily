'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createAuthClient } from 'better-auth/react';
import type { Actor } from '../domain/policy';
import { Button, Dialog, useToast } from '@codelily/ui';
import { LogIn, LogOut } from 'lucide-react';
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
export function GoogleLoginButton() {
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
        className="max-sm:w-11 max-sm:px-0"
        aria-label="Google 로그인"
        disabled={loading}
        onClick={async () => {
          if (!configured) {
            setSetup(true);
            return;
          }
          const result = await authClient.signIn.social({
            provider: 'google',
            callbackURL: window.location.origin,
          });
          if (result.error) toast('Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }}
      >
        <LogIn size={16} />
        <span className="hidden sm:inline">Google 로그인</span>
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
