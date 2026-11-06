'use client';

import { useState } from 'react';
import { GoogleLoginButton, useSession } from './session-provider';

export function MembershipSignup() {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { actor } = useSession();
  if (actor) return <GoogleLoginButton intent="login" />;

  return (
    <div className="space-y-4">
      <div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(event) => setAgeConfirmed(event.target.checked)}
            aria-describedby="membership-age-help"
            className="size-4 shrink-0 accent-accent"
          />
          <span>만 14세 이상입니다.</span>
        </label>
        <p id="membership-age-help" className="max-w-xl text-sm leading-7 text-muted">
          가입할 때 생년월일과 신분증은 수집하지 않습니다. 만 14세 미만은 로그인 없이 공개 글과
          About을 이용해 주세요.
        </p>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="size-4 shrink-0 accent-accent"
          />
          <span>이용약관에 동의합니다.</span>
        </label>
      </div>
      <GoogleLoginButton intent="signup" confirmed={ageConfirmed && termsAccepted} />
    </div>
  );
}
