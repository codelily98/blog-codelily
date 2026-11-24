import Link from 'next/link';
import type { PostReaderDetails } from '../domain/models';
import { PostBody, type ArticleContent } from './post-body';
import { PostDate } from './post-date';
import { archiveHref } from './archive-query';

export function PostArticle({
  details,
  content,
  preview = false,
}: {
  details: PostReaderDetails;
  content: ArticleContent | null;
  preview?: boolean;
}) {
  const { title, excerpt, tags, date, categoryName, authorName, readMinutes, bodyRemoved } =
    details;
  return (
    <article>
      <header className="mb-9 border-b border-line pb-8">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-accent">
          <span className="font-mono">
            <PostDate value={date} />
          </span>
          {categoryName ? <span>{categoryName}</span> : null}
          {bodyRemoved ? null : <span>{readMinutes}분 읽기</span>}
        </div>
        <h1 className="publication-post-title mt-4 break-words">{title}</h1>
        {excerpt ? (
          <p className="mt-5 break-words text-[1rem] leading-8 text-muted sm:text-lg">{excerpt}</p>
        ) : null}
        <p className="mt-5 text-sm text-muted">{authorName}</p>
      </header>
      {content ? (
        <PostBody {...content} preview={preview} />
      ) : (
        <p className="rounded-lg border border-line p-5 text-sm leading-7 text-muted">
          회원 탈퇴 요청에 따라 글 본문이 삭제되었습니다. 다른 회원이 작성한 댓글은 아래에서 볼 수
          있습니다.
        </p>
      )}
      {tags.length > 0 ? (
        <ul
          className="mt-8 flex flex-wrap gap-x-5 border-t border-line pt-3 text-sm"
          aria-label="글 태그"
        >
          {[...new Set(tags)].map((tag) => (
            <li key={tag}>
              {preview ? (
                <span className="flex min-h-11 items-center text-accent">#{tag}</span>
              ) : (
                <Link href={archiveHref({ tag })} className="publication-link">
                  #{tag}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
