import { prepareArticleContent } from '@codelily/content/article';

export function PostBody({ renderedHtml }: { renderedHtml: string }) {
  const { html, outline } = prepareArticleContent(renderedHtml);
  return (
    <>
      {outline.length > 1 ? (
        <nav
          aria-label="본문 목차"
          className="mb-8 rounded-lg border border-line bg-surface px-4 sm:px-5"
        >
          <details open>
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">목차</summary>
            <ol className="mb-3 border-t border-line pt-2 text-sm">
              {outline.map(({ id, title, level }) => (
                <li key={id} className={level === 3 ? 'ml-5' : undefined}>
                  <a href={`#${id}`} className="publication-link">
                    {title}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        </nav>
      ) : null}
      <div
        className="content-body sun-editor-editable"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
