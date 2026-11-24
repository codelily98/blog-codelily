import Link from 'next/link';
import type { SeriesEntry } from '../domain/models';

export function SeriesNavigation({
  name,
  entries,
  index,
}: {
  name: string;
  entries: SeriesEntry[];
  index: number;
}) {
  const previous = entries[index - 1];
  const next = entries[index + 1];
  return (
    <nav
      aria-labelledby="post-series-heading"
      className="mt-10 rounded-lg border border-line bg-surface p-4 sm:p-6"
    >
      <h2 id="post-series-heading" className="break-words text-lg font-bold">
        시리즈 · {name}
      </h2>
      <ol className="mt-3 space-y-1" aria-label="시리즈 글 목록">
        {entries.map((entry, entryIndex) => (
          <li key={entry.slug} className="break-words">
            {entryIndex === index ? (
              <span aria-current="page" className="flex min-h-11 items-center gap-2 font-semibold">
                {entry.position}편 · {entry.title}
              </span>
            ) : (
              <Link className="publication-link" href={postPath(entry)}>
                {entry.position}편 · {entry.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {previous || next ? (
        <div className="mt-4 flex flex-wrap justify-between gap-x-6 border-t border-line pt-3 text-sm">
          {previous ? (
            <Link className="publication-link" href={postPath(previous)}>
              이전 편 · {previous.title}
            </Link>
          ) : null}
          {next ? (
            <Link className="publication-link" href={postPath(next)}>
              다음 편 · {next.title}
            </Link>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

function postPath(entry: SeriesEntry) {
  return `/posts/${encodeURIComponent(entry.slug)}`;
}
