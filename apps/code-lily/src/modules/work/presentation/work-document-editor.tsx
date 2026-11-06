'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Button, Dialog, Spinner, Textarea } from '@codelily/ui';
import { ApiError, requestApi } from '@/presentation/client-api';
import type { WorkDocument } from '../domain/models';

const ContentEditor = dynamic(
  () => import('@codelily/editor').then((module) => module.ContentEditor),
  {
    ssr: false,
    loading: () => <Spinner label="Markdown 편집기 불러오는 중" />,
  },
);
export interface WorkEditorHandle {
  flush(): Promise<boolean>;
}
type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export function WorkDocumentEditor({
  document: initial,
  manage,
  ref,
}: {
  document: WorkDocument;
  manage: boolean;
  ref: Ref<WorkEditorHandle>;
}) {
  const [content, setContent] = useState(initial.content);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [savedAt, setSavedAt] = useState(initial.updatedAt);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'editor' | 'preview'>(manage ? 'editor' : 'preview');
  const [preview, setPreview] = useState(initial.renderedHtml);
  const [previewing, setPreviewing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [remote, setRemote] = useState<WorkDocument | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState('');
  const latest = useRef({
    content: initial.content,
    saved: initial.content,
    version: initial.version,
  });
  const inFlight = useRef<Promise<boolean> | null>(null);
  const failure = useRef<SaveStatus | null>(null);
  const composingRef = useRef(false);
  const editingEntry = useRef<{ url: string; state: unknown } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const save = useCallback(
    (manual = false): Promise<boolean> => {
      if (inFlight.current) return inFlight.current;
      if (!manage || latest.current.content === latest.current.saved) return Promise.resolve(true);
      if (composingRef.current) return Promise.resolve(false);
      if (failure.current === 'conflict' || (!manual && failure.current))
        return Promise.resolve(false);
      const operation = async () => {
        failure.current = null;
        setStatus('saving');
        setMessage('');
        try {
          while (latest.current.content !== latest.current.saved) {
            if (composingRef.current) {
              if (mounted.current) setStatus('dirty');
              return false;
            }
            const sent = latest.current.content;
            const saved = await requestApi<{ version: number; updatedAt: string }>(
              `/api/work/documents/${initial.id}`,
              'PUT',
              {
                content: sent,
                version: latest.current.version,
              },
            );
            latest.current.version = saved.version;
            latest.current.saved = sent;
            if (mounted.current) setSavedAt(saved.updatedAt);
          }
          if (mounted.current) setStatus('saved');
          return true;
        } catch (error) {
          const state = error instanceof ApiError && error.status === 409 ? 'conflict' : 'error';
          failure.current = state;
          if (mounted.current) {
            setStatus(state);
            setMessage((error as Error).message);
          }
          return false;
        } finally {
          inFlight.current = null;
        }
      };
      inFlight.current = operation();
      return inFlight.current;
    },
    [initial.id, manage],
  );

  useImperativeHandle(
    ref,
    () => ({
      flush: () => save(true),
    }),
    [save],
  );
  useEffect(() => {
    if (!manage || composing) return;
    const timer = setTimeout(() => {
      void save();
    }, 1500);
    return () => clearTimeout(timer);
  }, [content, composing, manage, save]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (latest.current.content !== latest.current.saved) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    function hotkey(event: KeyboardEvent) {
      if (manage && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save(true);
      }
    }
    function leaving(event: MouseEvent) {
      const anchor = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (
        !anchor ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      )
        return;
      if (
        !manage ||
        latest.current.content === latest.current.saved ||
        anchor.href === window.location.href ||
        (anchor.hash && anchor.pathname === window.location.pathname)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void save(true).then((saved) => {
        if (saved) window.location.assign(anchor.href);
      });
    }
    function traversing(event: Event) {
      if (!manage || latest.current.content === latest.current.saved) return;
      // Restore the editing entry before Next.js handles a history traversal.
      // Continue to the requested URL only after an acknowledged save.
      event.preventDefault();
      const destination = window.location.href;
      const entry = editingEntry.current;
      window.history.pushState(entry?.state, '', entry?.url ?? `/work/document/${initial.id}`);
      void save(true).then((saved) => {
        if (saved) window.location.assign(destination);
      });
    }
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', hotkey);
    window.document.addEventListener('click', leaving, true);
    window.document.addEventListener('codelily:before-history', traversing);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('keydown', hotkey);
      window.document.removeEventListener('click', leaving, true);
      window.document.removeEventListener('codelily:before-history', traversing);
    };
  }, [initial.id, manage, save]);
  function change(value: string) {
    editingEntry.current = { url: window.location.href, state: window.history.state };
    latest.current.content = value;
    setContent(value);
    if (!failure.current && !inFlight.current)
      setStatus(value === latest.current.saved ? 'saved' : 'dirty');
  }
  async function showPreview() {
    setPreviewing(true);
    setMessage('');
    try {
      const html = await requestApi<string>('/api/work/preview', 'POST', {
        content: latest.current.content,
      });
      setPreview(html);
      setMode('preview');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setPreviewing(false);
    }
  }
  const states: Record<SaveStatus, string> = {
    saved: '저장됨',
    dirty: '미저장 변경 있음',
    saving: '저장 중…',
    error: '저장 실패',
    conflict: '저장 충돌',
  };
  return (
    <section aria-label="Work 문서" className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <h2 className="min-w-0 break-words text-2xl font-bold">{initial.name}</h2>
        {manage ? (
          <div className="flex flex-wrap gap-2" aria-label="편집 모드">
            <Button
              variant="secondary"
              aria-pressed={mode === 'editor'}
              onClick={() => setMode('editor')}
            >
              편집
            </Button>
            <Button
              variant="secondary"
              aria-pressed={mode === 'preview'}
              disabled={previewing}
              onClick={() => {
                void showPreview();
              }}
            >
              {previewing ? '변환 중…' : '미리보기'}
            </Button>
            <Button
              onClick={() => {
                void save(true);
              }}
              disabled={status === 'saving' || status === 'conflict'}
            >
              지금 저장
            </Button>
          </div>
        ) : (
          <span className="text-sm text-muted">회원 열람</span>
        )}
      </div>
      {manage ? (
        <div
          hidden={mode !== 'editor'}
          onCompositionStartCapture={() => {
            composingRef.current = true;
            setComposing(true);
          }}
          onCompositionEndCapture={() => {
            composingRef.current = false;
            setComposing(false);
          }}
        >
          <details className="mb-3 rounded-lg border border-line bg-raised">
            <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">
              편집 안내
            </summary>
            <div className="space-y-1 px-3 pb-3 text-sm leading-6 text-muted">
              <p>입력을 멈춘 뒤 1.5초 후 자동 저장됩니다. 최대 100,000자입니다.</p>
              <p>
                Markdown 원문을 편집합니다. 표·코드 블록·체크 목록을 지원합니다. Ctrl+S로 즉시
                저장할 수 있습니다.
              </p>
            </div>
          </details>
          <ContentEditor
            value={content}
            onChange={change}
            format="MARKDOWN"
            markdownOnly
            label="Work 본문"
          />
        </div>
      ) : null}
      {mode === 'preview' ? (
        <article
          className="content-body min-h-64 break-words"
          aria-label="문서 미리보기"
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      ) : null}
      {manage ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm text-muted">
          <p role="status" aria-live="polite">
            {states[status]} ·{' '}
            {new Date(savedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST
          </p>
          <span>{Array.from(content).length.toLocaleString('ko-KR')}자</span>
        </footer>
      ) : null}
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
      {status === 'error' ? (
        <Button
          variant="secondary"
          onClick={() => {
            void save(true);
          }}
        >
          저장 다시 시도
        </Button>
      ) : null}
      {status === 'conflict' ? (
        <div className="space-y-3 rounded-xl border border-line p-4">
          <p className="text-sm">
            작성 중인 원문을 보존하고 있습니다. 서버 원문과 비교한 후 저장할 내용을 정해 주세요.
          </p>
          <Button
            variant="secondary"
            onClick={async () => {
              setResolving(true);
              try {
                const server = await requestApi<WorkDocument>(`/api/work/documents/${initial.id}`);
                setRemote(server);
                setResolution(latest.current.content);
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setResolving(false);
              }
            }}
            disabled={resolving}
          >
            충돌 내용 비교
          </Button>
        </div>
      ) : null}
      <Dialog
        open={remote !== null}
        title="문서 충돌 해결"
        onClose={() => setRemote(null)}
        initialFocus="#work-resolution"
      >
        <div className="space-y-4">
          <label htmlFor="work-server" className="block text-sm font-semibold">
            서버 원문
          </label>
          <Textarea id="work-server" value={remote?.content ?? ''} readOnly />
          <label htmlFor="work-resolution" className="block text-sm font-semibold">
            저장할 원문
          </label>
          <Textarea
            id="work-resolution"
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            maxLength={100000}
          />
          <Button
            onClick={async () => {
              if (!remote) return;
              latest.current.version = remote.version;
              latest.current.saved = remote.content;
              failure.current = null;
              change(resolution);
              setRemote(null);
              await save(true);
            }}
          >
            병합한 내용 저장
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
