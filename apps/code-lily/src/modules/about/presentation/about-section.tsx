import type { AboutSection as Section } from '../domain/models';
import { ArrowUpRight } from 'lucide-react';
export function AboutSection({ section }: { section: Section }) {
  if (section.kind === 'INTRO')
    return (
      <section className="mb-12">
        <p className="mb-4 text-[11px] font-bold tracking-[.12em] text-muted">ABOUT</p>
        <h1 className="max-w-lg text-[38px] leading-[1.25] font-bold tracking-[-.055em] whitespace-pre-line">
          {section.title}
        </h1>
        {section.subtitle ? <p className="mt-5 text-sm text-muted">{section.subtitle}</p> : null}
        <div
          className="content-body mt-10"
          dangerouslySetInnerHTML={{ __html: section.renderedHtml }}
        />
      </section>
    );
  return (
    <section className="mt-12" aria-labelledby={`about-${section.id}`}>
      <h2 id={`about-${section.id}`} className="mb-5 text-[22px] font-bold tracking-tight">
        {section.title}
      </h2>
      {section.source ? (
        <div
          className="content-body mb-5"
          dangerouslySetInnerHTML={{ __html: section.renderedHtml }}
        />
      ) : null}
      {section.kind === 'EXPERIENCE' ? (
        <ol className="divide-y divide-line border-t border-line">
          {section.items.map((item, index) => (
            <li key={index} className="grid gap-3 py-5 sm:grid-cols-[140px_1fr]">
              <span className="font-mono text-xs leading-6 text-muted">{item.period}</span>
              <div>
                <h3 className="text-sm font-bold">{item.label}</h3>
                <p className="mt-1 text-sm leading-7 text-muted">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {section.kind === 'INTERESTS' ? (
        <ul className="flex flex-wrap gap-2">
          {section.items.map((item, index) => (
            <li
              key={index}
              className="rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-semibold"
            >
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      {section.kind === 'CONTACT' ? (
        <ul className="flex flex-wrap gap-3">
          {section.items
            .filter((item) => /^(https?:\/\/|mailto:)/i.test(item.url))
            .map((item, index) => (
              <li key={index}>
                <a
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold hover:bg-raised"
                  href={item.url}
                  rel="noopener noreferrer"
                >
                  {item.label}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </li>
            ))}
        </ul>
      ) : null}
      {section.kind === 'CUSTOM' && section.items.length ? (
        <dl className="space-y-3">
          {section.items.map((item, index) => (
            <div key={index} className="border-l-2 border-line pl-4">
              <dt className="font-semibold">{item.label}</dt>
              <dd className="mt-1 text-sm text-muted">{item.detail}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
