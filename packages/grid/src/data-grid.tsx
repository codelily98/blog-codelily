'use client';
import { useEffect, useRef, useState } from 'react';
import type { TabulatorFull } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator_simple.min.css';
export interface GridColumn<T> {
  key: Extract<keyof T, string>;
  label: string;
}
export function DataGrid<T extends { id: string }>({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: T[];
  columns: GridColumn<T>[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const pager = useRef<HTMLDivElement>(null);
  const grid = useRef<TabulatorFull | null>(null);
  const [accessible, setAccessible] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (accessible) return;
    let disposed = false;
    void import('tabulator-tables')
      .then(({ TabulatorFull }) => {
        if (disposed || !root.current) return;
        grid.current = new TabulatorFull(root.current, {
          data: rows.slice(0, 200),
          layout: 'fitColumns',
          height: 360,
          pagination: true,
          paginationSize: 20,
          paginationElement: pager.current!,
          columns: columns.map((column) => ({
            title: column.label,
            field: column.key,
            formatter: 'plaintext',
            headerSort: true,
            minWidth: 130,
          })),
          placeholder: '수집된 데이터가 없습니다.',
        });
        const fixStructure = () => {
          const element = root.current;
          if (!element) return;
          // The body is already a descendant; redundant aria-owns plus a focusable
          // scroll wrapper/paginator would violate the required grid child roles.
          element.removeAttribute('aria-owns');
          const holder = element.querySelector('.tabulator-tableholder');
          holder?.removeAttribute('tabindex');
          holder?.setAttribute('role', 'presentation');
          element.querySelectorAll<HTMLElement>('.tabulator-col').forEach((header) => {
            header.tabIndex = 0;
            if (!header.dataset.clKeyboard) {
              header.dataset.clKeyboard = 'true';
              header.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  header.click();
                }
              });
            }
          });
        };
        grid.current.on('tableBuilt', fixStructure);
        grid.current.on('renderComplete', fixStructure);
      })
      .catch(() => setError('Grid를 불러오지 못했습니다. 접근 가능한 표를 이용해주세요.'));
    return () => {
      disposed = true;
      grid.current?.destroy();
      grid.current = null;
    };
  }, [accessible, columns, rows]);
  return (
    <section className="min-w-0 rounded-xl border border-line p-5" aria-label={title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <button
          type="button"
          onClick={() => setAccessible((value) => !value)}
          className="min-h-11 rounded-lg border border-line px-3 text-xs"
        >
          {accessible ? 'Tabulator Grid로 보기' : '접근 가능한 표로 보기'}
        </button>
      </div>
      <p className="mb-3 text-xs text-muted">
        최신 {rows.length}건 · 최대 200건. 표 보기에서는 브라우저의 기본 표 탐색 기능을 사용할 수
        있습니다.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {accessible ? (
        <div key="accessible" className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="border-b border-line px-3 py-3 whitespace-nowrap"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => (
                    <td key={column.key} className="border-b border-line px-3 py-3 break-all">
                      {String(row[column.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="py-8 text-center text-sm text-muted">수집된 데이터가 없습니다.</p>
          ) : null}
        </div>
      ) : (
        <div key="interactive">
          <div
            ref={root}
            className="overflow-hidden rounded-lg"
            aria-label={`${title} 대화형 Grid`}
          />
          <div
            ref={pager}
            className="mt-3 flex min-h-11 items-center gap-3 text-sm"
            role="navigation"
            aria-label={`${title} 페이지`}
          />
        </div>
      )}
    </section>
  );
}
