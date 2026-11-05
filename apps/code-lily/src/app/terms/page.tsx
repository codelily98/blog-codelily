import type { Metadata } from 'next';
import Link from 'next/link';
import {
  operatorName,
  policyEffectiveDateLabel,
  policyEffectiveDateTime,
  privacyEmail,
} from '@/presentation/policy-contact';

export const metadata: Metadata = {
  title: '이용약관',
  robots: { index: false, follow: true },
};

export default function Terms() {
  return (
    <main id="main-content" className="about-shell space-y-8 py-12 sm:py-20">
      <header className="space-y-3">
        <p className="text-sm font-semibold text-muted">공개 전 검토본</p>
        <h1 className="text-3xl font-bold">이용약관</h1>
        <p className="leading-7">
          시행 예정일 <time dateTime={policyEffectiveDateTime}>{policyEffectiveDateLabel}</time>
        </p>
        <p className="leading-7">code-lily는 {operatorName}이 운영하는 기술 블로그입니다.</p>
      </header>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">서비스 이용</h2>
        <p className="leading-7">
          공개 글과 About은 로그인 없이 볼 수 있습니다. 처음 Google 로그인하면 회원 계정이
          만들어지고, 회원은 댓글을 작성하거나 자기 댓글을 삭제할 수 있습니다. 글과 카테고리 작성은
          편집 권한이 있는 회원이 할 수 있습니다. 회원 기능은 만 14세 이상부터 이용할 수 있으며
          로그인 전에 이를 직접 확인합니다. 만 14세 미만은 로그인 없이 공개 글과 About을 이용할 수
          있습니다.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Work 문서</h2>
        <p className="leading-7">
          Work의 폴더·문서 작성, 수정, 공개 설정, 이동, 삭제와 복구는 운영자가 수행합니다. 로그인한
          일반 회원과 편집자는 공개된 항목을 조회·검색·열람할 수 있습니다. 상위 폴더가 비공개인
          항목은 회원에게 제공하지 않습니다. 자료의 저작권과 이용 범위는 해당 자료의 권리 관계를
          따르며 열람 권한만으로 재배포 권한이 부여되지는 않습니다.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">공개 콘텐츠와 신고</h2>
        <p className="leading-7">
          공개 글과 댓글은 다른 방문자도 볼 수 있습니다. 공개할 권리가 있는 자료만 올려 주세요.
          타인의 개인정보나 권리를 침해하는 자료, 악성 링크 또는 운영을 방해하는 내용을 올려서는 안
          됩니다. 콘텐츠 관련 신고는{' '}
          <a href={`mailto:${privacyEmail}`} className="break-all underline underline-offset-4">
            {privacyEmail}
          </a>
          로 보내 주세요.
        </p>
        <p className="leading-7">
          신고할 때 대상 주소, 침해 내용과 요청 조치를 알려 주세요. 운영자는 본인과 권리 관계를
          확인하고 필요한 범위에서 비공개·삭제 등 조치를 검토한 뒤 결과와 사유를 회신합니다. 같은
          문의처로 이의를 제기할 수 있습니다.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">약관 변경 안내</h2>
        <p className="leading-7">
          약관을 변경하면 이 페이지 상단에 변경 내용과 시행일을 일반 변경은 7일 전, 회원에게
          불리하거나 중요한 변경은 30일 전에 안내합니다. 별도 동의가 필요한 경우에는 해당 절차를
          진행합니다. 변경 내용에 동의하지 않는 회원은 이용을 중단하고 탈퇴를 요청할 수 있습니다.
          이전 문안은 위 문의처로 요청할 수 있습니다.
        </p>
        <p className="text-sm leading-7 text-muted">
          2026년 11월 5일 검토 변경: Work 열람, 가입 연령, 신고 처리와 약관 변경 안내를
          추가했습니다.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">회원 탈퇴</h2>
        <p className="leading-7">
          탈퇴를 요청할 때 작성한 글과 댓글의 유지 또는 삭제를 선택할 수 있습니다. 삭제를 선택했을
          때 다른 회원의 댓글이 달린 글은 본문과 작성자 정보를 제거하고 제목과 주소, 다른 회원의
          댓글을 남깁니다. 운영자는 남은 글의 공개 여부를 글별로 설정합니다.
        </p>
        <Link
          href="/privacy#withdrawal"
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          탈퇴 요청 방법과 콘텐츠 처리 선택
        </Link>
      </section>
    </main>
  );
}
