'use client';

import { Check, Link } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button, Field, Input } from './primitives';

export function CopyLinkButton({
  url,
  label,
  compact = false,
}: {
  url: string;
  label: string;
  compact?: boolean;
}) {
  const addressId = useId();
  const [result, setResult] = useState<{ url: string; outcome: 'copied' | 'manual' } | null>(null);
  const outcome = result?.url === url ? result.outcome : null;
  const manual = outcome === 'manual';
  const copied = outcome === 'copied';
  const Icon = copied ? Check : Link;

  useEffect(() => {
    if (result?.outcome !== 'copied') return;
    const timer = window.setTimeout(() => setResult(null), 2500);
    return () => window.clearTimeout(timer);
  }, [result]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setResult({ url, outcome: 'copied' });
    } catch {
      setResult({ url, outcome: 'manual' });
    }
  }

  return (
    <div className={`[@media(scripting:none)]:hidden ${manual ? 'w-full min-w-0' : ''}`}>
      <Button
        variant={compact ? 'ghost' : 'secondary'}
        className={compact ? 'w-11 px-0 transition-none' : 'transition-none'}
        aria-label={label}
        onClick={copy}
      >
        <Icon size={17} aria-hidden="true" />
        {compact ? null : label}
      </Button>
      <p role="status" aria-atomic="true" className="sr-only">
        {copied ? '링크를 복사했습니다.' : null}
      </p>
      {manual ? (
        <div className="mt-2 mb-3">
          <Field label="복사할 링크" id={addressId} hint="주소를 선택해 복사해주세요.">
            <Input
              id={addressId}
              value={url}
              readOnly
              autoFocus
              aria-describedby={`${addressId}-hint`}
              onFocus={(event) => event.currentTarget.select()}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
