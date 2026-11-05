import sanitizeHtml from 'sanitize-html';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

export type ContentFormat = 'HTML' | 'MARKDOWN';
export function sanitizeContent(html: string, options: { allowImages?: boolean } = {}): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      ...(options.allowImages === false ? [] : ['img']),
      'figure',
      'figcaption',
      's',
      'del',
      'details',
      'summary',
      'input',
    ],
    allowedAttributes: {
      '*': ['class', 'style'],
      a: ['href', 'title'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan', 'scope'],
      code: ['class'],
      ol: ['start'],
      input: ['type', 'checked', 'disabled', 'aria-label'],
    },
    allowedClasses: {
      '*': [/^se-[\w-]+$/, /^language-[\w-]+$/, 'task-list-item', 'contains-task-list'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,%]+\)$/i],
        'background-color': [/^#[0-9a-f]{3,8}$/i],
        'text-align': [/^(left|right|center|justify)$/],
        'font-size': [/^(?:[1-4]?\d|50)(?:px|pt)$/, /^[0-3](?:\.\d+)?(?:rem|em)$/],
        'font-weight': [/^(normal|bold|[1-9]00)$/],
        'font-style': [/^(normal|italic)$/],
        'text-decoration': [/^(underline|line-through|none)$/],
      },
    },
    transformTags: {
      a: (tagName, attrs) => ({
        tagName,
        attribs: { ...attrs, rel: 'noopener noreferrer nofollow' },
      }),
      img: (tagName, attrs) => ({
        tagName,
        attribs: { ...attrs, alt: attrs.alt || '', loading: 'lazy' },
      }),
      input: (_tagName, attrs) => ({
        tagName: 'input',
        attribs: {
          type: 'checkbox',
          disabled: 'disabled',
          'aria-label': Object.hasOwn(attrs, 'checked') ? '완료된 할 일' : '미완료 할 일',
          ...(Object.hasOwn(attrs, 'checked') ? { checked: 'checked' } : {}),
        },
      }),
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  });
}

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify);
export async function renderContent(
  source: string,
  format: ContentFormat,
  options: { allowImages?: boolean } = {},
): Promise<string> {
  if (source.length > 500_000) throw new Error('콘텐츠는 500KB 이하여야 합니다.');
  const html = format === 'MARKDOWN' ? String(await markdown.process(source)) : source;
  return sanitizeContent(html, options);
}
export function plainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
}
