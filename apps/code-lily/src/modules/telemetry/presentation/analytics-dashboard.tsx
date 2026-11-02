'use client';
import dynamic from 'next/dynamic';
import { Spinner } from '@codelily/ui';
import type { Analytics, EventRow, AuditRow } from '../domain/models';
import type { GridColumn } from '@codelily/grid';
const VisitsChart = dynamic(() => import('@codelily/charts').then((module) => module.VisitsChart), {
  ssr: false,
  loading: () => <Spinner label="차트 불러오는 중" />,
});
const DataGrid = dynamic(() => import('@codelily/grid').then((module) => module.DataGrid), {
  ssr: false,
  loading: () => <Spinner label="표 불러오는 중" />,
});
const eventColumns: GridColumn<EventRow>[] = [
  { key: 'createdAt', label: '시각 (UTC)' },
  { key: 'browserId', label: '브라우저 식별자' },
  { key: 'path', label: '페이지' },
  { key: 'kind', label: '종류' },
];
const logColumns: GridColumn<AuditRow>[] = [
  { key: 'createdAt', label: '시각 (UTC)' },
  { key: 'actorName', label: '수행자' },
  { key: 'action', label: '작업' },
  { key: 'entityId', label: '대상 ID' },
];
export function AnalyticsDashboard({ data, days }: { data: Analytics; days: number }) {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">통계 · 사용자 발자취 · 감사 로그</h2>
        <form className="flex items-center gap-3">
          <label htmlFor="analytics-days" className="text-sm text-muted">
            조회 기간
          </label>
          <select
            id="analytics-days"
            name="days"
            defaultValue={days}
            className="min-h-11 rounded-lg border border-line bg-base px-3 text-sm"
          >
            <option value="7">최근 7일</option>
            <option value="14">최근 14일</option>
            <option value="30">최근 30일</option>
          </select>
          <button className="min-h-11 rounded-lg border border-line px-4 text-sm" type="submit">
            조회
          </button>
        </form>
      </div>
      <p className="text-sm leading-6 text-muted">
        방문 수집에 동의한 브라우저의 기록입니다. 미동의 방문과 CDN 요청은 포함되지 않으며 실제 전체
        방문자 수와 다를 수 있습니다.
      </p>
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ['페이지 조회', data.pageViews],
          ['고유 브라우저', data.uniqueBrowsers],
          ['공개 글', data.publishedPosts],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-3 text-3xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <VisitsChart
        title="일별 페이지 조회 (한국 시간)"
        rows={data.daily.map((row) => ({ label: row.day, value: row.views }))}
      />
      <DataGrid
        title="사용자 발자취"
        rows={data.events}
        columns={eventColumns as GridColumn<{ id: string }>[]}
      />
      <DataGrid
        title="업무 감사 로그"
        rows={data.logs}
        columns={logColumns as GridColumn<{ id: string }>[]}
      />
      <p className="text-xs leading-6 text-muted">
        서버 오류·OOM·인프라 로그는 운영 stdout 수집 경로에서 확인합니다. 이 화면은 콘텐츠 변경 등
        DB에 함께 기록된 업무 감사 로그를 보여줍니다.
      </p>
    </section>
  );
}
