'use client';

import { useState } from 'react';
import { GoogleLoginButton, useSession } from './session-provider';

export function MembershipLogin() {
  const [confirmed, setConfirmed] = useState(false);
  const { actor } = useSession();
  return (
    <div className="space-y-4">
      {!actor && (
        <label className="flex min-h-11 max-w-xl cursor-pointer items-start gap-3 leading-7">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            aria-describedby="membership-age-help"
            className="mt-2 size-4 shrink-0 accent-accent"
          />
          <span>만 14세 이상입니다.</span>
        </label>
      )}
      <p id="membership-age-help" className="max-w-xl text-sm leading-7 text-muted">
        회원 기능은 만 14세 이상부터 이용할 수 있습니다. 생년월일과 신분증은 수집하지 않습니다. 만
        14세 미만은 로그인 없이 공개 글과 About을 이용해 주세요.
      </p>
      <GoogleLoginButton ageConfirmed={confirmed} />
    </div>
  );
}
