import { cache } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { services } from '@/composition';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

const readSeries = cache(async (value: string) => {
  const id = z.uuid().safeParse(value);
  return id.success ? (await services()).posts.publicSeriesById(id.data) : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const series = await readSeries((await params).id);
  return series
    ? { title: series.name, alternates: { canonical: `/series/${series.id}` } }
    : { robots: { index: false } };
}

export default async function SeriesDetails({ params }: Props) {
  const series = await readSeries((await params).id);
  if (!series) notFound();
  return (
    <main id="main-content" className="post-shell">
      <Link className="publication-link mb-5" href="/series">
        모든 시리즈
      </Link>
      <h1 className="publication-section-title mb-6">{series.name}</h1>
      <ol
        className="divide-y divide-line rounded-lg border border-line"
        aria-label="시리즈 글 목록"
      >
        {series.entries.map((entry) => (
          <li key={entry.slug} className="break-words px-4 py-1">
            <Link className="publication-link" href={`/posts/${encodeURIComponent(entry.slug)}`}>
              {entry.position}편 · {entry.title}
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
