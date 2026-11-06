import type { Metadata } from 'next';
import Link from 'next/link';
import { operatorName, privacyEmail } from '@/presentation/policy-contact';

export const metadata: Metadata = {
  title: { absolute: 'code-lily · 기술 글과 업무 기록' },
  description:
    '기술 글과 소개를 읽고, Google 로그인 후 댓글과 공개 Work 문서를 이용하는 공간입니다.',
};

export default function Home() {
  return (
    <main id="main-content" className="about-shell space-y-12 py-12 sm:py-20">
      <header className="max-w-3xl space-y-5">
        <p className="text-sm font-semibold tracking-widest text-muted">code-lily</p>
        <h1 className="text-3xl leading-tight font-bold sm:text-4xl">
          기술을 배우고, 기록하고, 나누는 공간
        </h1>
        <p className="text-base leading-8 text-muted">
          개발하며 배운 내용을 기술 글로 기록하고, 소개와 업무 문서를 함께 정리합니다. 공개 글과
          About은 로그인 없이 읽을 수 있습니다.
        </p>
      </header>
      <nav aria-label="서비스 바로가기" className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/posts"
          className="rounded-xl border border-line p-6 transition-colors hover:bg-surface"
        >
          <h2 className="mb-3 text-xl font-semibold">Posts 글 보기</h2>
          <p className="text-sm leading-7 text-muted">
            기술 글을 카테고리와 태그로 탐색하고 검색합니다.
          </p>
        </Link>
        <Link
          href="/about"
          className="rounded-xl border border-line p-6 transition-colors hover:bg-surface"
        >
          <h2 className="mb-3 text-xl font-semibold">About 소개 보기</h2>
          <p className="text-sm leading-7 text-muted">
            운영자의 소개, 경력과 관심사를 읽을 수 있습니다.
          </p>
        </Link>
        <Link
          href="/work"
          className="rounded-xl border border-line p-6 transition-colors hover:bg-surface"
        >
          <h2 className="mb-3 text-xl font-semibold">Work 문서 보기</h2>
          <p className="text-sm leading-7 text-muted">
            로그인 후 운영자가 공개한 업무 문서를 조회·검색·열람합니다.
          </p>
        </Link>
      </nav>
      <section className="max-w-3xl space-y-4">
        <h2 className="text-xl font-semibold">Google 로그인과 회원 기능</h2>
        <p className="leading-8 text-muted">
          만 14세 이상은 Google 계정으로 가입할 수 있습니다. 가입한 회원은 로그인해 댓글을 작성하고
          자기 댓글을 삭제할 수 있습니다. 글 작성·수정에는 운영자가 부여한 편집 권한이 필요하며,
          Work 문서 관리는 운영자가 담당합니다. Google의 기본 계정 정보는 로그인과 계정 식별에
          사용합니다.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          Google 로그인 안내
        </Link>
      </section>
      <section className="max-w-3xl space-y-4">
        <h2 className="text-xl font-semibold">이용 안내와 문의</h2>
        <div className="flex flex-wrap gap-x-6">
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            개인정보처리방침
          </Link>
          <Link
            href="/terms"
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            이용약관
          </Link>
        </div>
        <p className="text-sm leading-7 text-muted">
          운영자 {operatorName} ·{' '}
          <a href={`mailto:${privacyEmail}`} className="break-all underline underline-offset-4">
            {privacyEmail}
          </a>
        </p>
      </section>
    </main>
  );
}
