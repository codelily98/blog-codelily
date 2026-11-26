'use client';

import {
  Bold,
  Braces,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  Quote,
  SquareCheck,
} from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@codelily/ui';

const tools = [
  { id: 'heading', label: '제목 줄', icon: Heading2 },
  { id: 'bold', label: '굵게', icon: Bold },
  { id: 'italic', label: '기울임', icon: Italic },
  { id: 'quote', label: '인용', icon: Quote },
  { id: 'list', label: '글머리 목록', icon: List },
  { id: 'task', label: '체크 목록', icon: SquareCheck },
  { id: 'code', label: '인라인 코드', icon: Code },
  { id: 'fence', label: '코드 블록', icon: Braces },
  { id: 'link', label: '링크 삽입', icon: Link2 },
] as const;

type Tool = (typeof tools)[number]['id'];

const lineStyles = {
  heading: { prefix: '## ', placeholder: '제목' },
  quote: { prefix: '> ', placeholder: '인용문' },
  list: { prefix: '- ', placeholder: '목록 항목' },
  task: { prefix: '- [ ] ', placeholder: '할 일' },
};

function replacement(input: HTMLTextAreaElement, tool: Tool) {
  const { value, selectionStart: start, selectionEnd: end } = input;
  const selected = value.slice(start, end);

  if (tool === 'heading' || tool === 'quote' || tool === 'list' || tool === 'task') {
    const { prefix, placeholder } = lineStyles[tool];
    const first = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
    const lastSelected = selected.endsWith('\n') ? end - 1 : end;
    const newline = value.indexOf('\n', lastSelected);
    const last = newline === -1 ? value.length : newline;
    const lines = value.slice(first, last);
    const text = lines ? lines.replace(/^(?=.)/gm, prefix) : prefix + placeholder;
    return {
      start: first,
      end: last,
      text,
      anchor: lines ? 0 : prefix.length,
      length: lines ? text.length : placeholder.length,
    };
  }

  if (tool === 'link') {
    const label = (selected || '링크 텍스트').replace(/[\\[\]]/g, '\\$&');
    return { start, end, text: `[${label}](https://)`, anchor: label.length + 3, length: 8 };
  }

  if (tool === 'fence' || tool === 'code') {
    const content = selected || '코드';
    let ticks = 0;
    for (const match of content.matchAll(/`+/g)) ticks = Math.max(ticks, match[0].length);
    if (tool === 'fence') {
      const fence = '`'.repeat(Math.max(3, ticks + 1));
      const before = (start > 0 && value[start - 1] !== '\n' ? '\n' : '') + fence + '\n';
      const after = '\n' + fence + (end < value.length && value[end] !== '\n' ? '\n' : '');
      return {
        start,
        end,
        text: before + content + after,
        anchor: before.length,
        length: content.length,
      };
    }
    const marker = '`'.repeat(ticks + 1);
    const space = content.startsWith('`') || content.endsWith('`') ? ' ' : '';
    return {
      start,
      end,
      text: marker + space + content + space + marker,
      anchor: marker.length + space.length,
      length: content.length,
    };
  }

  const content = selected || '텍스트';
  const marker = tool === 'bold' ? '**' : '_';
  if (
    selected &&
    value.slice(start - marker.length, start) === marker &&
    value.slice(end, end + marker.length) === marker
  ) {
    return {
      start: start - marker.length,
      end: end + marker.length,
      text: selected,
      anchor: 0,
      length: selected.length,
    };
  }
  return {
    start,
    end,
    text: marker + content + marker,
    anchor: marker.length,
    length: content.length,
  };
}

export function MarkdownEditor({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const source = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);

  function format(tool: Tool) {
    const input = source.current;
    if (!input || composing.current) return;
    const { start, end, text, anchor, length } = replacement(input, tool);
    input.focus();
    input.setSelectionRange(start, end);
    // Native insertion keeps the browser's undo history for formatting edits.
    if (!document.execCommand?.('insertText', false, text)) {
      input.setRangeText(text, start, end);
      onChange(input.value);
    }
    input.setSelectionRange(start + anchor, start + anchor + length);
  }

  return (
    <div
      className="editor-shell min-w-0 rounded-lg border border-line bg-raised"
      data-editor-format="markdown"
    >
      <div
        role="group"
        aria-label="Markdown 서식"
        className="flex flex-wrap gap-x-1 rounded-t-lg border-b border-line bg-surface px-2 py-1"
      >
        {tools.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            className="w-11 px-0 text-ink transition-none"
            aria-label={label}
            title={label}
            onClick={() => format(id)}
          >
            <Icon size={17} aria-hidden="true" />
          </Button>
        ))}
      </div>
      <textarea
        ref={source}
        className="markdown-source block min-h-96 w-full resize-y rounded-b-lg bg-raised px-4 py-4 font-mono text-base leading-7 text-ink outline-offset-[-2px] placeholder:text-muted sm:min-h-[27rem] sm:px-5"
        aria-label={`${label} 원본`}
        placeholder="Markdown으로 본문을 작성하세요."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        wrap="soft"
        spellCheck={false}
      />
    </div>
  );
}
