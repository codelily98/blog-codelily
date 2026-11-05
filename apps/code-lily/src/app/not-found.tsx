import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main-content" className="page-shell py-20">
      <p className="text-sm text-muted">404</p>
      <h1 className="mt-3 text-3xl font-bold">페이지를 찾을 수 없습니다.</h1>
      <p className="mt-3 text-muted">
        주소가 변경되었거나 이 페이지를 열람할 권한이 없을 수 있습니다.
      </p>
      <Link className="mt-6 inline-flex min-h-11 items-center underline" href="/posts">
        모든 글로 돌아가기
      </Link>
    </main>
  );
}
