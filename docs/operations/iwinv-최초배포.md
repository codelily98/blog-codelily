# iwinv Ubuntu 26.04 LTS 최초 배포

2026-11-03 기준. 실제 Ubuntu 26.04 LTS/amd64·2 CPU·약 8GB RAM을 확인하고 Docker Engine 29.9.2/Compose 5.7.0 설치·hello-world·이미지 pull을 검증했다. NTS 4460/TCP outbound 허용 후 시간 동기화도 복구했다. 앱 배포·DNS 변경·외부 연동 인수는 진행 중이며 상세 상태는 진행현황을 따른다. 이 문서의 명령은 별도 표기가 없으면 **서버의 Bash에서 저장소 루트 기준**으로 실행한다.

## 1. 변경 범위와 연결

가비아는 `codelily.kr`의 등록기관, Cloudflare는 이미 위임된 DNS 운영자다. 네임서버를 다시 바꿀 필요가 없다. 운영 중인 `naraebi.codelily.kr`의 DNS·Tunnel·인증서·WAF·캐시 설정은 유지한다. 신규 Tunnel `codelily-blog`와 `blog.codelily.kr` 레코드만 추가한다. 기존 `blog` 레코드가 있다면 대상과 사용 여부를 먼저 확인한다.

```text
방문자 → Cloudflare HTTPS/CDN/WAF → 신규 Tunnel
       → cloudflared 컨테이너 → https://caddy:443
       → code-lily:3000(Node.js 포함) → PostgreSQL
                                   ↘ 선택 Redis
```

별도의 빈 Node.js 컨테이너를 띄우지 않는다. Node 24 기반으로 빌드한 **앱 이미지**가 Next.js를 실행한다. DB·Redis·Caddy·cloudflared는 별도 컨테이너다. 서버에 Node/npm을 설치하거나 서버에서 Next.js/Caddy 이미지를 빌드하지 않는다. Redis는 현재 앱이 사용하지 않으므로 기본 생략하고 필요할 때 `cache` profile로 실행한다.

Cloudflare의 zone 전체 SSL 모드나 HSTS/includeSubDomains, redirect, WAF, cache rule 변경은 `naraebi`에도 영향을 줄 수 있다. 이번 작업에서 zone 전체 설정을 일괄 변경하지 않는다. 신규 규칙은 `http.host eq "blog.codelily.kr"` 조건을 사용한다. Tunnel→Caddy 인증서 검증은 Tunnel 원본 TLS 설정으로 별도 제어한다.

## 2. 방화벽 확인

| 방향 | 포트/프로토콜 | 허용 범위·목적 |
|---|---|---|
| inbound | 22/TCP | 현재 개발 PC 공인 IP만, SSH 응답은 stateful 허용 |
| inbound | 80·443 | 이 블로그는 Tunnel을 쓰므로 불필요. 같은 서버의 다른 서비스가 쓰는지 확인한 뒤 제거 가능 |
| outbound | 53/UDP·TCP | 시스템 DNS 및 Caddy의 1.1.1.1/1.0.0.1 DNS 조회·TXT 전파 확인 |
| outbound | 80/TCP | Ubuntu 패키지 mirror 등 실제 설정에 따라 사용 |
| outbound | 443/TCP | Docker/GHCR, Cloudflare API, ACME, Google OAuth, R2, HTTPS Git clone |
| outbound | 123/UDP | 실제 사용하는 NTP 서버, OAuth·TLS를 위한 시간 동기화 |
| outbound | 4460/TCP | Ubuntu 기본 chrony NTS 키 교환. 실제 서버에서 미허용 시 시간 동기화 실패를 확인했고 허용 후 복구 |
| outbound | 7844/UDP·TCP | Cloudflare Tunnel QUIC와 HTTP/2, 공식 Tunnel 목적지 범위 |

Tunnel용 7844를 inbound로 열지 않는다. PostgreSQL 5432, Redis 6379, Next 3000, Docker API 2375/2376은 외부에 열지 않는다. 443/UDP(HTTP/3)와 123/TCP는 이 구성의 필수 항목이 아니다. IPv6 사용 시 같은 정책을 적용한다. Docker가 공개한 포트는 UFW 규칙을 우회할 수 있으므로 운영 Compose에는 `ports:`가 없다.

아래를 확인한다. 아직 SSH 허용·키 인증을 검증하지 않은 상태에서 SSH나 방화벽 정책을 먼저 닫지 않는다.

```sh
cat /etc/os-release
uname -m
timedatectl status
resolvectl status
getent hosts download.docker.com ghcr.io region1.v2.argotunnel.com
ip route
sudo ss -lntup
```

`26.04`/amd64 여부를 확인한다. `172.30.0.0/29`가 기존 route/Docker network와 겹치면 Compose subnet·connector IP·Caddy trusted proxy를 함께 수정한다.

## 3. Docker Engine + Compose 설치

Docker 공식 APT 저장소를 사용한다. 아래는 신규 서버 기준이다. 이미 Docker/containerd나 다른 컨테이너 서비스가 있으면 패키지·컨테이너부터 확인하고 일괄 삭제하지 않는다. 이전 **개발 PC 초기화 지시를 운영 서버에 적용하지 않는다**.

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' \
  "${UBUNTU_CODENAME:-$VERSION_CODENAME}" "$(dpkg --print-architecture)" \
  | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
sudo docker run --rm hello-world
```

호스트 로그인 사용자를 docker 그룹에 자동 추가하지 않는다. 이 그룹은 사실상 root 권한을 제공하므로 여기서는 `sudo docker`를 사용한다. 설치한 Engine/Compose 버전과 실제 실행 결과는 진행현황에 기록한다.

## 4. 이미지 준비: 개발 PC 또는 CI

동일 소스 revision에서 `infra/Dockerfile`의 `runtime`과 `migrator` 두 target을 빌드한다. Caddy는 `infra/caddy/Dockerfile`로 Cloudflare DNS module을 포함해 별도로 빌드한다. 모든 이미지는 서버의 CPU 아키텍처에 맞춰 준비하고 GHCR 같은 registry에 push한다. 이 단계는 **서버에서 실행하지 않는다**.

- `NODE_IMAGE`: 검증한 Node 24 Debian slim digest.
- `BLOG_IMAGE`: 빌드한 앱 이미지 digest.
- `MIGRATOR_IMAGE`: 같은 commit의 migrator 이미지 digest.
- `CADDY_IMAGE`: Caddy/module 버전을 고정한 커스텀 이미지 digest.
- `POSTGRES_IMAGE`: 검증한 PostgreSQL 16 digest.
- `REDIS_IMAGE`: 검증한 Redis 7 digest(profile을 생략해도 Compose 변수 해석에 필요).
- `CLOUDFLARED_IMAGE`: 검증한 `cloudflare/cloudflared` release digest.

`infra/.env.example`의 빌드 인자를 채운 뒤 개발 PC/CI에서 실행할 빌드 형태는 다음과 같다. `BLOG_TAG`, `MIGRATOR_TAG`, `CADDY_TAG`는 예를 들어 `ghcr.io/codelily98/blog-codelily:<commit>`처럼 commit별 고유 tag를 사용한다. 아래 환경변수는 실제 값으로 먼저 설정해야 한다.

```sh
docker buildx build --platform linux/amd64 -f infra/Dockerfile --target runtime \
  --build-arg NODE_IMAGE="$NODE_IMAGE" -t "$BLOG_TAG" --push .
docker buildx build --platform linux/amd64 -f infra/Dockerfile --target migrator \
  --build-arg NODE_IMAGE="$NODE_IMAGE" -t "$MIGRATOR_TAG" --push .
docker buildx build --platform linux/amd64 -f infra/caddy/Dockerfile \
  --build-arg CADDY_BUILDER_IMAGE="$CADDY_BUILDER_IMAGE" \
  --build-arg CADDY_RUNTIME_IMAGE="$CADDY_RUNTIME_IMAGE" \
  --build-arg CADDY_VERSION="$CADDY_VERSION" \
  --build-arg CF_DNS_MODULE_VERSION="$CF_DNS_MODULE_VERSION" \
  -t "$CADDY_TAG" --push .
```

registry의 digest를 조회해 `image@sha256:...`로 배포 설정에 기록한다. 운영 env/secrets를 build context에 넣지 않는다. 현재 GHCR 이미지 발행과 CI 자동 배포는 미구성이다.

최초 배포에서 registry 인증이 준비되지 않은 경우 개발 PC에서 빌드한 이미지를 `docker save`로 내보내 SSH/SCP로 서버에 전송하고 `docker load`할 수 있다. 이때 압축 파일 SHA-256과 로드 후 image ID를 비교하고 Compose에는 해당 불변 `sha256:<image ID>`를 지정한다. 서버에서 빌드하지 않으며 registry를 pull하는 정식 배포와 구분해 기록한다. registry로 전환할 때는 같은 검증을 거친 image repository digest로 교체한다.

## 5. 서버 소스·비밀 설정

```sh
mkdir -p "$HOME/services"
cd "$HOME/services"
git clone https://github.com/codelily98/blog-codelily.git codelily
cd codelily
git log -1 --oneline
```

배포할 commit/tag를 확인한다. private registry라면 해당 image에 대한 read 권한만 가진 자격증명으로 `sudo docker login ghcr.io --username codelily98`을 실행하고 password prompt에서 입력한다. token을 명령 인자·채팅·Git에 넣지 않는다. Git clone의 인증과 container registry 인증은 별개다.

`NODE_IMAGE`에 검증한 Node 24 digest를 넣고 일회성 Node 컨테이너로 설정 파일을 만든다. 이 도구는 npm 설치·DB 변경을 하지 않는다.

```sh
read -r -p '설정 생성용 Node 24 image@sha256:...: ' NODE_IMAGE
sudo docker run --rm --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=$PWD,target=/workspace" --workdir /workspace \
  "$NODE_IMAGE" node scripts/setup-production.mjs
```

생성되는 `infra/.env`에 이미지 digest를, `infra/env/code-lily.env`에 Google/R2 설정을 편집기로 입력한다. 최초 OWNER는 `codelily98@gmail.com`, 운영 URL은 `https://blog.codelily.kr`이다. Google redirect는 `https://blog.codelily.kr/api/auth/callback/google`이다. `setup-production.mjs`는 기존 파일·비밀값을 덮어쓰지 않으며 **기존 DB 비밀번호를 회전하지 않는다**.

비밀 디렉터리는 `0700`, env 파일은 `0600`이다. Compose 파일형 secret은 bind mount이므로 non-root cloudflared/PostgreSQL/Redis도 읽을 수 있도록 secret **파일만 `0444`**, 부모 디렉터리는 `0700`으로 유지한다. Docker secret의 `mode:`만 지정해 bind source 권한이 바뀐다고 가정하지 않는다. secret 파일을 변경할 때는 임시로 쓰기 권한을 부여하고 편집 후 복구한다. 값이나 env 전체를 터미널 출력으로 확인하지 않는다.

## 6. Cloudflare 신규 Tunnel과 인증서

두 token을 생성한 뒤 서버의 대화형 Bash에서 `bash scripts/configure-cloudflare-secrets.sh`를 실행하면 입력을 숨긴 채 비밀 파일에 저장한다. PC에서 실행할 때는 `ssh -t`로 접속한다. 이 도구는 비대화형 실행을 거절하고 이미 설정된 비밀값은 보존한다. token을 명령 인자로 붙이거나 채팅에 전달하지 않는다.

1. Cloudflare One에서 **새 remotely-managed cloudflared Tunnel** `codelily-blog`를 만든다. 기존 `naraebi` Tunnel은 재사용·변경하지 않는다.
2. 발급된 token만 `infra/secrets/cloudflare-tunnel-token.txt`에 저장한다. Cloudflare가 제시하는 host 설치 명령은 별도로 실행하지 않는다. Compose의 cloudflared가 유일한 connector다.
3. Cloudflare API token은 `codelily.kr` zone에 한정한 `Zone:DNS:Edit`, 필요한 `Zone:Zone:Read`만 부여하고 `infra/secrets/cloudflare-dns-token.txt`에 저장한다. Global API Key를 쓰지 않는다. DNS token은 zone 내 DNS 수정 권한이 있으므로 보호하고, Caddy는 `_acme-challenge.blog` TXT만 자동 관리하게 한다.
4. 새 published application/public hostname에 `blog.codelily.kr`, Service Type `HTTPS`, URL `caddy:443`을 지정한다. Additional application settings의 **Origin Server Name은 `blog.codelily.kr`, HTTP Host Header도 `blog.codelily.kr`, No TLS Verify는 OFF**로 둔다. 해당 origin 이름은 Docker 서비스명이며 localhost나 서버 공인 IP가 아니다.
5. DNS는 `blog` CNAME → `<새 tunnel UUID>.cfargotunnel.com`, proxy ON으로 연결한다. UI가 자동 생성한 경우 중복 추가하지 않는다. 기존 root·`naraebi`·MX/TXT 레코드를 유지한다.
6. Caddy DNS-01을 먼저 시작해 신뢰된 인증서 발급 로그를 확인한 후 Tunnel을 시작한다. ACME staging을 연습할 때는 별도 staging volume/설정으로 검증하고 최종 origin에는 신뢰된 production 인증서를 사용한다. 인증서 검증을 꺼서 staging 인증서를 통과시키지 않는다.

Cloudflare edge 인증서와 Tunnel→Caddy 인증서는 별개다. 브라우저 자물쇠만으로 Caddy 인증서 갱신이 검증되지 않는다. Caddy의 `/data` volume을 유지한다. zone SSL을 Full(strict)로 통일할 때는 `naraebi` origin 호환성을 먼저 검증한다. 새 Tunnel의 origin TLS 검증을 위해 zone 전체 모드를 바꿀 필요는 없다.

## 7. 신규 DB 초기화·기동

아래 함수는 이 터미널에서만 사용할 Compose 명령 별칭이다. `config` 결과 전체에는 비밀 env가 포함될 수 있으므로 `--quiet`만 출력한다.

```sh
dc() { sudo docker compose --env-file infra/.env -f infra/compose.production.yml "$@"; }
test -s infra/secrets/cloudflare-tunnel-token.txt
test -s infra/secrets/cloudflare-dns-token.txt
dc config --quiet
dc pull postgres code-lily caddy tunnel
dc --profile tools pull migrate maintenance
dc up -d --wait postgres
dc --profile tools run --rm migrate
dc exec -T postgres psql -U postgres -d codelily_production -v ON_ERROR_STOP=1 \
  < infra/postgres/post-migration.sql
dc up -d --wait code-lily
dc exec -T code-lily node -e \
  "fetch('http://127.0.0.1:3000/health/ready').then(async r=>{console.log(r.status);process.exit(r.ok?0:1)})"
dc up -d caddy
dc logs --tail=50 caddy
# Caddy production 인증서 발급을 확인한 후:
dc up -d tunnel
dc ps
```

새 `pgdata`에서는 `local-init.sh`가 runtime/migrator를, `production-init.sh`가 maintenance role을 만든다. 첫 SQL은 신규 DB 초기화 때만 실행된다. `post-migration.sql`은 매 migration 성공 후 실행해 runtime의 migration 이력 쓰기를 회수하고 maintenance에는 보존 정리용 4개 테이블의 SELECT/DELETE만 준다. 기존 DB에 init script를 추가해도 자동 실행되지 않는다. 이 경우 백업 후 role·권한을 확인하여 별도 이관하며 volume을 삭제하지 않는다.

Redis도 지금 실행하려면 `dc --profile cache pull redis`, `dc --profile cache up -d --wait redis`를 추가한다. 현재 Next.js는 Redis를 쓰지 않으며 Redis 실행만으로 ISR 캐시나 세션이 Redis로 이동하지 않는다. 유지보수는 `dc --profile tools run --rm maintenance`로 한 번 실행하고 실제 정기 예약은 별도 구성한다.

## 8. WAF·CDN·실제 인수

- host 조건이 `blog.codelily.kr`인 규칙만 만든다. `/_next/static/*`와 공개 R2 media는 CDN 캐시, `/manage*`와 인증·쓰기·개인 API는 bypass한다. HTML/RSC에 Cache Everything을 적용하지 않는다.
- `/api/auth/callback/google`을 JS challenge로 막지 않고, WAF 오탐이 있으면 해당 host/path/rule만 조정한다. 모든 `/api/*` 보안 검사를 통째로 해제하지 않는다.
- `https://blog.codelily.kr/health/ready` 200, 공개 화면, 실제 Google 최초 OWNER 로그인/로그아웃, 역할별 쓰기, R2 업로드/다운로드, 실제 `CF-Cache-Status`, Caddy TLS 검증, 재시작 후 DB/인증서 유지까지 확인한다.
- `https://naraebi.codelily.kr`의 기존 응답과 주요 기능도 변경 전후 확인한다. 인증서/권한 오류를 브라우저에서 우회하지 않는다.
- 외부 백업·격리 복원·트래픽/메모리/디스크/인증서 경보·보존 작업 예약을 완료한다. 공개한 상태와 운영 인수 완료를 구분한다.

## 9. 다음 세션 기록

진행현황에는 실제 확인한 OS·아키텍처·Docker/Compose 버전, source commit, image digest, Tunnel 연결/인증서/Google/R2/백업 검증 결과, 미완료 항목을 기록한다. 서버 IP·SSH 개인키·비밀 env·Tunnel/DNS token·PC별 경로를 기록하지 않는다. 현재 문서는 실행 준비이며 서버 설치 완료 기록이 아니다.

공식 근거: [Docker Ubuntu 26.04 지원·APT 설치](https://docs.docker.com/engine/install/ubuntu/), [Ubuntu chrony/NTS](https://ubuntu.com/server/docs/how-to/networking/chrony-client/), [Tunnel outbound 방화벽](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/), [Tunnel origin TLS 매개변수](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/), [Caddy DNS challenge](https://caddyserver.com/docs/caddyfile/directives/tls), [Compose 파일형 secret의 권한 제한](https://docs.docker.com/reference/compose-file/services/#secrets).
