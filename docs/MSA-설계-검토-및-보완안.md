# Codelily 설계 검토 및 구현 보완안

> 과거 4GB·6앱 가정의 검토 기록이다. 현재 확정된 8GB iwinv·Next.js·Cloudflare Tunnel/R2/ISR 구현 기준은 [현재 아키텍처 결정](architecture/결정기록.md)과 [진행현황](진행현황.md)을 따른다.

검토일: 2026-11-02 · 대상: `MSA 프로젝트.md` · 배포 환경: Linux VPS, 2 vCPU / 4 GiB RAM / SSD 40 GB 이상

## 1. 판단과 전제

**조건부로 타당하다.** 모노레포, 앱별 컨테이너, 공유 PostgreSQL·Redis, 외부 객체 저장소는 소규모 개인 서비스 운영에 적합하다. 다만 원문의 “완전한 운영·확장 독립성”, “6개 Next.js 앱의 안정적 구동”, “암묵적 캐시 무효화”는 현재 설계만으로 성립하지 않는다.

이 구조는 **공유 인프라를 사용하는 앱별 독립 배포 구조**로 정의한다. 앱이 각자 도메인 로직과 데이터를 소유하고 API 경계를 지킬 때 경량 MSA로 운영할 수 있다. 컨테이너 분리만으로 MSA가 되지는 않는다. PostgreSQL, Redis, 디스크, 네트워크, 호스트 장애의 영향은 공유한다.

standalone은 배포 산출물을 줄이는 방식이다. 이 설계는 앱 6개만으로도 Node 실행 프로세스를 6개 사용하므로 “멀티 프로세스 오버헤드 없음”이라는 표현은 삭제한다. JVM 사용 여부만으로 더 낮은 메모리 사용량을 보장할 수도 없다.

보완안은 초기 저트래픽, 앱당 실행 프로세스 1개, 서비스 간 강한 트랜잭션 요구 없음, 한 명 또는 소수 운영자를 가정한다. 실제 요청량, SSR 비율, 데이터 크기, PDF 생성 방식은 제공되지 않았다. 아래 자원·지연·복구 수치는 **초기 제안값이며 실측 성능이나 가용성 보장이 아니다.**

현재 작업 폴더에는 구현 앱이 없어 코드·실서버 검증은 수행하지 않았다. 이 문서와 `examples/msa/`는 구현에 사용할 기준과 설정 예제다. 원본 설계서는 수정하지 않았다.

## 2. 우선 수정할 사항

| 우선순위 | 원문 설계 | 판단과 보완 |
|---|---|---|
| P0 | `allkeys-lru` Redis에 세션 7일 저장 | TTL 이전에도 세션이 축출된다. 세션 원본은 앱 소유 PostgreSQL 테이블에 저장한다. Redis에는 재생성 가능한 데이터만 둔다. |
| P0 | 공용 `db_user`로 모든 스키마 접근 | `schema=`는 접근 제어가 아니다. 앱별 runtime·migration 계정과 권한을 분리한다. |
| P0 | admin이 원격 컨테이너 제어 | 제어 경로·권한·감사 설계가 없다. 첫 버전은 상태 조회만 제공하고 배포·재시작은 CI 또는 운영자 SSH로 수행한다. |
| P0 | 백업·복원 규정 없음 | 외부 백업, 보존 기간, 복구 목표, 정기 복원 검증을 출시 조건으로 추가한다. Docker volume은 백업이 아니다. |
| P1 | 5개 앱 + admin 목표이나 Compose에는 앱 4개만 존재 | service-d/e를 각 300M로 포함하면 원문 제한 표기 합계는 3,550M이다. 단위 차이와 OS·Docker·빌드·일시 피크를 고려한 예산이 필요하다. |
| P1 | `connection_limit=5`로 모든 ORM 풀 제어 | 드라이버·버전마다 다르다. Prisma v7/pg는 adapter의 `max` 등으로 제어한다. |
| P1 | TTL/LRU를 암묵적 무효화로 규정 | 만료·축출과 정합성 갱신을 구분한다. DB commit 후 명시적 삭제·버전 변경을 사용한다. |
| P1 | 매 요청 middleware에서 Redis 기록 | 정적 파일·프리패치·봇까지 포함되고 Redis 장애가 요청에 전파될 수 있다. 별도 heartbeat endpoint로 변경한다. |
| P1 | `SCAN` 결과 개수 합산 | 전체 순회 비용과 중복·동시 변경 문제가 있다. ZSET의 시간 범위 집계로 변경한다. |
| P1 | 치명적 오류를 비동기로 admin DB에 기록 | 프로세스 종료와 DB 장애 시 유실된다. stdout 운영 로그와 내구성 있는 업무 감사 이벤트를 분리한다. |
| P1 | 업로드만 로컬 저장 금지 | Next 캐시·임시 파일·PDF 생성도 규칙을 정해야 한다. 사용자 파일의 영속 저장만 객체 저장소로 강제한다. |
| P2 | 중앙 Prisma Client와 전역 DTO 공유 | 데이터 소유권·배포 결합이 생긴다. DB 모델은 앱별, 공유 패키지는 기술 유틸과 API 계약으로 제한한다. |

LRU는 TTL이 남아 있는 키도 메모리 압박 시 제거한다. `noeviction`으로 바꿔도 재시작·영속성·용량 초과 쓰기 실패를 해결하는 것은 아니다. [Redis 축출 정책](https://redis.io/docs/latest/develop/reference/eviction/)

## 3. 권장 배치와 서비스 경계

```text
사용자 ── HTTPS ── Caddy(도메인별 라우팅)
                        ├─ tech-blog
                        ├─ cv-builder
                        ├─ intro-page
                        ├─ service-d
                        ├─ service-e
                        └─ admin-dashboard

각 앱 ── 자기 runtime 계정 ── PostgreSQL 단일 인스턴스 / 앱별 스키마
각 앱 ── 자기 Redis ACL 계정 ── Redis 단일 인스턴스 / 캐시·presence
브라우저 ── 단기 서명 URL ── 외부 객체 저장소
admin ── 인증된 internal API ── 각 앱의 운영 요약
CI/운영자 ── 배포 권한 ── 이미지 교체·마이그레이션·재시작
```

초기에는 앱당 컨테이너 1개로 시작한다. SSR·인증·API가 필요 없는 소개 페이지는 정적 배포 후보로 둔다. 모든 앱을 Next.js 서버로 강제하면 저사양 운영의 이점이 줄어든다. service-d/e의 실제 역할이 결정되기 전에는 이름만으로 도메인·DB 모델을 만들지 않는다.

공통 사용자·데이터를 여러 앱이 빈번히 함께 수정하고 함께 출시해야 한다면 앱 수를 줄인 모듈형 모놀리스가 더 적합하다. 반대로 독립 도메인·출시 주기가 실제로 있으면 현재 분리를 유지한다. Kubernetes, Kafka, 서비스 메시, 별도 API gateway 플랫폼은 초기 범위에 추가하지 않는다.

| 앱 | 소유 데이터 | 다른 서비스가 접근하는 방법 |
|---|---|---|
| tech-blog | 글, 댓글, 공개 설정, 해당 앱 세션 | 공개 API / 운영 요약 API |
| cv-builder | 이력서, 포트폴리오 메타데이터, 해당 앱 세션 | 소유자 인증 API / 최소 운영 통계 |
| intro-page | 생성 작업, 외부 AI 사용량·예약량 | 해당 앱 API |
| service-d/e | 요구사항 확정 후 정의 | 소유 서비스 API |
| admin-dashboard | 관리자 권한, 운영 작업 감사, 수집 통계 | 관리자 API |

다른 앱의 테이블 직접 조회·갱신, 교차 스키마 FK·트리거·조인, 공유 ORM 모델을 금지한다. admin도 각 앱의 원본 이력서·세션을 DB로 조회하지 않는다. 운영 API는 집계치만 반환한다.

## 4. 모노레포와 빌드 구조

```text
apps/
  tech-blog/         # src/, prisma/schema.prisma, prisma/migrations/
  cv-builder/        # 앱별 client 생성·DB 코드·migration 소유
  intro-page/
  service-d/
  service-e/
  admin-dashboard/
packages/
  db-runtime/        # pool 설정·오류 변환만, 전역 DB 모델 없음
  cache/             # namespacing, timeout, 직렬화
  contracts/         # 버전별 DTO + 런타임 검증 스키마
  observability/     # 로그 redaction, requestId
  config/            # 환경변수 검증, TS/ESLint 공통 설정
  ui/                # 필요한 경우에만 공유 UI
infra/
  compose/           # 배포 템플릿·프록시·DB bootstrap
  runbooks/          # 배포, rollback, 복구
```

Turborepo와 pnpm을 사용하고 lockfile을 고정한다. DB 구현은 이 보완안에서 **Prisma v7 + PostgreSQL pg adapter**를 기준으로 한다. Drizzle을 선택한다면 앱 전체에서 한 방식을 유지하고 pg 풀 설정은 동일하게 명시한다. 두 ORM을 공통 DB 패키지에서 혼용하지 않는다.

CI에서 앱별 이미지를 만들고 commit SHA 태그와 digest를 기록한다. 공유 패키지 변경 시 영향받는 앱도 다시 검증한다. 운영 VPS에서는 `next build`, 의존성 설치, 이미지 빌드를 실행하지 않는다. CI 빌드에는 운영 DB·비밀키를 주입하지 않으며, 빌드 중 데이터 조회가 필요한 페이지는 정적 콘텐츠 스냅샷 또는 요청 시 조회로 바꾼다.

`output: 'standalone'`을 사용하고 모노레포 루트로 `outputFileTracingRoot`를 설정한다. 런타임 이미지에는 추적된 의존성과 앱별 `public`, `.next/static`, 생성된 Prisma Client를 포함한다. monorepo 결과에서는 `server.js`가 `apps/tech-blog/server.js`처럼 중첩될 수 있으므로 빌드 산출물 경로를 CI에서 확인한다. standalone이 RAM 상한을 보장하는 것은 아니다. [Next.js standalone 출력](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/output)

## 5. PostgreSQL 격리와 풀

### 5.1 스키마와 계정

스키마는 `blog_schema`, `resume_schema`, `intro_schema`, `service_d_schema`, `service_e_schema`, `admin_schema`로 나눈다. runtime 계정은 자기 스키마의 필요한 DML만 가진다. migration 계정은 자기 스키마의 DDL을 수행하며 CI의 일회성 작업에만 제공한다. bootstrap superuser를 앱에 주입하지 않는다.

`search_path`와 `schema=`는 이름 해석 설정이다. 실제 차단은 스키마·테이블·시퀀스 권한과 역할 멤버십으로 수행한다. 이 구분은 PostgreSQL의 스키마 권한 모델에 근거한다. [PostgreSQL 16 스키마와 권한](https://www.postgresql.org/docs/16/ddl-schemas.html)

실행 순서 예시는 `examples/msa/blog-permissions.example.sql`을 참조한다. 모든 객체는 소유 migration 계정으로 생성하고 그 계정에 `ALTER DEFAULT PRIVILEGES`를 적용해야 한다. 다른 계정이 생성하면 기본 권한이 자동 적용되지 않는다. runtime 계정은 다른 owner 역할에 속하지 않아야 하며 `SUPERUSER`, `BYPASSRLS`, `CREATEDB`, `CREATEROLE`을 갖지 않는다.

schema-per-service를 유지해도 DB 메모리·I/O·연결 한도·장애 범위는 공유한다. 같은 PostgreSQL 인스턴스 내 database-per-service는 별도 서버 프로세스를 추가하지 않고 네임스페이스 경계를 강화하는 대안이다. 다만 인스턴스 장애 격리 효과는 없으며, 현 단계에서는 역할로 보호한 스키마 분리를 유지해도 충분하다.

### 5.2 연결 예산

초기 제안은 PostgreSQL `max_connections=50`, 앱별 풀 최대 3개다.

```text
정상 앱 연결 상한       6 × 3 = 18
한 앱 교체 중 중첩       1 × 3 =  3
향후 별도 worker 예산           2
migration 동시 실행 1개         2
백업·운영·관측 예산             5
합계                          30 < 50
```

superuser 예약 연결 등 실제 사용 가능한 한도를 빼고 검증한다. 이 숫자는 연결 슬롯 예산이며 메모리 안전성을 보장하지 않는다. 앱당 여러 프로세스나 replica를 추가하면 풀도 곱해진다. 풀을 3으로 줄이면 요청이 대기할 수 있으므로 쿼리 지연과 풀 대기 시간을 함께 측정한다. 풀 크기를 URL 문자열만 보고 검증하지 않는다.

Prisma v7에서는 드라이버 adapter가 풀을 관리한다. 원문의 `connection_limit`, `pool_timeout`을 그대로 적용한다고 가정하면 안 된다. v6 기본 엔진 URL 설정과 v7 adapter 설정을 구분해야 한다. [Prisma 연결 풀](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool)

앱별 초기화 예시다. client import 경로는 해당 앱의 생성 설정에 맞춘다.

```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const createDb = () => new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: 3,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 10_000,
    application_name: 'tech-blog',
  }, { schema: 'blog_schema' }),
});

const globalDb = globalThis as unknown as { blogDb?: PrismaClient };
export const db = globalDb.blogDb ?? createDb();
if (process.env.NODE_ENV !== 'production') globalDb.blogDb = db;
```

위 예시는 검증된 환경변수를 받는 앱별 모듈에서 실행하고 요청마다 client를 만들지 않는다. CLI migration URL과 runtime adapter의 스키마를 일치시키며, Prisma 모델의 스키마 매핑도 해당 버전 설정에 맞춘다. 생성 migration이 다른 스키마를 건드리지 않는지 CI에서 확인한다. 시작 시 실제 `current_user`, 대상 테이블 스키마, 관찰된 연결 수를 검증한다.

`connectionTimeoutMillis`는 쿼리 실행 시간 제한이 아니다. runtime 역할에 초기 `statement_timeout=5s`, `lock_timeout=1s`, `idle_in_transaction_session_timeout=10s`를 검토하고 긴 관리 작업은 별도 제한을 둔다. `pg`의 풀 옵션 의미는 [node-postgres Pool 문서](https://node-postgres.com/apis/pool)를 따른다. PgBouncer는 다중 replica 등으로 연결 압력이 실제 발생할 때 추가한다.

### 5.3 마이그레이션

앱 시작 명령에 migration을 묶지 않는다. 앱별 migration을 배포 전에 한 번 실행하고 동일 앱의 migration은 직렬화한다. 운영에서는 개발용 shadow database가 필요한 명령을 실행하지 않는다.

순서는 호환 필드 추가 → 구·신 버전이 함께 동작하는 앱 배포 → 데이터 backfill → 충분한 관찰 후 구필드 제거다. 이미지 rollback과 DB rollback은 다르다. 파괴적 스키마 변경은 즉시 rollback 가능한 것으로 취급하지 않는다.

default privilege로 테이블 DML을 일괄 부여하면 `_prisma_migrations`에도 runtime 권한이 생길 수 있다. 최초 migration 후 해당 테이블의 runtime 권한을 회수하고, 업무 테이블에만 필요한 권한이 있는지 배포 검사에 포함한다. migration 이력은 runtime 앱이 수정하면 안 된다.

## 6. Redis의 역할과 캐시 정합성

Redis 단일 인스턴스는 **캐시와 유실 허용 presence**에만 사용한다. 세션·내구성 있는 작업 큐·권한·정확한 과금 제한·업무 감사의 원본으로 사용하지 않는다. 초기 `maxmemory 128mb`, `allkeys-lru`, 컨테이너 256 MiB로 시작하고 실제 RSS·fragmentation·축출률을 측정해 조정한다. 이 예산도 안전성이 검증된 수치는 아니다.

환경과 앱을 포함한 `cl:prod:blog:cache:v1:post:<id>` 형식을 사용한다. prefix는 충돌 방지이며 접근 제어가 아니다. 앱별 Redis ACL 계정으로 키와 명령을 제한하고, Pub/Sub을 도입하면 채널 권한도 따로 설정한다. Redis logical DB 번호도 메모리·장애 격리를 제공하지 않는다. [Redis ACL](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/)

| 데이터 | 저장 위치 | 만료·정합성 |
|---|---|---|
| 공개 글 캐시 | Redis | 초기 TTL 60~300초 + jitter, 수정 후 삭제 |
| 이력서·로그인 세션 | PostgreSQL | 앱별 만료·폐기·소유자 검증, 민감 응답 공용 캐시 금지 |
| 공개 AI 생성 결과 | PostgreSQL 원본 + Redis 선택 | 입력·모델·프롬프트 버전별 키, 재사용 허용 결과만 |
| 개인 이력서 기반 AI 결과 | PostgreSQL | 사용자별 권한 적용, 다른 사용자와 캐시 공유 금지 |
| 접속 현황 | Redis ZSET | 최근 5분, 재시작·축출 시 불완전함을 UI에 표시 |
| 과금 한도·관리자 작업 | PostgreSQL | 트랜잭션·멱등키로 처리 |

캐시는 read-through로 조회한다. Redis 실패 시 짧은 deadline 후 DB로 우회하고 재연결 대기열을 무한히 쌓지 않는다. DB 보호를 위해 요청 동시성·응답 크기를 제한하고 과부하 시 429/503을 반환한다.

쓰기 흐름은 DB commit → 해당 키 삭제 → 실패 시 재시도 또는 TTL까지 오래된 값 허용이다. 삭제만으로 동시 읽기의 stale 재삽입을 완전히 막지는 못한다. 공개 글은 초기 최대 5분 stale을 허용하되 게시 취소·개인정보 공개 해제는 권위 DB의 공개 여부를 매 요청 확인한다. 강한 정합성이 필요한 데이터는 캐시하지 않는다. 도메인상 허용할 수 없다면 버전 키와 durable invalidation outbox로 확장한다.

Next.js의 ISR/Data Cache와 앱 Redis 캐시는 별개다. 첫 버전의 단일 replica에서는 로컬 캐시를 재생성 가능하게 운영한다. 여러 replica로 늘릴 때는 사용하는 Next.js 버전에 맞춰 캐시 공유·revalidation 전파·배포 버전 일관성을 추가 검증한다. [Next.js 자체 호스팅](https://nextjs.org/docs/app/guides/self-hosting)

## 7. 접속자와 통계 수집

지표 이름을 “최근 5분 내 heartbeat를 보낸 고유 브라우저 세션 수”로 정한다. 실인원·동시 TCP 연결 수·정확한 사용자 수를 의미하지 않는다. 동일 사용자의 여러 브라우저는 별도로 셀 수 있다. 앱 간 단순 합계는 전체 고유 사용자 수가 아니다.

`SCAN MATCH`는 해당 prefix만 별도 인덱스로 순회하지 않는다. 전체 iteration은 O(N)이고, `COUNT`는 정확한 페이지 크기가 아니며 중복 반환·동시 변경을 고려해야 한다. 원문의 단순 `count += keys.length`는 정확한 집계가 아니다. [Redis SCAN 보장과 제약](https://redis.io/docs/latest/commands/scan/)

권장 흐름은 다음과 같다.

1. 동적 앱 화면 진입 후, 탭이 활성 상태일 때 `POST /api/presence`를 60초 간격으로 호출한다. 쿠키의 난수 ID를 서버에서 HMAC 처리해 member로 사용한다. IP를 member나 원시 로그에 기록하지 않는다.
2. endpoint는 Origin·요청 크기·빈도·식별자를 검증한다. 임의 member를 직접 받지 않는다. heartbeat 억제와 cardinality 상한을 둔다. 봇 완전 제거는 보장하지 않는다.
3. 앱은 자기 ZSET에 시각을 갱신한다. `examples/msa/presence-heartbeat.lua`는 Redis 서버 시간을 사용해 기록과 오래된 member 정리를 원자적으로 수행한다.
4. 앱의 운영 API는 `ZCOUNT key (now-300000 +inf`로 해당 시각의 창을 집계한다. 읽기 시각도 Redis `TIME` 기준으로 맞춘다. admin은 인증된 앱별 운영 API를 10초 간격으로 병렬 호출하되, 앱마다 약 1초 deadline을 둔다.
5. 응답은 `count`, `asOf`, `windowSeconds`, `status`를 포함한다. Redis 장애 때 0명으로 위장하지 않고 `unavailable`을 반환한다. 재시작·축출 후에는 초기 5분을 `warming` 또는 추정치로 표시한다.

member별 TTL이 아닌 score로 창을 판정한다. 키 전체 TTL은 서비스가 조용해졌을 때 정리하기 위한 것이다. 오래된 member 정리 비용은 제거 개수에 영향을 받으므로 지표용 cardinality 상한을 두고 큰 청소 작업을 요청 경로에 몰지 않는다. Lua 사용 계정에는 실제 스크립트가 쓰는 명령과 키 권한만 부여하고 ACL 통합 검사를 한다. [Redis sorted set](https://redis.io/docs/latest/develop/data-types/sorted-sets/)

전역 middleware에 Redis I/O를 넣는 설계는 제거한다. 최신 Next.js 문서는 `proxy.ts`와 Node.js runtime을 설명하므로 “middleware는 항상 Edge이며 TCP를 쓸 수 없다”는 단정도 피한다. 프로젝트의 고정 버전에서 확인하되, telemetry는 별도 endpoint에 둔다. [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

## 8. 관리자·로그·업무 이벤트

관리자는 별도 로그인과 MFA, 허용 사용자 목록, 서버 측 역할 검사를 적용한다. 앱별 세션은 host-only `Secure`, `HttpOnly`, 적절한 `SameSite` 쿠키로 발급한다. 상태 변경 요청은 Origin/CSRF 검증을 수행한다. 통합 로그인이 실제 요구되면 외부 OIDC 제공자를 사용하고 앱마다 별도 세션을 유지한다. 모든 하위 도메인이 공유하는 광범위한 세션 쿠키는 기본값으로 사용하지 않는다.

서버 세션에는 충분한 난수 토큰을 사용하고 DB에는 토큰 원문 대신 해시와 `user_id`, `expires_at`, `revoked_at`을 저장한다. 토큰 해시의 고유 인덱스와 만료 정리용 인덱스를 둔다. 로그아웃·권한 변경 때 폐기하고 만료 row는 제한된 크기의 정리 작업으로 삭제한다. 매 요청 세션 갱신 쓰기를 강제하지 않으며, 인증 구현은 검증된 라이브러리를 기준으로 구성한다.

admin의 내부 API 호출은 TLS 또는 신뢰하는 내부 경로와 앱별 audience를 가진 단기 서비스 자격증명을 사용한다. 일반 사용자 세션과 서비스 자격증명을 분리한다. `admin`이라는 서비스 이름이나 내부 네트워크 주소 자체를 인증으로 취급하지 않는다.

admin 컨테이너에 `/var/run/docker.sock`, Docker 원격 무제한 API, 호스트 root SSH 키를 제공하지 않는다. 초기 재시작·배포는 CI 또는 운영자가 수행한다. 웹 제어가 꼭 필요해지면 allowlist 작업만 받는 별도 호스트 에이전트, 재인증, 권한 분리, 멱등 job ID, 영속 감사 이력을 먼저 설계한다. 임의 shell 실행 기능은 제공하지 않는다.

로그는 JSON stdout에 `timestamp`, `level`, `service`, `release`, `requestId`, `event`, `durationMs`, `errorCode` 등을 기록한다. 토큰·쿠키·비밀키·이력서 본문·AI 입력·응답은 기본적으로 제외한다. Docker 로그는 회전하고 외부 에러 수집 또는 호스트 로그 수집으로 프로세스 사망·OOM을 관측한다. 치명적 오류를 처리한 프로세스는 불명확한 상태로 계속 서비스하지 않는다.

분리할 내구성 수준은 다음과 같다.

- 일반 요청 로그·접속 통계: 일부 유실 허용. 앱→admin DB 직접 기록을 하지 않는다.
- 관리자 권한 변경·중요 업무 이벤트: 변경을 소유한 DB 트랜잭션 안에서 audit/outbox를 함께 저장한다. 원본 기록 실패 시 변경도 실패한다.
- 서비스 간 전달이 필요한 업무 이벤트: 필요해질 때 별도 worker가 outbox를 읽어 재시도하고 소비자는 event ID로 중복 처리한다. 재시도 횟수·다음 시각·최종 실패 상태를 DB에 보존한다. 이 worker는 초기 필수 컨테이너가 아니며 도입 시 자원 예산에 포함한다.

Redis Pub/Sub은 구독자 부재·연결 중단 시 메시지를 잃는 at-most-once 전달이다. 상태 변경의 원본·작업 큐·dead-letter 저장소로 쓰지 않는다. 첫 버전 admin은 polling으로 충분하다. [Redis Pub/Sub 전달 의미](https://redis.io/docs/latest/develop/use-cases/pub-sub/)

## 9. 업로드·MDX·AI·PDF

업로드는 인증 → 허용 MIME·크기·사용자 quota 확인 → 앱이 생성한 난수 object key와 짧은 유효기간의 서명 URL 발급 → 브라우저 직접 업로드 → 완료 API의 HEAD 확인 → 메타데이터 확정 순서다. 서명 방식이 크기 조건을 강제하는지 저장소별로 확인하고, 불가능하면 완료 시 검증 및 초과 파일 삭제를 수행한다. MIME·확장자만으로 파일이 안전하다고 보지 않는다.

미완료 업로드·미참조 객체의 수명 정책을 둔다. 이력서·PDF는 비공개 버킷과 인증 후 발급하는 다운로드 URL을 사용한다. 공개 이미지는 별도 공개 prefix/버킷으로 분리한다. 임의 URL을 서버가 가져오는 기능은 제한해 SSRF 경로를 막는다. 저장소 CORS와 권한도 앱별로 제한한다.

“Zero-Local File Storage”는 **사용자 파일의 로컬 영속 보관 금지**로 다시 정의한다. PostgreSQL volume, 프록시 TLS 상태, 회전 로그, 재생성 가능한 Next 캐시와 제한된 임시 파일은 로컬 사용이 필요할 수 있다. 배포 시 날아가도 되는 것과 백업할 원본을 구분한다. 엄격한 read-only root filesystem을 적용하려면 실제 쓰기 경로를 먼저 측정하고 tmpfs/캐시 mount를 명시한다.

블로그 MDX는 신뢰된 작성자 콘텐츠만 빌드·실행한다. 사용자 댓글이나 외부 입력을 MDX 코드로 실행하지 않는다. 사용자 입력은 일반 Markdown과 허용 HTML 정제로 처리한다.

AI 호출은 서버에서 수행하고 키를 브라우저·`NEXT_PUBLIC_*`에 넣지 않는다. 입력·출력 길이, 동시 호출 수, 사용자별 quota, 일별 비용 상한, timeout을 둔다. 정확한 비용 상한은 PostgreSQL에서 예상 사용량 예약 → 호출 → 실제 사용량 정산으로 제어하고, 중복 요청을 멱등키로 차단한다. timeout 후 과금 여부가 불명확한 요청은 무작정 재시도하지 않는다. 제공자·모델·프롬프트 버전을 기록하며 외부 AI 장애는 해당 기능에 한정한다.

Chromium 기반 PDF 생성, 대용량 이미지 변환, 로컬 AI 추론은 2 vCPU·4 GiB에서 다른 앱과 자원을 강하게 경쟁한다. PDF가 필요하면 우선 외부 렌더러 또는 별도 작업 환경을 사용한다. 로컬 렌더링이 필수라면 동시 실행 1개, 별도 메모리 예산, 작업 timeout을 추가하고 전체 용량 계획을 다시 세운다.

## 10. 초기 자원·운영 설정

다음은 **메모리 제한의 초기 실험값**이다. 실제 앱의 idle RSS, SSR 피크, native buffer, 이미지 처리, GC를 측정하기 전에는 운영 적합성을 확정하지 않는다.

| 항목 | 초기 컨테이너 상한 | 비고 |
|---|---:|---|
| 일반 앱 5개 | 5 × 256 = 1,280 MiB | 각 Node heap 초기 160 MiB, 실제 피크 검증 |
| admin | 320 MiB | 집계·화면 조회 중심 |
| PostgreSQL | 768 MiB | shared_buffers 128 MiB, work_mem 2 MiB부터 측정 |
| Redis | 256 MiB | maxmemory 128 MiB, RSS 여유 확인 |
| Caddy | 96 MiB | TLS 상태 volume, 트래픽 검증 |
| **컨테이너 합계** | **2,720 MiB** | build·PDF worker 제외 |
| OS·Docker·운영·피크 여유 | **약 1,376 MiB** | 실제 물리 메모리가 4 GiB일 때의 산술 잔여 |

별도 worker 128 MiB를 추가하면 합계는 2,848 MiB, 잔여는 1,248 MiB다. 잔여 메모리는 전부 자유롭게 쓸 수 있는 예약 용량이 아니며 호스트·cgroup 관측으로 확인한다. Node heap 제한은 프로세스 RSS 제한이 아니다. 앱이 이 예산에서 OOM이면 무조건 heap만 올리지 않고 정적화·앱 통합·서버 증설을 판단한다.

PostgreSQL의 `work_mem`은 연결당 고정 할당이 아니라 연산·병렬 worker 등에 따라 여러 번 사용될 수 있다. CPU 제한의 합은 2 vCPU를 넘을 수 있지만 이를 동시 처리 용량이나 예약 CPU로 해석하지 않는다. 작은 서버에서 앱을 동시에 빌드·백업·배포하지 않는다.

Compose 예시는 `examples/msa/compose.production.example.yml`이다. 모든 앱 6개를 포함하며 앱별 env 파일·Redis ACL·DB 비밀 파일·digest 이미지가 별도로 필요하다. 기본 포트는 80/443만 공개한다. DB·Redis는 host port를 열지 않는다. 앱은 Node 이미지의 non-root 사용자로 실행하도록 이미지 자체에서 설정한다.

일반 Compose에서 제한 의도를 분명히 하려고 `mem_limit`·`cpus`를 사용한다. 원문의 `deploy.resources`가 Compose에서 언제나 무시된다고 단정하지는 않는다. 실제 지원과 적용은 Compose/Engine 및 `docker inspect`로 확인한다. `depends_on: service_healthy`는 시작 순서 제어이며 런타임 장애 복구나 DB migration 완료를 보장하지 않는다. [Compose 서비스 설정](https://docs.docker.com/reference/compose-file/services/)

`/health/live`는 프로세스의 응답 가능 여부만 확인한다. `/health/ready`는 짧은 deadline의 DB 조회와 필수 설정을 확인하고 Redis는 선택 의존성으로 보고 degraded 상태를 표현한다. Compose의 unhealthy만으로 자동 재시작되지는 않는다. 배포 스크립트는 ready 성공을 확인한 후 성공으로 종료해야 하며 프록시도 별도 health 정책 없이는 unhealthy 컨테이너를 자동 제외하지 않는다.

로그 초기 한도는 컨테이너별 10 MiB × 3개다. SSD에는 DB·WAL·Docker 이미지·캐시·로그·백업 임시 공간이 모두 들어간다. 40 GB에서 여유 20% 이하 또는 8 GB 이하가 되면 경보를 내고 불필요한 이미지를 명시적으로 정리한다. 데이터 volume을 지우는 전역 prune을 정기 작업으로 등록하지 않는다. [Docker 로그 설정](https://docs.docker.com/engine/logging/configure/)

## 11. 배포·백업·실패 동작

배포는 CI 빌드·검사 → 이미지 digest 고정 → 호환 migration → 앱 하나씩 교체 → readiness → 로그인·핵심 기능 smoke test 순서다. 최초에는 수 초의 앱별 중단을 허용하는 stop/start도 선택 가능하다. 무중단은 별도 요구사항이며 구·신 컨테이너 메모리, 프록시 전환, 정적 자산·Server Action 호환성을 확보해야 한다. 단일 VPS에서는 호스트 무중단을 보장할 수 없다.

초기 백업 정책 제안은 매일 암호화한 DB 논리 백업을 외부 저장소로 전송하고 7일 일간·4주 주간 보존하는 것이다. 논리 백업만 사용할 때 RPO 목표는 최대 24시간, 초기 RTO 목표는 2시간이며 실제 복구 훈련으로 검증한다. 더 작은 RPO가 필요하면 base backup + WAL archiving/PITR를 구성한다. `pg_dump`만으로 PITR가 되지는 않는다. 역할·권한·필요 확장·설정 복구 자료도 별도로 보존한다. [PostgreSQL 연속 아카이빙과 PITR](https://www.postgresql.org/docs/16/continuous-archiving.html)

객체 저장소도 삭제·덮어쓰기 복구 정책을 둔다. DB 복원 시점과 객체 상태가 어긋날 수 있으므로 객체 키는 불변으로 생성하고 참조 해제 후 실제 삭제까지 유예 기간을 둔다. 매월 격리된 환경에서 DB와 객체 참조를 복원하고 로그인·이력서 조회·파일 다운로드까지 확인한다. 백업 성공 로그만으로 복구 가능하다고 판단하지 않는다.

| 실패 | 기대 동작 |
|---|---|
| Redis 중단·축출 | 로그인 유지, DB 조회로 cache 우회, 접속 통계 unavailable/warming, 요청 대기열 제한 |
| PostgreSQL 중단 | DB 의존 API는 제한 시간 내 503, 쓰기 성공으로 응답하지 않음, 가능한 정적 공개 화면 유지 |
| admin 중단 | 일반 앱 운영 지속, 호스트·외부 모니터에서 감지 |
| 앱 한 개 OOM | 해당 컨테이너 재시작, OOM 원인 기록, 다른 앱의 자원·지연 관찰 |
| 객체 저장소 중단 | 파일 기능만 오류/재시도, DB에 완료 파일로 잘못 확정하지 않음 |
| AI 제공자 중단 | 생성 기능 제한, 중복 과금 방지, 기본 소개·이력서 조회 지속 |
| 호스트·디스크 장애 | 전체 서비스 중단 가능, 외부 백업에서 새 호스트 복구 |

## 12. 구현 순서와 출시 판정

1. 앱 경계·실제 도메인·공통 로그인 필요 여부를 확정하고 Node/Next/Prisma 버전을 고정한다.
2. tech-blog 하나로 standalone 이미지·앱별 DB 역할·migration·로그·health·TLS·backup/restore 경로를 완성한다.
3. cv-builder를 추가해 PostgreSQL 세션·개인 파일 접근·업로드 완료 검증을 구현한다.
4. intro-page에 AI quota·동시성·멱등성을 적용한다. 단순 소개 영역은 정적화 가능성을 확인한다.
5. admin은 읽기 전용 운영 API·접속 통계·오류 상태부터 제공한다.
6. service-d/e는 요구사항과 측정 결과에 따라 추가한다. 동시에 6개를 띄우는 것이 출시의 선행조건일 필요는 없다.

출시 전에는 아래 경로를 실제 환경에서 확인한다. 이는 향후 구현의 인수 조건이며 이번 문서 작성으로 통과한 검사가 아니다.

- **격리:** blog runtime으로 resume 테이블 접근·CREATE/DROP이 실패하고 자기 앱 DML만 성공한다. Redis에서도 다른 앱 키·관리 명령이 거절된다.
- **연결:** 앱당 장시간 연결 수가 설정 한도를 넘지 않고 배포·migration이 겹쳐도 운영용 연결이 남는다.
- **부하:** 예상 피크를 먼저 정의하고 그 2배로 30분 측정한다. 초기 목표는 비-AI API p95 500ms 이하, 예상치 못한 5xx 1% 미만, OOM 0회다. SSR·AI·파일 경로는 별도 지표로 측정한다. 모두 제안값이며 제품 요구에 맞춰 확정한다.
- **장애:** Redis 강제 중단 중 세션 유지·캐시 우회·통계 오류 표시를 확인하고 DB 중단은 제한 시간 내 실패한다. 큐·메모리가 지속 증가하지 않는다.
- **정합성·권한:** 게시 취소 즉시 비공개, 이력서 소유권, 세션 폐기, 관리자 권한, Origin/CSRF, 만료 다운로드 URL을 검증한다.
- **배포·복구:** 이전 이미지로 되돌아갈 수 있고 스키마가 호환된다. 새 환경에서 백업 복원·파일 참조·핵심 기능까지 확인한다.

6개 앱이 이 자원 예산과 부하 목표를 통과하면 현재 VPS 운영을 유지한다. 통과하지 못하면 정적화·불필요 프로세스 제거 → 무거운 작업 분리 → 메모리/CPU 증설 또는 호스트 분산 순서로 대응한다. 독립 확장은 앱 배포만의 문제가 아니며 공유 DB·Redis·디스크 병목도 함께 다시 측정해야 한다.
