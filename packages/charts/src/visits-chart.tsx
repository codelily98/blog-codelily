'use client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);
export function VisitsChart({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <figure className="rounded-xl border border-line bg-surface p-5">
      <figcaption className="mb-5 font-semibold">{title}</figcaption>
      <div className="h-60">
        <Line
          role="img"
          aria-label={`${title}. 아래 표에서 날짜별 수치를 확인할 수 있습니다.`}
          data={{
            labels: rows.map((row) => row.label),
            datasets: [
              {
                label: '페이지 조회',
                data: rows.map((row) => row.value),
                borderColor: '#a89a79',
                backgroundColor: 'rgba(168,154,121,.12)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
          }}
        />
      </div>
      <details className="mt-4 text-sm">
        <summary className="min-h-11 cursor-pointer py-3 text-muted">차트 데이터 표로 보기</summary>
        <table className="w-full text-left">
          <caption className="sr-only">{title} 수치</caption>
          <thead>
            <tr>
              <th scope="col" className="py-2">
                날짜
              </th>
              <th scope="col">페이지 조회</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-line">
                <th scope="row" className="py-2 font-normal">
                  {row.label}
                </th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="py-4 text-muted">수집된 데이터가 없습니다.</p> : null}
      </details>
    </figure>
  );
}
