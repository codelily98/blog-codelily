import render from 'dom-serializer';
import { DomUtils, parseDocument } from 'htmlparser2';
import { sanitizeContent } from './index';

export function prepareArticleContent(html: string) {
  const sanitized = sanitizeContent(html);
  const document = parseDocument(sanitized);
  const headings = DomUtils.findAll(({ name }) => /^h[1-3]$/.test(name), document);
  const outline: { id: string; title: string; level: 2 | 3 }[] = [];
  for (const heading of headings) {
    const title = DomUtils.textContent(heading).replace(/\s+/g, ' ').trim();
    if (!title) continue;
    const level = heading.name === 'h3' && outline.length > 0 ? 3 : 2;
    const id = `article-section-${outline.length + 1}`;
    heading.name = level === 2 ? 'h2' : 'h3';
    heading.attribs.id = id;
    heading.attribs.tabindex = '-1';
    outline.push({ id, title, level });
  }

  return {
    html: outline.length > 0 ? render(document, { encodeEntities: 'utf8' }) : sanitized,
    outline,
  };
}
