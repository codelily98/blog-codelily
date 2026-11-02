import { getDatabase, transaction } from '../apps/code-lily/src/infrastructure/database';
import { renderContent } from '../packages/content/src/index';
if (process.env.NODE_ENV === 'production')
  throw new Error('Example seed is disabled in production.');
const db = await getDatabase();
try {
  await db.query(
    `INSERT INTO "user"(id,name,email,"emailVerified",role) VALUES('sample-author','code-lily','sample@local.invalid',false,'EDITOR') ON CONFLICT(id) DO NOTHING`,
  );
  const entries = [
    {
      category: '시스템',
      categorySlug: 'system',
      slug: 'small-server-architecture',
      title: '작은 서버에서 시작하는 단단한 아키텍처',
      tags: ['architecture', 'backend', 'infrastructure'],
      excerpt:
        '작은 규모의 서비스에서도 오래 버틸 수 있는 아키텍처를 설계하기 위해 고려해야 할 원칙과 운영의 기준을 정리합니다.',
      source:
        '# 자원을 이해하는 것부터\n\n작은 서버에서는 프로세스 수보다 **책임의 경계**와 제한을 먼저 정합니다. 앱마다 독립적으로 배포하되 데이터 소유권은 명확히 유지합니다.\n\n## 기본 원칙\n\n- 빌드는 CI에서 수행합니다.\n- DB 연결 수와 요청 동시성을 제한합니다.\n- 이미지와 정적 파일은 CDN에서 전달합니다.\n\n> 서비스가 작을 때 만든 운영 습관이 서비스가 커졌을 때의 안정성을 결정합니다.\n\n| 자원 | 운영 기준 |\n| --- | --- |\n| CPU | 무거운 작업의 동시 실행 제한 |\n| 메모리 | 프로세스 RSS와 OOM 관찰 |\n| DB | 앱별 제한된 연결 풀 |\n\n```typescript\nconst boundaries = ["domain", "application", "infrastructure"];\nconsole.log(boundaries);\n```',
    },
    {
      category: 'Spring',
      categorySlug: 'spring',
      slug: 'shared-component-boundaries',
      title: '공통 컴포넌트는 어디까지 나눠야 할까',
      tags: ['component', 'frontend', 'design-system'],
      excerpt:
        '재사용 가능한 컴포넌트를 만들 때의 기준과 책임 분리, 그리고 실제 프로젝트에서 마주치는 경계를 살펴봅니다.',
      source:
        '<h2>같은 모양보다 같은 책임</h2><p>공통화는 중복된 코드를 줄이는 수단입니다. 서로 다른 요구를 하나의 거대한 컴포넌트에 넣으면 변경 비용이 더 커질 수 있습니다.</p><blockquote>외부 라이브러리는 공통 경계 안에서 관리하고, 서비스의 정책은 서비스에 둡니다.</blockquote><h3>작은 단위에서 시작하기</h3><ul><li>버튼과 입력 필드</li><li>모달과 알림</li><li>콘텐츠 편집과 안전한 읽기</li></ul><p style="text-align:center;font-weight:bold">변경 이유가 같을 때 함께 묶습니다.</p>',
    },
    {
      category: 'React',
      categorySlug: 'react',
      slug: 'react-server-component-boundary',
      title: 'React 서버 컴포넌트의 경계 이해하기',
      tags: ['react', 'nextjs', 'rendering'],
      excerpt:
        '서버 컴포넌트와 클라이언트 컴포넌트를 나누는 기준, 그리고 자바스크립트 전송량을 줄이는 방법을 기록합니다.',
      source:
        '## 화면을 어디에서 그릴까\n\n데이터 조회는 서버에서, 상호작용은 필요한 작은 클라이언트 경계에서 처리합니다.\n\n```tsx\n// 읽기 전용 데이터는 서버에서 전달합니다.\nreturn <Article title={post.title} />;\n```\n\n차트와 에디터처럼 무거운 모듈은 사용되는 화면에서만 불러옵니다. 이것은 작은 서버의 메모리뿐 아니라 방문자의 네트워크와 기기 자원도 아끼는 방법입니다.',
    },
    {
      category: '데이터베이스',
      categorySlug: 'database',
      slug: 'postgresql-small-pool',
      title: 'PostgreSQL 연결 풀을 작게 유지하는 이유',
      tags: ['postgresql', 'performance', 'database'],
      excerpt:
        '연결 수를 늘리는 것만으로 처리량이 늘어나지는 않습니다. 풀 대기 시간과 쿼리 실행 시간을 함께 살펴봅니다.',
      source:
        '## 연결 수는 용량 계획의 일부\n\n각 인스턴스의 최대 연결 수를 합산하고 배포 중 중첩과 운영 연결을 위한 여유를 남깁니다.\n\n| 항목 | 초기 기준 |\n| --- | --- |\n| 앱 연결 풀 | 작은 값에서 측정 시작 |\n| 쿼리 | 실행·대기 시간 제한 |\n| 배포 | 이전·신규 인스턴스 중첩 고려 |\n\n느린 쿼리를 그대로 두고 연결만 늘리면 자원 경쟁이 심해질 수 있습니다.',
    },
    {
      category: 'Java',
      categorySlug: 'java',
      slug: 'a-blog-that-keeps-records',
      title: '기록이 쌓이는 개발 블로그 만들기',
      tags: ['devlog', 'writing', 'productivity'],
      excerpt:
        '배운 것을 글로 남기는 습관과 블로그를 지속 가능하게 운영하는 방법, 작게 시작해서 개선하는 과정을 이야기합니다.',
      source:
        '## 완벽한 글보다 꾸준한 기록\n\n문제를 만난 상황, 시도한 방법, 선택한 이유를 남기면 다음의 나에게 도움이 됩니다.\n\n- [x] 문제를 구체적으로 적기\n- [x] 결과와 근거를 함께 적기\n- [ ] 시간이 지나 바뀐 내용 갱신하기\n\n기록은 정답의 목록이 아니라 생각의 변화가 남는 공간입니다.',
    },
    {
      category: 'AI',
      categorySlug: 'ai',
      slug: 'working-with-ai-principles',
      title: 'AI와 함께 일할 때 지키는 원칙',
      tags: ['ai', 'workflow', 'productivity'],
      excerpt:
        '도구가 만든 결과를 검토하고, 변경 이유를 기록하며, 실제 동작으로 확인하는 개발 습관을 정리합니다.',
      source:
        '## 결과보다 검증 가능한 과정\n\n도구를 사용할 때도 변경의 책임과 판단 근거는 남겨야 합니다.\n\n1. 요구사항과 완료 기준을 먼저 적습니다.\n2. 작은 단위로 구현하고 실제 경로를 확인합니다.\n3. 검증한 것과 아직 검증하지 않은 것을 구분합니다.\n\n> 문서와 코드는 함께 업데이트되어야 다음 세션에서도 안전하게 이어갈 수 있습니다.',
    },
  ];
  for (const [index, entry] of entries.entries()) {
    await db.query(
      'INSERT INTO categories(name,slug,owner_id) VALUES($1,$2,$3) ON CONFLICT(slug) DO NOTHING',
      [entry.category, entry.categorySlug, 'sample-author'],
    );
    const category = (
      await db.query<{ id: string }>('SELECT id FROM categories WHERE slug=$1', [
        entry.categorySlug,
      ])
    ).rows[0];
    const format = entry.source.startsWith('<') ? 'HTML' : 'MARKDOWN';
    await db.query(
      `INSERT INTO posts(slug,title,excerpt,source,format,rendered_html,tags,status,category_id,author_id,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,'PUBLISHED',$8,'sample-author',$9) ON CONFLICT(slug) DO NOTHING`,
      [
        entry.slug,
        entry.title,
        entry.excerpt,
        entry.source,
        format,
        await renderContent(entry.source, format),
        entry.tags,
        category.id,
        new Date(Date.UTC(2026, 10, 2, 5) - index * 3600000).toISOString(),
      ],
    );
  }
  const existing = await db.query('SELECT id FROM about_sections LIMIT 1');
  if (!existing.rows.length) {
    const sections = [
      {
        kind: 'INTRO',
        title: '안녕하세요,\ncode-lily입니다.',
        source:
          '기술을 배우고 만드는 과정에서 발견한 생각을 기록합니다. 작은 문제를 끝까지 이해하고, 다음에 같은 문제를 만났을 때 도움이 될 수 있는 기록을 남기고 싶습니다.\n\n이 공간에서는 아키텍처와 공통 모듈 설계, 웹 개발에서 배운 것들을 나눕니다. 답이 있는 글보다, 함께 고민하고 조금씩 더 나아갈 수 있는 글을 쓰고 싶습니다.',
        items: [],
      },
      {
        kind: 'EXPERIENCE',
        title: '경력',
        source: '',
        items: [
          {
            label: '배우고 만드는 과정',
            detail: '프로젝트에서 만난 문제와 해결 과정을 기록합니다.',
            period: '지금',
            url: '',
          },
        ],
      },
      {
        kind: 'INTERESTS',
        title: '관심사',
        source: '',
        items: [
          'Java',
          'Spring',
          'PostgreSQL',
          '분산 서비스',
          '공통 모듈 설계',
          'React',
          'AI 활용 개발',
        ].map((label) => ({ label, detail: '', period: '', url: '' })),
      },
      {
        kind: 'CONTACT',
        title: '연락',
        source: '',
        items: [{ label: 'Email', detail: '', period: '', url: 'mailto:codelily98@gmail.com' }],
      },
    ];
    for (const [index, section] of sections.entries())
      await db.query(
        'INSERT INTO about_sections(kind,title,source,format,rendered_html,items,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          section.kind,
          section.title,
          section.source,
          'MARKDOWN',
          await renderContent(section.source, 'MARKDOWN'),
          JSON.stringify(section.items),
          index * 10,
        ],
      );
  }
  console.log('Example posts and About seeded. No Google account or login bypass was created.');
} finally {
  await db.end();
}
