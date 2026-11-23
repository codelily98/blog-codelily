import { Spinner } from '@codelily/ui';
export function PageLoading() {
  return (
    <main id="main-content" className="page-shell py-20">
      <h1 className="sr-only">페이지 로딩</h1>
      <Spinner />
    </main>
  );
}
