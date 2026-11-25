import type { prepareArticleContent } from '@codelily/content/article';
import { CopyLinkButton } from '@codelily/ui';
import { CodeCopyControls } from './code-copy-controls';

export type ArticleContent = ReturnType<typeof prepareArticleContent>;

export function PostBody({
  html,
  outline,
  preview,
  shareUrl,
}: ArticleContent & { preview: boolean; shareUrl?: string }) {
  const copyEnabled = !preview && /<pre(?:\s|>)/i.test(html);
  return (
    <>
      {outline.length >= (shareUrl ? 1 : 2) ? (
        <nav
          aria-label="본문 목차"
          className="mb-8 rounded-lg border border-line bg-surface px-4 sm:px-5"
        >
          <details open>
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">목차</summary>
            <ol className="mb-3 border-t border-line pt-2 text-sm">
              {outline.map(({ id, title, level }) => (
                <li
                  key={id}
                  className={`${level === 3 ? 'ml-5 ' : ''}flex flex-wrap items-start gap-x-2`}
                >
                  <a
                    href={`#${id}`}
                    className="publication-link min-w-0 grow"
                    onClick={
                      preview
                        ? (event) => {
                            event.preventDefault();
                            const heading = event.currentTarget
                              .closest('article')
                              ?.querySelector<HTMLElement>(`#${id}`);
                            heading?.focus({ preventScroll: true });
                            heading?.scrollIntoView({ block: 'start' });
                          }
                        : undefined
                    }
                  >
                    {title}
                  </a>
                  {shareUrl ? (
                    <CopyLinkButton
                      url={`${shareUrl}#${id}`}
                      label={`${title} 링크 복사`}
                      compact
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
        </nav>
      ) : null}
      <div
        id={copyEnabled ? 'published-post-content' : undefined}
        className="content-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {copyEnabled ? <CodeCopyControls contentId="published-post-content" /> : null}
    </>
  );
}
