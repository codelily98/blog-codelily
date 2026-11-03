# 공개 경로별 502 진단

2026-11-03 KST. 원인 미확정이며 정상 경로의 성공과 다른 경로의 실패를 함께 기록한다. Cloudflare의 자체 장애 또는 정책 문제라고 단정하지 않는다.

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
