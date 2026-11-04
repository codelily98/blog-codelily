# 공개 경로별 502 진단

## 2026-11-04 Windows 중복 connector 장애 — 복구

00:08~00:13 KST, DNS 정상이나 공개 `/posts` HKG·readiness NRT가 502였다. readiness 연속 6회도 모두 502였다. Cloudflare API 조회에서 블로그 Tunnel은 healthy, 원격 ingress는 기존 `https://caddy:443`·Host/SNI `blog.codelily.kr` 그대로였다. Worker route·Page Rule은 없었고 캐시 규칙은 공개 R2 hostname에만 적용됐다.

Tunnel에는 기존 Linux connector 외에 00:06:06 KST 시작한 Windows connector가 추가돼 각각 4개 연결이 있었다. 개발 PC의 Cloudflared 서비스도 같은 시각에 시작됐으며 사용자가 이 PC에서 설치/실행했음을 확인했다. 이 원본 주소는 Linux Docker 내부 서비스용이다. [Cloudflare replica 설명](https://developers.cloudflare.com/tunnel/configuration/#replicas-and-high-availability)대로 같은 Tunnel의 여러 connector에 요청이 분산될 수 있으므로 healthy 표시는 모든 connector의 원본 접근 성공을 뜻하지 않는다.

Windows 관리자 권한으로 서비스가 참조하는 token-file의 Tunnel ID를 메모리에서 비교해 블로그 일치를 검증했다. 일치할 때만 해당 Cloudflared 서비스를 중지하고 시작 유형을 Automatic → Disabled로 변경했다. 서비스 삭제·토큰 회전·서버 컨테이너·DNS·ingress/TLS/WAF 변경은 하지 않았다. 서비스 재시작은 이 장애를 다시 유발할 수 있으므로 복구 절차로 사용하지 않는다.

중지 직후 Cloudflare API에서 Linux connector 1개/연결 4개만 남았고 Posts/readiness는 200으로 복귀했다. readiness 연속 6회 200(약 0.2~0.5초), `/api/me`·`/manage` 200/private,no-store, 내부 API·`/.env`·`/.git/config` 404, 기존 naraebi 200을 확인했다. 실패 Ray 예: `a54c4be08cdd76b3-HKG`·`a54c4bf35938d777-NRT`; 복구 예: readiness `a54c526d79aa5de0-HKG`·Posts `a54c526fd8b7adaf-NRT`다. 이번 장애는 Windows 중복 connector가 원인으로 판단된다.

Browser plugin 미제공으로 Playwright를 사용했다. Chrome launch는 즉시 종료돼 설치된 Edge로 대체했다. 1440×1100·390×844에서 Posts HTTP 200·페이지 제목·본문·오류 overlay 없음·가로 잘림 없음·검색 초점/Escape 복귀·About 이동·console/page 오류 0을 확인하고 화면 캡처를 검토했다. 앱 코드 변경은 없다. `npm run typecheck`, `npm run check:boundaries`, `npm test`(7개), `npm run build`, `git diff --check`가 통과했다. 최초 빌드는 sandbox 파일 권한 EPERM으로 실패했고 제한 밖의 동일 명령 재실행은 성공했다.

재발 방지: connector는 서버의 Compose에서만 실행한다. Cloudflare 설치 화면의 Windows 설치 명령을 개발 PC에서 실행하지 않는다. 새 replica는 해당 원본에 실제 접근 가능한 환경에서만 추가하며 connector별 OS·시작 시각·원본 접근을 확인한다. 현재 서비스는 Stopped/Disabled로 남아 있다.

이전 SJC 오류는 Windows connector 시작 전부터 관측돼 이번 원인으로 설명하거나 해결됐다고 표시하지 않는다. 현재 서버 SSH는 키 승인 후 비대화형 서명이 불가했고 로컬 ssh-agent도 정지 상태여서 서버 내부/SJC 재검증은 하지 못했다. 사용자는 VS Code 접속이 된다고 확인했다. 다음은 서버 SJC 재검증과 Google 실제 로그인/에디터 인수다.

## 2026-11-03 경로별 장애 — 원인 미확정 이력

2026-11-03 KST. 원인 미확정이며 정상 경로의 성공과 다른 경로의 실패를 함께 기록한다. Cloudflare의 자체 장애 또는 정책 문제라고 단정하지 않는다.

2026-11-04 무상 보안 조치 후속: 커널 재부팅 뒤 서버 자체 공개 posts는 SIN 경로 200, 개발 PC posts/readiness/개인 API·기존 naraebi도 200이었다. 중간 Caddy capability 제한에서 file capability 실행 요구를 놓쳐 exit 126/502가 발생했으며 NET_BIND_SERVICE만 허용한 뒤 정상 TLS·공개 응답을 재검증했다. 이는 이전 SJC 문제나 Windows 중복 connector 이력과 구분한다. [적용 기록](무상-보안조치-2026-11-04.md)을 참고한다.

15:40~15:48 KST 보안 점검 후속: 개발 PC의 `/posts`·`/manage` 첫 GET에서도 502를 관측했다. 이 요청의 colo는 수집하지 않았다. 이어진 재조회는 posts HKG 200·manage NRT 200, 기존 naraebi HKG 200이었다. Caddy 전용 원본 주소의 readiness·posts는 인증서 검증을 유지한 HTTPS로 200이다. 따라서 아래 표의 개발 PC 성공은 이전 관측 이력이며 개발 PC 경로가 항상 정상이라고 일반화하지 않는다. 사용자 승인 후 Cloudflare 보안 화면에서 Free 기본 WAF 항상 활성·별도 사용자 지정 0/5·속도 제한 0/1을 확인했지만 이는 502 원인 확정을 의미하지 않는다. 정책·TLS 검증·컨테이너를 변경하지 않았다.

| 확인 위치 | 결과 |
|---|---|
| 개발 PC → Cloudflare HKG → `https://blog.codelily.kr/posts` | 200, 정상 HTML, ISR HIT |
| 실제 Chrome desktop/mobile → 운영 도메인 | 페이지·조작·자동 접근성 검사 통과, console 오류 0 |
| 서버 → Cloudflare SJC → 같은 공개 hostname | 502, `error code: 502` 텍스트 응답 |
| connector namespace → Caddy 전용 주소 → 앱 | 인증서 검증 유지, HTTPS readiness 200 |
| 서버 → `https://naraebi.codelily.kr` | 200 |

## 이미 확인한 사항

- DNS API에서 `blog` CNAME이 실제 실행 Tunnel UUID의 cfargotunnel.com 대상과 일치하고 proxied=true다. 기존 `naraebi` DNS는 변경 전 baseline과 동일하다.
- 수신 ingress는 hostname `blog.codelily.kr`, service `https://caddy:443`, originServerName/httpHostHeader `blog.codelily.kr`이며 TLS 검증을 끄지 않았다.
- Caddy의 실제 Let's Encrypt 신뢰 체인·hostname 검증, 재시작 후 인증서 복원, connector 전용 IP 해석·HTTPS 연결을 검증했다.
- connector QUIC 4개 연결과 connectivity precheck는 정상이다. 서버에서 502를 재현한 직전/직후 `cloudflared_tunnel_total_requests`는 같은 값(해당 관측 시점 104), `cloudflared_tunnel_request_errors`는 0이었다. 이 요청이 connector까지 도달하지 않은 것으로 보이며 근본 원인을 확정하는 증거는 아니다.
- 개발 PC와 서버의 공개 IPv4 대상은 동일한 Cloudflare 주소 집합이다. 응답 Ray suffix는 정상 PC HKG, 실패 서버 SJC였다. 서버에 proxy 환경 변수는 없었다.
- HTTP/1.1·HTTP/2, 압축 요청, 일반 브라우저 User-Agent를 비교했으며 서버 502는 유지됐다. Connector 재시작 1회 후 readyConnections/QUIC/원격 ingress가 정상 복원됐으나 SJC 요청은 502였다. 원본 TLS나 WAF는 해제하지 않았다.
- 공개 CSS는 PC에서 CDN HIT, 개인 API는 no-store/DYNAMIC이고 공개 내부 API는 404다. 정상 PC 경로에서 위험한 cache override 징후는 확인되지 않았다.

## 다음 조사

Cloudflare 대시보드의 hostname별 HTTP/보안 분석·Trace, Worker/Origin/Redirect 규칙 및 해당 시간대/colo의 Tunnel 경로 진단을 확인한다. 다른 서비스의 zone 전체 규칙을 변경하지 않는다. 필요하면 Cloudflare에 아래 비밀값 없는 진단 정보로 문의할 수 있으나 아직 문의를 보내지 않았다.

- 실패 예: 2026-11-03 14:07 KST, Ray `a548db97eb14e6fa-SJC`, GET `/posts`, HTTP 502.
- 정상 예: 같은 날 개발 PC의 Ray `a548e3cf1929079e-HKG`, 같은 hostname/path, HTTP 200.
- token·쿠키·private key·origin IP·비공개 config 전체를 전달하지 않는다. 요청 본문에는 실제 사용자 콘텐츠가 없었다.

추가 Windows 대시보드 조회는 Computer Use가 브라우저 URL을 충분히 확인할 수 없어 정책을 적용할 수 없다는 이유로 종료됐다. 이후 UI 입력이나 대체 방식으로 로그인 상태를 추출하지 않았다. 대시보드 확인 결과 또는 해당 경로의 외부 상태 변화가 필요하다.

근거: [Cloudflare 502/504 진단 안내](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-502-504/), [Tunnel HTTPS 원본 진단](https://developers.cloudflare.com/tunnel/troubleshooting/https-origins/).
