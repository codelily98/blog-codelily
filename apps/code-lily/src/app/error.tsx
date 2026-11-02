'use client';
import { Button } from '@codelily/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="page-shell py-20">
      <h1 className="text-2xl font-bold">페이지를 불러오지 못했습니다.</h1>
      <p className="mt-4 text-muted">
        잠시 후 다시 시도해주세요. 처음 실행하는 환경이라면 데이터베이스 migration을 확인해주세요.
      </p>
      <Button className="mt-6" onClick={reset}>
        다시 시도
      </Button>
    </main>
  );
}
