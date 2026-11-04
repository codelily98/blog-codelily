import type { Metadata } from 'next';
import {
  operatorName,
  policyEffectiveDateLabel,
  policyEffectiveDateTime,
  privacyEmail,
} from '@/presentation/policy-contact';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  robots: { index: false, follow: true },
};

function withdrawalEmail(choice: string) {
  const subject = encodeURIComponent(`code-lily 회원 탈퇴 요청 · ${choice}`);
  const body = encodeURIComponent(
    `code-lily 회원 탈퇴를 요청합니다.\r\n작성 콘텐츠 처리 선택: ${choice}`,
  );
  return `mailto:${privacyEmail}?subject=${subject}&body=${body}`;
}

export default function Privacy() {
  return (
    <main id="main-content" className="about-shell space-y-8 py-12 sm:py-20">
      <header className="space-y-3">
        <p className="text-sm font-semibold text-muted">공개 전 검토본</p>
        <h1 className="text-3xl font-bold">개인정보처리방침</h1>
        <p className="leading-7">
          시행 예정일 <time dateTime={policyEffectiveDateTime}>{policyEffectiveDateLabel}</time>
        </p>
        <p className="leading-7">code-lily는 기술 글과 About, 회원 댓글 기능을 제공합니다.</p>
      </header>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Google 로그인과 공개 콘텐츠</h2>
        <p className="leading-7">
          Google 계정 식별자, 이름, 이메일 주소와 확인 여부, 프로필 사진 주소를 받아 로그인과 계정
          생성에 사용합니다. 인증 과정에서 발급된 토큰과 인증 범위·만료 정보, 서비스의 세션 정보와
          회원 권한을 저장합니다. 세션은 마지막 갱신 후 7일이 지나면 만료됩니다.
        </p>
        <p className="leading-7">
          Google 로그인은 기본 프로필 정보만 요청합니다. Gmail, Drive, 캘린더에 대한 접근 권한은
          요청하지 않습니다. Google 계정 설정에서 로그인 연결을 해제할 수 있습니다. code-lily의
          계정과 작성 콘텐츠를 처리하려면 아래에서 회원 탈퇴를 요청해 주세요.
        </p>
        <p className="leading-7">
          공개 글과 댓글에는 계정 이름이 표시됩니다. 공개 글 API에는 서비스 내부 작성자 식별자가
          포함됩니다. 공개 이미지 주소로는 글을 발행하기 전에도 이미지에 접근할 수 있습니다.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">호스팅과 외부 서비스</h2>
        <dl className="space-y-4 leading-7">
          <div>
            <dt className="font-semibold">주식회사 스마일서브(iwinv)</dt>
            <dd>
              앱과 회원 데이터베이스를 호스팅하는 서버는 서울특별시 금천구 가산디지털1로 33-33,
              2층에 있습니다. 운영자가 앱과 데이터베이스를 관리합니다.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Cloudflare</dt>
            <dd>
              사이트 접속과 파일 전송은 Cloudflare 네트워크를 경유합니다. Cloudflare는 접속 IP와
              HTTP 요청을 처리해 사이트 연결과 보안 검사를 제공하고, 공개 정적 파일의 전송을
              지원합니다. 정보는 미국(US) 및 Cloudflare 아시아·태평양(APAC) 등 글로벌 데이터센터
              소재 국가에서 처리될 수 있습니다. 공개 이미지와 비공개 첨부 파일은 분리된 Cloudflare
              R2 버킷에 저장합니다.
              두 버킷의 표시 위치는 아시아·태평양(APAC)이며 특정 국가에 저장을 제한하는 설정은
              적용돼 있지 않습니다.{' '}
              <a href="https://www.cloudflare.com/privacypolicy/" className="underline underline-offset-4">
                Cloudflare 개인정보처리방침
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Google</dt>
            <dd>
              로그인 시 Google이 사용자 인증을 처리하고 code-lily에 기본 계정 정보를 제공합니다.
              운영자의 문의 접수 주소는 Gmail이며, 해당 주소로 보내는 이메일은 Gmail을 통해
              전달됩니다. Google은 서비스 이용 정보가 거주 국가 밖의 서버에서 처리될 수 있다고
              안내합니다.{' '}
              <a href="https://policies.google.com/privacy?hl=ko" className="underline underline-offset-4">
                Google 개인정보처리방침
              </a>
            </dd>
          </div>
        </dl>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">방문 기록과 보존</h2>
        <p className="leading-7">
          ‘방문 기록 설정’에서 동의하면 공개 페이지 경로, 방문·체류 이벤트와 시각, 같은 브라우저의
          방문을 구분하는 식별자를 기록합니다. 방문 통계에는 입력값, 검색어, 원문 IP 주소를 저장하지
          않습니다. 보존 기준은 30일입니다. 거부를 선택하면 새 기록 수집이 중지되고 방문 식별 쿠키가
          삭제됩니다. 방문 기록 및 테마 선택은 브라우저에 저장됩니다.
        </p>
        <p className="leading-7">
          콘텐츠·권한 관리의 업무 감사 기록에는 90일 보존 기준을 적용합니다. 운영 데이터베이스
          백업은 암호화하며 보관 기준은 7일입니다. 인증 요청에는 별도의 속도 제한을 적용합니다.
        </p>
        <p className="leading-7">
          회원 정보는 계정을 이용하는 동안 보관하고, 탈퇴가 완료되면 운영 데이터베이스의 계정
          정보와 로그인 세션, Google 연결 정보를 삭제합니다. 기존 암호화 백업의 사본은 보관
          기간이 끝나면 정리합니다. 백업을 복원할 때는 완료한 탈퇴 처리를 다시 적용합니다.
        </p>
      </section>
      <section id="withdrawal" className="scroll-mt-36 space-y-3">
        <h2 className="text-xl font-bold">개인정보 문의와 회원 탈퇴</h2>
        <p className="leading-7">
          운영자 {operatorName}에게 개인정보 열람, 정정, 삭제, 처리정지 및 탈퇴를 문의할 수
          있습니다. 연락처는{' '}
          <a href={`mailto:${privacyEmail}`} className="break-all underline underline-offset-4">
            {privacyEmail}
          </a>
          입니다.
        </p>
        <p className="leading-7">
          탈퇴할 때 남길 콘텐츠가 있는지 선택해 주세요. 아래 링크는 선택이 담긴 이메일 초안을
          엽니다. 가입에 사용한 이메일 계정에서 직접 보내면 운영자가 본인과 처리 범위를 확인합니다.
          계정과 작성 콘텐츠는 확인 후 처리되며, 비밀번호나 인증 코드는 보내지 마세요.
        </p>
        <ul className="space-y-3">
          <li className="rounded-lg border border-line p-4">
            <p className="leading-7">
              공개 글과 댓글을 남기고 계정과 작성자 표시의 연결 해제를 요청합니다.
              남겨진 작성 콘텐츠에는 작성자가 ‘탈퇴한 회원’으로 표시됩니다.
            </p>
            <a
              href={withdrawalEmail('작성 콘텐츠 유지')}
              className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            >
              작성 콘텐츠 유지로 탈퇴 요청
            </a>
          </li>
          <li className="rounded-lg border border-line p-4">
            <p className="leading-7">
              계정과 함께 본인이 작성한 글·댓글의 삭제를 요청합니다. 다른 회원의 댓글이 달린 글은
              본문과 작성자 정보가 삭제되며, 글 제목과 주소, 다른 회원의 댓글은 남습니다.
              운영자는 남은 글의 공개 여부를 글별로 바꿀 수 있습니다.
            </p>
            <a
              href={withdrawalEmail('작성 콘텐츠 삭제')}
              className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            >
              작성 콘텐츠 삭제로 탈퇴 요청
            </a>
          </li>
        </ul>
        <p className="leading-7">
          초안과 첨부 파일, 다른 게시물에서 함께 쓰는 이미지의 처리 범위는 요청을 확인할 때
          안내합니다. 이메일 앱이 열리지 않으면 위 주소로 원하는 선택을 적어 보내 주세요.
        </p>
      </section>
    </main>
  );
}
