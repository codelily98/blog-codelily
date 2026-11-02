# MSA 구현 설정 예제

이 폴더는 설계 예시다. 앱·이미지·운영 계정·인증·백업 작업을 제공하는 완성 배포 패키지가 아니다. 실제 서비스는 실행하지 않았다. 상위 [설계 검토 및 보완안](../../MSA-설계-검토-및-보완안.md)을 함께 읽는다.

## 포함 파일

- `compose.production.example.yml`: 앱 6개, PostgreSQL, 선택 의존성 Redis, Caddy의 자원·네트워크 설정.
- `Caddyfile.example`: 도메인별 HTTPS 라우팅. admin 로그인·MFA·권한은 앱에서 구현해야 한다. 환경변수와 site block 문법은 [공식 Caddy 문서](https://caddyserver.com/docs/caddyfile/concepts)를 따른다.
- `blog-permissions.example.sql`: 새 DB의 blog 스키마에 대한 1회용 권한 예시. 실제 실행 시 다른 앱 5개도 독립 계정·스키마로 생성한다.
- `presence-heartbeat.lua`: Redis 서버 시각을 사용하는 최근 5분 heartbeat 기록·정리. 단일 Redis용이며, 정확한 실인원이나 유실 없는 분석 데이터가 아니다.

## 적용 전에 필요한 값

배포 전용 비공개 작업 디렉터리로 예제를 복사한다. Compose 파일 옆 `.env`에는 실제 `BASE_DOMAIN`과 `INGRESS_IMAGE`, `POSTGRES_IMAGE`, `REDIS_IMAGE`, `BLOG_IMAGE`, `CV_IMAGE`, `INTRO_IMAGE`, `SERVICE_D_IMAGE`, `SERVICE_E_IMAGE`, `ADMIN_IMAGE`을 설정한다. 이미지 값은 검증한 `registry/name@sha256:...` 형식으로 고정한다. 예시용 가짜 digest는 제공하지 않는다.

`env/<app-name>.env` 6개에는 앱별 `DATABASE_URL`, 자기 Redis ACL 계정의 `REDIS_URL`, 필요한 서비스 인증·객체 저장소·세션 설정을 넣는다. 예를 들어 blog runtime URL은 `postgresql://blog_runtime:<URL-encoded-password>@postgres:5432/codelily_production`이고 Prisma adapter의 schema와 migration 설정은 `blog_schema`로 맞춘다. 코드에서 풀 크기를 명시한다. 각 앱 환경변수 이름·필수 여부는 앱의 검증 스키마로 확정한다.

`secrets/pg-bootstrap-password.txt`에는 bootstrap DB 비밀번호를 넣는다. 이 비밀번호는 앱에 제공하지 않는다. 이 설정은 빈 PostgreSQL volume을 처음 초기화할 때 적용되며 파일만 수정한다고 기존 DB 비밀번호가 변경되지는 않는다.

`secrets/redis-users.acl`에는 `default` 사용자를 끄고 앱별 ACL을 정의한다. 각 앱 키 prefix·필요 명령만 허용한다. cache 명령과 Lua가 사용하는 `TIME`, `ZREMRANGEBYSCORE`, `ZSCORE`, `ZCARD`, `ZADD`, `PEXPIRE`, 선택한 `EVAL`/`EVALSHA` 등을 실제 client 호출로 검증한다. `+@all`·`~*` 같은 광범위 권한을 앱 기본값으로 쓰지 않는다. 인증 없는 Redis healthcheck를 추가하지 않는다.

`env/`·`secrets/`·`.env`는 Git에 넣지 않고 호스트 파일 권한을 제한한다. Compose 파일 기반 secret은 호스트 파일을 마운트하는 방식이며 그 자체로 암호화된 비밀 저장소가 되지 않는다. env_file 값도 컨테이너 환경에 들어가므로 Docker 관리 권한을 제한한다.

## 실행 전 확인

1. 실제 버전의 Node·Next·Prisma를 고정하고 Linux CI에서 앱 이미지를 만든다. 이미지 내부에서 non-root 사용자로 실행하며 `HOSTNAME=0.0.0.0`, `PORT=3000`과 `/health/live`, `/health/ready`를 지원한다.
2. 새 DB에서 앱별 계정·권한을 bootstrap하고 안전한 절차로 고유 비밀번호를 설정한다. 스키마·계정 예시는 운영 DB에 검토 없이 재실행하지 않는다.
3. 앱별 migration을 1회 직렬 실행한다. runtime에는 migration credential을 주지 않는다.
4. 비밀값을 준비한 배포 디렉터리에서 `docker compose -f compose.production.example.yml config --quiet`를 실행한다. 정규화된 설정 전체는 비밀이 포함될 수 있으므로 공유 로그에 출력하지 않는다.
5. DNS, TLS, 관리자 인증, 외부 백업을 구성하고 앱 하나씩 readiness와 핵심 기능을 확인한다. 예제에는 배포 자동화·백업 스케줄러가 포함되어 있지 않다.

Redis는 필수가 아닌 캐시라서 앱의 시작 의존성에 넣지 않았다. 앱은 Redis 미접속 시 빠르게 우회하고 별도 재연결·관측을 구현해야 한다. 앱과 프록시의 `ingress` 네트워크는 외부 API·저장소 접근도 허용한다. 따라서 이 네트워크를 앱 간 강한 보안 격리로 간주하지 않는다. 내부 API에는 별도 인증이 필요하다.

최초 blog migration 후에는 migrator 계정으로 `REVOKE ALL ON TABLE blog_schema."_prisma_migrations" FROM blog_runtime;`를 실행한다. 다른 앱도 자기 migration 이력 테이블의 runtime 권한을 회수한다. 기본 권한은 새 테이블 전반에 적용되므로 민감 운영 테이블이 추가될 때 별도 권한 검토가 필요하다.

Compose healthcheck는 liveness이고 DB의 `pg_isready`는 서버 수신 상태 확인이다. 실제 계정 인증·권한·migration 적용은 앱 readiness와 통합 검사로 확인한다. 이 예제의 Caddy는 unhealthy 앱 자동 제외·무중단 전환을 구현하지 않는다.

presence 읽기는 `TIME`으로 얻은 서버 시각에서 300,000ms를 뺀 값을 exclusive lower bound로 넣어 `ZCOUNT`한다. 재시작·축출·cardinality cap 발생은 `warming`/`limited` 등으로 사용자에게 표시한다. 각 앱은 자기 Redis만 읽어 운영 요약 API로 반환하며 admin에 모든 앱의 Redis 쓰기 권한을 주지 않는다.

## 이 예제에서 가능한 정적 검증

비밀 파일·앱 이미지가 없는 상태에서도 다음 명령으로 Compose 스키마를 확인할 수 있다.

```powershell
docker compose -f docs/examples/msa/compose.production.example.yml config --no-interpolate --no-env-resolution --quiet
```

이는 실제 이미지 존재·secret 파일·네트워크·DB·Lua·TLS·메모리·로그인 동작을 검증하지 않는다. 실제 부하·장애·복원 인수 조건은 상위 문서에 명시했다.

2026-11-02 작성 시 Compose 구문 검증과 정규화된 모델의 앱 6개·메모리 상한 합계 2,720 MiB·DB/Redis host 포트 비공개·data 네트워크 internal 설정을 확인했다. Markdown 내부 파일 링크와 코드 블록 닫힘도 확인했다. SQL·Lua·Caddy의 실제 실행 및 애플리케이션 통합 검증은 수행하지 않았다.
