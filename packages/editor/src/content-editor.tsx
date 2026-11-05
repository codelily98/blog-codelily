'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { ContentFormat } from '@codelily/content';
import 'suneditor/css/editor';
import 'suneditor/css/contents';

export function ContentEditor({
  value,
  onChange,
  format,
  label = '본문 편집',
  markdownOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  format: ContentFormat;
  label?: string;
  markdownOnly?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const editor = useRef<SunEditor.Instance | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const current = useRef(value);
  const id = useId();
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    let teardown: (() => void) | undefined;
    setReady(false);
    setError('');
    async function mount() {
      try {
        const [module, plugins, language] = await Promise.all([
          import('suneditor'),
          import('suneditor/plugins'),
          import('suneditor/langs/ko'),
        ]);
        if (disposed || !target.current) return;
        const read = () => {
          const instance = editor.current;
          if (!instance) return;
          const frame = instance.$.frameContext;
          let next: string;
          if (markdownOnly) {
            next = frame.get('markdown').value;
          } else if (frame.get('isCodeView')) {
            const html = frame.get('code').value;
            next =
              format === 'HTML'
                ? html
                : module.helper.markdown.jsonToMarkdown(module.helper.converter.htmlToJson(html));
          } else if (frame.get('isMarkdownView')) {
            const markdown = frame.get('markdown').value;
            next =
              format === 'MARKDOWN' ? markdown : module.helper.markdown.markdownToHtml(markdown);
          } else if (format === 'MARKDOWN')
            next = module.helper.markdown.jsonToMarkdown(instance.$.html.getJson());
          else next = String(instance.$.html.get());
          current.current = next;
          change.current(next);
        };
        const initial = markdownOnly
          ? ''
          : format === 'MARKDOWN'
            ? module.helper.markdown.markdownToHtml(current.current)
            : current.current;
        const instance = module.default.create(target.current, {
          value: initial,
          iframe: false,
          height: 400,
          lang: language.default as never,
          plugins: [
            plugins.fontColor,
            plugins.backgroundColor,
            plugins.fontSize,
            plugins.align,
            plugins.list,
            plugins.table,
            plugins.link,
            plugins.blockquote,
            plugins.codeBlock,
          ],
          buttonList: [
            ['undo', 'redo'],
            ['bold', 'italic', 'underline', 'strike'],
            ['fontSize', 'fontColor', 'backgroundColor'],
            ['align', 'list', 'blockquote', 'codeBlock', 'table', 'link'],
            ['codeView', 'markdownView'],
          ],
          events: {
            onload: ({ $ }) => {
              if (disposed) return;
              $.frameContext.get('wysiwyg').setAttribute('aria-label', label);
              $.frameContext.get('wysiwyg').setAttribute('role', 'textbox');
              $.frameContext.get('wysiwyg').setAttribute('aria-multiline', 'true');
              if (format === 'MARKDOWN') {
                $.viewer.markdownView(true);
                $.frameContext.get('markdown').value = current.current;
              }
              if (markdownOnly) {
                // Keep the vendor source surface while preventing HTML round trips.
                host.current
                  ?.querySelector<HTMLElement>('.se-toolbar')
                  ?.style.setProperty('display', 'none', 'important');
              }
              const areas = host.current?.querySelectorAll('textarea') || [];
              areas.forEach((area) => {
                area.setAttribute('aria-label', `${label} 원본`);
                area.addEventListener('input', read);
              });
              // Split dropdown arrows in the vendor UI may have no accessible name.
              const nameTools = () => {
                const labels: Record<string, string> = {
                  fontSize: '글자 크기 선택',
                  codeBlock: '코드 언어 선택',
                  fontColor: '글자 색상',
                  backgroundColor: '배경 색상',
                  bold: '굵게',
                  italic: '기울임',
                  underline: '밑줄',
                  strike: '취소선',
                  align: '문단 정렬',
                  list: '목록',
                  link: '링크',
                  table: '표',
                  undo: '실행 취소',
                  redo: '다시 실행',
                  codeView: 'HTML 원본 보기',
                  markdownView: 'Markdown 보기',
                  blockquote: '인용문',
                };
                host.current
                  ?.querySelectorAll<HTMLButtonElement>('button[data-command]')
                  .forEach((button) => {
                    if (!button.getAttribute('aria-label') && !button.getAttribute('title')) {
                      const command = button.dataset.command || '';
                      button.setAttribute('aria-label', labels[command] || `${command} 편집 도구`);
                    }
                  });
              };
              nameTools();
              const observer = new MutationObserver(nameTools);
              if (host.current) observer.observe(host.current, { childList: true, subtree: true });
              teardown = () => {
                observer.disconnect();
                areas.forEach((area) => area.removeEventListener('input', read));
              };
              setReady(true);
            },
            onChange: () => read(),
          },
        });
        editor.current = instance;
      } catch {
        if (!disposed) setError('편집기를 불러오지 못했습니다. 페이지를 새로고침해주세요.');
      }
    }
    void mount();
    return () => {
      disposed = true;
      teardown?.();
      editor.current?.destroy();
      editor.current = null;
      if (target.current) target.current.innerHTML = '';
    };
  }, [format, label, markdownOnly]);
  useEffect(() => {
    if (value === current.current) return;
    current.current = value;
    if (!editor.current) return;
    if (format === 'MARKDOWN' && editor.current.$.frameContext.get('isMarkdownView'))
      editor.current.$.frameContext.get('markdown').value = value;
    else if (format === 'HTML') editor.current.$.html.set(value);
  }, [value, format]);
  return (
    <div className="editor-shell" ref={host} aria-describedby={`${id}-help`}>
      <p id={`${id}-help`} className="mb-3 text-xs leading-5 text-muted">
        {markdownOnly
          ? 'Markdown 원문을 편집합니다. 표·코드 블록·체크 목록을 지원합니다. Ctrl+S로 즉시 저장할 수 있습니다.'
          : 'HTML 서식·소스와 Markdown 보기를 지원합니다. 표와 코드 블록을 사용할 수 있습니다. 이미지는 아래 R2 업로드를 이용해주세요.'}
      </p>
      {!ready && !error ? (
        <p role="status" className="py-3 text-sm text-muted">
          편집기 불러오는 중…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div ref={target} />
    </div>
  );
}
