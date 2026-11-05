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
        <p className="leading-7">
          code-lily는 기술 글과 About, 회원 댓글과 Work 문서 열람 기능을 제공합니다.
        </p>
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
        <h2 className="text-xl font-bold">가입 연령</h2>
        <p className="leading-7">
          회원 기능은 만 14세 이상을 대상으로 합니다. 로그인 전에 만 14세 이상임을 직접 확인하며,
          생년월일과 신분증을 수집하지 않습니다. 이 확인은 이용자의 연령 진술이며 별도의 본인 인증을
          통한 나이 검증은 아닙니다. 만 14세 미만의 가입과 법정대리인 동의에 따른 가입은 제공하지
          않습니다. 해당 계정이 확인되면 이용을 제한하고 법정대리인과 필요한 본인 확인 후 정보를
          처리합니다. 아동의 개인정보에 관한 권리 요청도 아래 문의처로 접수할 수 있습니다.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Work 문서와 공개 범위</h2>
        <p className="leading-7">
          운영자가 작성한 폴더·문서 이름, 폴더 구조, Markdown 본문, 공개 상태, 수정 버전,
          작성·수정·삭제 시각과 작성자 내부 식별자를 문서 관리와 회원 열람 제공을 위해 저장합니다.
          로그인한 일반 회원과 편집자는 문서와 모든 상위 폴더가 공개된 항목을 조회·검색·열람할 수
          있습니다. 회원에게는 정제된 본문을 제공하며 새 항목과 복구한 항목은 비공개로 시작합니다.
        </p>
        <p className="leading-7">
          삭제한 Work 항목은 30일 동안 복구할 수 있습니다. 30일이 지나면 정기 정리 대상이 되며, 한
          번의 작업에서 하위 항목이 없는 노드를 최대 500개 정리하므로 항목 수와 폴더 구조에 따라
          여러 차례 작업이 필요할 수 있습니다. 백업에는 별도의 7일 보관 기준을 적용합니다. 회원
          탈퇴의 작성 글·댓글 처리 선택은 운영자가 관리하는 Work 문서의 일괄 삭제를 뜻하지 않습니다.
          문서에 포함된 본인의 개인정보는 문서 주소와 함께 권리 요청을 접수해 주세요.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">호스팅과 외부 서비스</h2>
        <dl className="space-y-4 leading-7">
          <div>
            <dt className="font-semibold">주식회사 스마일서브(iwinv)</dt>
            <dd>
              앱과 회원 데이터베이스를 호스팅하는 서버는 서울특별시 금천구 가산디지털1로 33-33,
              2층에 있습니다. 운영자가 앱과 데이터베이스를 관리하며, 계정·세션·콘텐츠와 운영 기록이
              이 서버의 저장 공간에서 처리됩니다. 보관 기준은 이 방침의 항목별 기간을 따릅니다.{' '}
              <a
                href="https://www.iwinv.kr/treaty/treaty/all"
                className="underline underline-offset-4"
              >
                iwinv 회원약관·SLA
              </a>{' '}
              <a
                href="https://www.iwinv.kr/treaty/treaty/person"
                className="underline underline-offset-4"
              >
                iwinv 개인정보처리방침
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Cloudflare</dt>
            <dd>
              사이트 접속과 파일 전송은 Cloudflare, Inc.의 네트워크를 경유합니다. 접속 IP, 요청
              URL·헤더·쿠키와 요청에 포함된 정보를 HTTPS 통신 과정에서 처리해 사이트 연결과 보안
              검사를 제공하고, 공개 정적 파일의 전송을 지원합니다. 정보는 미국(US) 및 Cloudflare
              아시아·태평양(APAC) 등 글로벌 데이터센터 소재 국가에서 처리될 수 있습니다. 공개
              이미지와 비공개 첨부 파일은 분리된 Cloudflare R2 버킷에 저장합니다. 두 버킷의 표시
              위치는 아시아·태평양(APAC)이며 특정 국가에 저장을 제한하는 설정은 적용돼 있지
              않습니다.{' '}
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                className="underline underline-offset-4"
              >
                Cloudflare 개인정보처리방침
              </a>{' '}
              ·{' '}
              <a href="https://www.cloudflare.com/terms/" className="underline underline-offset-4">
                서비스 약관
              </a>{' '}
              ·{' '}
              <a
                href="https://www.cloudflare.com/cloudflare-customer-dpa/"
                className="underline underline-offset-4"
              >
                개인정보 처리 부속약정(DPA)
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Google</dt>
            <dd>
              로그인 시 Google LLC 및 Google 정책에서 정한 서비스 제공 주체가 사용자 인증을 처리하고
              code-lily에 기본 계정 정보를 제공합니다. 운영자의 문의 접수 주소는 Gmail이며, 해당
              주소로 보내는 이메일은 Gmail을 통해 전달됩니다. Google은 서비스 이용 정보가 거주 국가
              밖의 서버에서 처리될 수 있다고 안내합니다.{' '}
              <a
                href="https://policies.google.com/privacy?hl=ko"
                className="underline underline-offset-4"
              >
                Google 개인정보처리방침
              </a>
            </dd>
          </div>
        </dl>
        <p className="leading-7">
          해외 처리는 사이트 요청, Google 로그인, 파일 업로드·조회, 문의 이메일 송수신 시 네트워크를
          통해 이루어집니다. Cloudflare는 미국과 전 세계 네트워크에서, Google은 미국을 포함한 전
          세계 서버에서 정보를 처리할 수 있습니다. 업체가 공개한{' '}
          <a href="https://www.cloudflare.com/network/" className="underline underline-offset-4">
            Cloudflare 네트워크 소재지
          </a>{' '}
          및{' '}
          <a
            href="https://www.google.com/about/datacenters/locations/"
            className="underline underline-offset-4"
          >
            Google 데이터센터 소재지
          </a>
          를 참고할 수 있으며, 개별 요청·파일·메일의 처리 국가를 하나의 국가로 보장하지 않습니다.
        </p>
        <p className="leading-7">
          운영자는 회원 기능과 문의 요청을 제공하는 데 필요한 범위에서 이들 서비스를 사용합니다. R2
          파일은 해당 파일의 보관 목적이 끝나 삭제될 때까지, 문의 메일은 처리 완료 후 1년의 운영
          기준으로 관리합니다. 업체 자체의 접속·보안·삭제 처리 기록은 각 업체 정책과 적용되는 약관의
          보관 기준을 따르며 앱 데이터의 보관 기간과 같다고 보장하지 않습니다.
        </p>
        <p className="leading-7">
          Google 로그인 연결은 Google 계정 설정에서 해제할 수 있으며 회원 탈퇴와 파일 삭제는 아래
          문의처로 요청할 수 있습니다. 이 사이트의 연결·보안 처리는 Cloudflare를 경유하므로 이를
          원하지 않으면 사이트 이용을 중단해야 합니다. Gmail을 통한 문의를 원하지 않으면 개인정보나
          첨부 파일을 해당 메일 주소로 보내지 마세요. 문의에 필요하지 않은 민감정보는 보내지 마세요.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">방문 기록과 보존</h2>
        <p className="leading-7">
          ‘방문 기록 설정’에서 동의하면 Posts와 About의 공개 페이지 경로, 방문·체류 이벤트와 시각,
          같은 브라우저의 방문을 구분하는 식별자를 기록합니다. 방문 통계에는 입력값, 검색어, 원문 IP
          주소를 저장하지 않습니다. 보존 기준은 30일입니다. 거부를 선택하면 새 기록 수집이 중지되고
          방문 식별 쿠키가 삭제됩니다. 방문 기록 및 테마 선택은 브라우저에 저장됩니다. Work 경로와
          문서 본문·검색어는 이 앱 방문 통계의 수집 대상에 포함하지 않습니다.
        </p>
        <p className="leading-7">
          콘텐츠·권한 관리의 업무 감사 기록에는 90일 보존 기준을 적용합니다. 운영 데이터베이스
          백업은 암호화하며 보관 기준은 7일입니다. 인증 요청에는 별도의 속도 제한을 적용하며, IP
          주소와 인증 경로를 조합한 제한 키, 요청 횟수와 마지막 요청 시각을 저장할 수 있습니다.
          마지막 요청 후 24시간이 지난 행은 일일 작업에서 최대 5,000건씩 정리합니다. 각 보존 기준은
          삭제 대상이 되는 시점이며 예약 작업과 잔량에 따라 실제 정리 시각은 달라질 수 있습니다.
        </p>
        <p className="leading-7">
          회원 정보는 계정을 이용하는 동안 보관하고, 탈퇴가 완료되면 운영 데이터베이스의 계정 정보와
          로그인 세션, Google 연결 정보를 삭제합니다. 기존 암호화 백업의 사본은 보관 기간이 끝나면
          정리합니다. 백업을 복원할 때는 완료한 탈퇴 처리를 다시 적용합니다.
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
          요청자 본인 또는 정당한 대리인인지 확인하고 필요한 범위만 처리합니다. 로그인한 계정으로
          확인하거나 별도 확인 절차를 안내하며, 이메일 발신 주소만으로 본인 확인을 마치지 않습니다.
          열람·정정·삭제·처리정지 요청은 관련 법령의 기한에 따라 처리하고 결과를 안내합니다.
          연기·거절하는 경우에는 사유와 이의제기 방법을 안내하며 위 이메일로 이의를 접수할 수
          있습니다.
        </p>
        <p className="leading-7">
          일반 문의와 권리 요청의 이메일 주소·요청 내용·확인 및 처리 결과는 접수·회신과 처리 내역
          확인을 위해 사용하고, 처리가 끝난 날부터 1년간 보관한 뒤 삭제합니다. 비밀번호·인증 코드와
          불필요한 신분증 사본은 받지 않습니다. 법령에 따라 추가 보관이 필요한 자료는 해당 근거와
          기간을 안내하고 별도로 보관합니다. 탈퇴·파일 처리의 최소 완료 기록은 백업 복원 후 재처리를
          위해 사용하며 같은 보관 기준을 적용합니다.
        </p>
        <p className="leading-7">
          탈퇴할 때 남길 콘텐츠가 있는지 선택해 주세요. 아래 링크는 선택이 담긴 이메일 초안을
          엽니다. 가입에 사용한 이메일 계정에서 직접 보내면 운영자가 본인과 처리 범위를 확인합니다.
          계정과 작성 콘텐츠는 확인 후 처리되며, 비밀번호나 인증 코드는 보내지 마세요.
        </p>
        <ul className="space-y-3">
          <li className="rounded-lg border border-line p-4">
            <p className="leading-7">
              공개 글과 댓글을 남기고 계정과 작성자 표시의 연결 해제를 요청합니다. 남겨진 작성
              콘텐츠에는 작성자가 ‘탈퇴한 회원’으로 표시됩니다.
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
              본문과 작성자 정보가 삭제되며, 글 제목과 주소, 다른 회원의 댓글은 남습니다. 운영자는
              남은 글의 공개 여부를 글별로 바꿀 수 있습니다.
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
      <section className="space-y-3">
        <h2 className="text-xl font-bold">변경 안내</h2>
        <p className="leading-7">
          이 방침을 변경하면 이 페이지 상단에 변경 내용과 시행일을 일반 변경은 7일 전, 이용자에게
          불리하거나 중요한 변경은 30일 전에 안내합니다. 법령에 따라 별도 동의가 필요한 변경은 해당
          절차를 진행합니다. 이전 문안은 위 문의처로 요청할 수 있습니다.
        </p>
        <p className="text-sm leading-7 text-muted">
          2026년 11월 5일 검토 변경: Work의 공개 범위·휴지통 처리, 가입 연령, 문의 보관과 권리
          요청·변경 안내 절차를 추가했습니다. 업체별 실제 계약과 국외 처리 조건은 확인 중입니다.
        </p>
      </section>
    </main>
  );
}
