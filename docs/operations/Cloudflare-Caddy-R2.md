# Cloudflare Tunnel · WAF · Caddy · R2 운영

대상: `blog.codelily.kr`, iwinv `hpa_2.8-g2`. 계정·서버 변경은 아직 실행하지 않았다.

## 1. 연결 구조

```text
브라우저 ─HTTPS─ Cloudflare 프록시/CDN/WAF
                    │
            Cloudflare Tunnel (원본으로 inbound 웹 포트 불필요)
                    │ HTTPS, originServerName=blog.codelily.kr
                  Caddy (DNS-01 인증서 자동 발급·갱신)
                    │ 사설 Docker 네트워크
                 code-lily :3000
                    │
              PostgreSQL (외부 포트 없음)

브라우저 ─서명 PUT─ R2 S3 API의 private staging
완료 검증 후 공개 이미지 ─ media 사용자 지정 도메인/CDN
개인 파일 ─권한 확인 후 60초 서명 GET
```

Tunnel 채택으로 이전의 “blog A 레코드 → 서버 공개 IP / 80·443 공개” 방식을 대체한다. DNS에는 Tunnel이 안내하는 `blog → <tunnel-id>.cfargotunnel.com` 레코드를 설정한다. 서버 공개 IP로 연결되는 우회 레코드를 만들지 않는다. SSH는 별도 관리 경로를 정하고 공개 DB·Redis·Next 포트를 열지 않는다.

## 2. Cloudflare 설정 순서

1. `codelily.kr` zone을 Cloudflare DNS에서 관리하는지 확인한다. 필요하면 등록기관에서 Cloudflare nameserver로 변경하고 전파를 확인한다.
2. Cloudflare One에서 remotely-managed Tunnel을 만든다. connector token을 `infra/secrets/cloudflare-tunnel-token.txt`에 저장하고 채팅·Git·로그에 남기지 않는다.
3. public hostname을 `blog.codelily.kr`, 원본 service를 `https://caddy:443`으로 지정한다. TLS `Origin Server Name`은 `blog.codelily.kr`, 인증서 검증은 켠다. `noTLSVerify`로 인증서 오류를 숨기지 않는다. Docker의 `caddy` 이름은 connector가 접속할 네트워크 이름이다.
4. Cloudflare SSL/TLS는 `Full (strict)`로 설정한다. 인증서 미발급 초기에는 Tunnel 경유 요청이 실패할 수 있으므로 Caddy DNS-01 발급을 먼저 확인한다.
5. zone별 `Zone:DNS:Edit`와 필요한 zone 조회 권한만 가진 DNS API token을 만들고 `infra/secrets/cloudflare-dns-token.txt`에 저장한다. Global API Key를 사용하지 않는다.
6. Caddy는 DNS module이 포함된 자체 이미지를 빌드한다. builder/runtime 이미지 digest와 Caddy/module 버전을 고정한다. ACME는 외부 80 포트 대신 DNS TXT challenge를 사용한다.
7. `caddy_data`·`caddy_config` volume을 유지하고 인증서 만료·갱신 실패를 감시한다. 정상 로그·외부 HTTPS 인증서·Tunnel 원본 TLS 검증 성공을 함께 확인한다. 운영 전 ACME staging에서 DNS 권한·발급 흐름을 먼저 검증한다.
8. WAF에는 사용 중인 plan에서 제공하는 managed rules를 적용하고 OAuth callback·정상 HTML/Markdown 저장·서명 업로드가 오탐 차단되지 않는지 확인한다. 무료 plan과 상위 plan의 규칙·rate limit 기능이 같다고 가정하지 않는다.
9. `/manage*`, 인증·쓰기 API에 적절한 속도 제한을 두되 Google callback과 공유 NAT 사용자를 과하게 제한하지 않는다. Access로 전체 블로그를 막으면 일반 Google 로그인 요구와 충돌하므로 별도 admin 앱에만 선택적으로 적용한다.

`infra/compose.production.yml`은 host port를 한 개도 공개하지 않는다. `172.30.0.0/29`는 예시 connector 전용 네트워크다. 기존 네트워크와 충돌하면 subnet·고정 주소·Caddy trusted proxy를 함께 바꾼다. 앱은 전용 connector에서 온 `CF-Connecting-IP`만 Caddy를 통해 전달받는다. CF 헤더의 존재만으로 사용자나 관리자를 인증하지 않는다.

## 3. CDN과 ISR

- `/_next/static/*`: 파일명에 hash가 있는 정적 파일. 원본의 immutable cache header를 존중하고 장기 캐시한다.
- 공개 R2 `objects/<uuid>`: 불변 key와 `Cache-Control: public, max-age=31536000, immutable`, Cloudflare 사용자 지정 도메인으로 제공한다. 파일 교체 시 새 key를 발급한다.
- `/posts`, 공개 글 상세, `/about`: Next ISR 300초 + 쓰기 후 `revalidatePath`. 최초 요청 시 생성하여 CI 빌드에서 운영 DB를 읽지 않는다.
- `/api/auth/*`, `/api/me`, `/api/uploads/*`, `/api/internal/*`, `/manage*`, 인증 쿠키/Authorization을 포함한 개인 응답: cache bypass + no-store. 서버의 Cache-Control을 무시하는 Edge TTL override를 적용하지 않는다.
- 초기 HTML/RSC는 Cloudflare Cache Everything 대상으로 추가하지 않는다. Next.js ISR을 원본에서 활용하고 CDN은 정적 파일과 공개 미디어에 집중한다. HTML 캐시를 확장할 때는 RSC/Router 헤더 variant, 로그인 쿠키 bypass, `Set-Cookie`, 공개 해제 purge를 별도 인수 검사한다.
- 현재 공개 필터·검색 API는 no-store이며 query 조건으로 DB를 조회한다. 결과 상한·페이지 단위를 유지한다.

ISR 재검증과 CDN purge는 서로 다른 작업이다. 비공개 전환 시 이미 외부 CDN·브라우저에 공개된 파일을 되돌려 숨길 수 없으므로 공개 이미지에 비밀 자료를 업로드하지 않는다. 객체는 private에서 검증한 후 public으로 복사한다. 프록시의 응답 압축과 R2/CDN 전송을 통해 VPS 트래픽을 줄인다. 월 1,000GB와 일별 한도는 실제 청구·초과 정책을 계정에서 확인하고 사용량 경보를 설정한다.

## 4. R2 설정

1. public 이미지 bucket과 private 파일/staging bucket을 별도로 만든다. private bucket의 public access와 r2.dev 공개 주소를 끈다.
2. public bucket에 `media.codelily.kr` 같은 custom domain을 연결한다. production에서 r2.dev를 CDN 대체로 사용하지 않는다.
3. 두 bucket에 필요한 object read/write만 가진 R2 API 자격증명을 서버 환경변수에 둔다. 클라이언트에 R2 key를 제공하지 않는다.
4. `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL`을 설정한다. base URL은 `https://media.codelily.kr` 형식이다.
5. private bucket CORS는 허용 origin `https://blog.codelily.kr` 및 개발 origin을 명시하고 필요한 PUT/GET/HEAD, Content-Type 등을 허용한다. 사용자 인증 여부를 CORS에만 의존하지 않는다.
6. 서명 PUT은 `<account>.r2.cloudflarestorage.com`으로 전송한다. presigned URL은 R2 custom domain에서 사용할 수 없다. 업로드 URL과 공개 CDN URL을 구분한다.
7. `pending/`에는 짧은 수명 정책을 적용한다(초기 1일 제안). 예약 row와 실제 객체가 어긋날 때의 정리 절차를 둔다.
8. 완료 API는 예약 소유권·크기·Content-Type·파일 시그니처를 검증한다. public은 이미지에 한정하고 PDF는 private에 둔다. 파일 시그니처 검사만으로 악성 파일 전체 검사가 되는 것은 아니므로 PDF 외부 공유·고위험 업로드를 추가할 때 악성코드 검사 경로도 도입한다.

## 5. 출시 전 실제 확인

- 외부에서 서버 IP로 Next·PostgreSQL·Redis·Caddy 포트에 접속할 수 없어야 한다.
- Cloudflare 경유 `https://blog.codelily.kr`과 Google callback이 성공해야 한다.
- Caddy 인증서 hostname·신뢰·만료와 volume 유지·재시작 후 복원을 확인한다. 자동 갱신은 장기 관측 또는 staging 갱신 연습으로 검증한다.
- 정적 파일·공개 이미지의 `CF-Cache-Status`와 `Age`, 비공개 경로의 bypass를 실제 응답으로 확인한다.
- R2 presigned PUT→완료→공개 CDN 조회, private 권한부 GET, 잘못된 크기/형식/다른 소유자 거절을 확인한다.
- 백업을 다른 환경으로 복원하고 글·회원·파일 참조까지 검증한다. Tunnel/DNS/R2는 현재 계정 자격증명이 없어 미검증이다.

근거: [Tunnel 원본 TLS 설정](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-configuration/), [Full strict](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/), [Caddy Cloudflare module](https://github.com/caddy-dns/cloudflare), [R2 서명 URL](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/), [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/).
