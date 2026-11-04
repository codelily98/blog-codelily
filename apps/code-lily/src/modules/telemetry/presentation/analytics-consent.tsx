'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button, Dialog, useToast } from '@codelily/ui';
import { requestApi } from '@/presentation/client-api';
export function AnalyticsConsent() {
  const path = usePathname();
  const [choice, setChoice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  useEffect(() => {
    setChoice(localStorage.getItem('cl-analytics'));
  }, []);
  useEffect(() => {
    if (choice !== 'yes' || !/^\/(?:posts(?:\/[a-z0-9-]+)?|about)?$/.test(path)) return;
    const send = (kind: string) => {
      if (document.visibilityState === 'visible')
        void fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, kind }),
        }).catch(() => {});
    };
    send('PAGE_VIEW');
    const interval = setInterval(() => send('HEARTBEAT'), 60000);
    return () => clearInterval(interval);
  }, [choice, path]);
  const choose = async (value: string) => {
    try {
      await requestApi('/api/telemetry/consent', 'POST', { choice: value });
      localStorage.setItem('cl-analytics', value);
      setChoice(value);
      setOpen(false);
    } catch (error) {
      toast((error as Error).message);
    }
  };
  return (
    <>
      <button
        type="button"
        className="min-h-11 text-xs text-muted underline-offset-4 hover:underline"
        onClick={() => setOpen(true)}
      >
        방문 기록 설정
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="방문 기록 설정">
        <p className="text-sm leading-7 text-muted">
          동의하면 페이지 경로와 방문 시각을 같은 브라우저의 방문을 구분하는 식별자와 함께
          기록합니다. 보존 기준은 30일입니다. 입력 내용·검색어·IP 주소는 방문 기록에 저장하지
          않습니다. 거부해도 모든 기본 기능을 이용할 수 있습니다.
        </p>
        <p className="mt-3 text-xs text-muted">
          현재 상태:{' '}
          {choice === 'yes'
            ? '수집 동의'
            : choice === 'no'
              ? '수집 거부'
              : '미동의 · 수집하지 않음'}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => choose('yes')}>동의</Button>
          <Button variant="secondary" onClick={() => choose('no')}>
            거부
          </Button>
        </div>
      </Dialog>
    </>
  );
}
