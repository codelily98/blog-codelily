import render from 'dom-serializer';
import { DomUtils, parseDocument } from 'htmlparser2';
import { sanitizeContent } from './index';

export function prepareArticleContent(html: string) {
  const sanitized = sanitizeContent(html);
  const document = parseDocument(sanitized);
  const blocks = DomUtils.findAll(({ name }) => name === 'pre' || /^h[1-3]$/.test(name), document);
  const outline: { id: string; title: string; level: 2 | 3 }[] = [];
  for (const block of blocks) {
    if (block.name === 'pre') {
      block.attribs.tabindex = '0';
      continue;
    }
    const title = DomUtils.textContent(block).replace(/\s+/g, ' ').trim();
    if (!title) continue;
    const level = block.name === 'h3' && outline.length > 0 ? 3 : 2;
    const id = `article-section-${outline.length + 1}`;
    block.name = level === 2 ? 'h2' : 'h3';
    block.attribs.id = id;
    block.attribs.tabindex = '-1';
    outline.push({ id, title, level });
  }

  return {
    html: blocks.length > 0 ? render(document, { encodeEntities: 'utf8' }) : sanitized,
    outline,
  };
}
