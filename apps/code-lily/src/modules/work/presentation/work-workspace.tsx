'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, Field, Input, Spinner } from '@codelily/ui';
import { ApiError, requestApi } from '@/presentation/client-api';
import type { WorkChangeFields, WorkDocument, WorkNode, WorkTree as Tree } from '../domain/models';
import { WorkTree } from './work-tree';
import { WorkNodeDialog, type WorkOperation } from './work-node-dialog';
import { WorkDocumentEditor, type WorkEditorHandle } from './work-document-editor';

export function WorkWorkspace({
  initialTree,
  initialDocumentId,
  manage,
}: {
  initialTree: Tree;
  initialDocumentId: string | null;
  manage: boolean;
}) {
  const router = useRouter();
  const [tree, setTree] = useState(initialTree);
  const [selectedId, setSelectedId] = useState(initialDocumentId);
  const [document, setDocument] = useState<WorkDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<WorkOperation | null>(null);
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [trash, setTrash] = useState<Tree | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkNode[] | null>(null);
  const [notice, setNotice] = useState('');
  const editor = useRef<WorkEditorHandle>(null);
  const selected = tree.nodes.find((node) => node.id === selectedId) ?? null;
  const reload = useCallback(async () => {
    const next = await requestApi<Tree>('/api/work/tree');
    setTree(next);
    return next;
  }, []);
  useEffect(() => {
    setSelectedId(initialDocumentId);
  }, [initialDocumentId]);
  useEffect(() => {
    if (!selectedId || selected?.nodeType === 'FOLDER') {
      setDocument(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    setDocument(null);
    requestApi<WorkDocument>(`/api/work/documents/${selectedId}`)
      .then((value) => {
        if (active) setDocument(value);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, selected?.nodeType]);

  async function flush() {
    return editor.current ? editor.current.flush() : true;
  }
  async function select(node: WorkNode) {
    if (node.id !== selectedId && !(await flush())) return;
    setDrawer(false);
    setError('');
    if (node.id === selectedId) return;
    if (node.nodeType === 'DOCUMENT') {
      setSelectedId(node.id);
      router.push(`/work/document/${node.id}`);
    } else {
      setSelectedId(node.id);
      setDocument(null);
    }
  }
  async function begin(action: WorkOperation) {
    if (!(await flush())) return;
    setError('');
    setOperation(action);
  }
  async function create(name: string, parentId: string | null, type: WorkNode['nodeType']) {
    setBusy(true);
    setError('');
    try {
      const node = await requestApi<WorkNode>('/api/work/nodes', 'POST', {
        name,
        parentId,
        nodeType: type,
        treeVersion: tree.version,
      });
      await reload();
      setResults(null);
      setQuery('');
      setOperation(null);
      setNotice(`${name} 항목을 만들었습니다.`);
      if (type === 'DOCUMENT') {
        setSelectedId(node.id);
        router.push(`/work/document/${node.id}`);
      } else setSelectedId(node.id);
    } catch (reason) {
      setError((reason as Error).message);
      if (reason instanceof ApiError && reason.status === 409) await reload();
    } finally {
      setBusy(false);
    }
  }
  async function change(input: WorkChangeFields, id = selectedId) {
    if (!id || !(await flush())) return;
    setBusy(true);
    setError('');
    try {
      await requestApi(`/api/work/nodes/${id}`, 'PATCH', {
        ...input,
        treeVersion: trash?.version ?? tree.version,
      });
      const next = await reload();
      setResults(null);
      setQuery('');
      setOperation(null);
      setNotice('변경 사항을 반영했습니다.');
      if (trash) setTrash(await requestApi<Tree>('/api/work/trash'));
      if (selectedId && !next.nodes.some((node) => node.id === selectedId)) {
        setSelectedId(null);
        setDocument(null);
        router.push('/work');
      }
      if (input.action === 'rename' && document?.id === id)
        setDocument({ ...document, name: input.name });
    } catch (reason) {
      setError((reason as Error).message);
      if (reason instanceof ApiError && reason.status === 409) {
        await reload();
        if (trash) setTrash(await requestApi<Tree>('/api/work/trash'));
      }
    } finally {
      setBusy(false);
    }
  }
  const sidebar = (
    <div className="space-y-5">
      <form
        className="space-y-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          try {
            setResults(
              await requestApi<WorkNode[]>(`/api/work/search?q=${encodeURIComponent(query)}`),
            );
          } catch (reason) {
            setError((reason as Error).message);
          }
        }}
      >
        <Field label="문서·폴더 이름 검색" id={drawer ? 'work-search-mobile' : 'work-search'}>
          <Input
            id={drawer ? 'work-search-mobile' : 'work-search'}
            value={query}
            maxLength={100}
            required
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            검색
          </Button>
          {results !== null ? (
            <Button
              variant="ghost"
              onClick={() => {
                setResults(null);
                setQuery('');
              }}
            >
              전체 보기
            </Button>
          ) : null}
        </div>
      </form>
      {results !== null ? (
        <div aria-label="Work 검색 결과">
          <p role="status" className="mb-3 text-sm text-muted">
            검색 결과 {results.length}건 · 최대 50건
          </p>
          <ul className="space-y-1">
            {results.map((node) => (
              <li key={node.id}>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start break-all text-left"
                  onClick={() => {
                    void select(node);
                  }}
                >
                  {node.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <WorkTree
          nodes={tree.nodes}
          selectedId={selectedId}
          onSelect={(node) => {
            void select(node);
          }}
        />
      )}
      {manage ? (
        <p className="text-xs leading-5 text-muted">
          공개 문서도 상위 폴더가 비공개이면 회원에게 보이지 않습니다.
        </p>
      ) : null}
    </div>
  );
  return (
    <main id="main-content" className="mx-auto max-w-[1440px] px-5 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-3xl font-bold">Work</h1>
          <p className="mt-2 text-sm text-muted">업무 기록과 프로젝트 문서</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="lg:hidden" onClick={() => setDrawer(true)}>
            폴더 탐색
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (!(await flush())) return;
              try {
                await reload();
                setNotice('목록을 새로 불러왔습니다.');
              } catch (reason) {
                setError((reason as Error).message);
              }
            }}
          >
            목록 새로고침
          </Button>
          {manage ? (
            <>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  if (!(await flush())) return;
                  setBusy(true);
                  setError('');
                  try {
                    const node = await requestApi<WorkNode>('/api/work/today', 'POST');
                    await reload();
                    setSelectedId(node.id);
                    router.push(`/work/document/${node.id}`);
                  } catch (reason) {
                    setError((reason as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                오늘 업무일지
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  void begin('FOLDER');
                }}
              >
                새 폴더
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  void begin('DOCUMENT');
                }}
              >
                새 문서
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  if (!(await flush())) return;
                  setError('');
                  try {
                    setTrash(await requestApi<Tree>('/api/work/trash'));
                  } catch (reason) {
                    setError((reason as Error).message);
                  }
                }}
              >
                휴지통
              </Button>
            </>
          ) : null}
        </div>
      </header>
      {error && !operation ? (
        <p role="alert" className="mb-5 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {notice}
      </p>
      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className={`hidden min-w-0 border-r border-line pr-6 ${drawer ? '' : 'lg:block'}`}
          aria-label="Work 탐색"
        >
          {!drawer ? sidebar : null}
        </aside>
        <div className="min-w-0">
          {selected && manage ? (
            <div
              className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3"
              aria-label="선택 항목 관리"
            >
              <span className="mr-auto min-w-0 break-all px-1 text-sm font-semibold">
                {selected.name} · {selected.isPublic ? '공개 설정' : '비공개'}
              </span>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  void begin('rename');
                }}
              >
                이름 변경
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  void begin('move');
                }}
              >
                이동
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  void begin('visibility');
                }}
              >
                공개 설정
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  void begin('delete');
                }}
              >
                삭제
              </Button>
            </div>
          ) : null}
          {loading ? (
            <Spinner label="Work 문서 불러오는 중" />
          ) : document ? (
            <WorkDocumentEditor
              key={document.id}
              document={document}
              manage={manage}
              ref={editor}
            />
          ) : (
            <section className="rounded-2xl border border-dashed border-line px-6 py-16">
              <h2 className="break-all text-xl font-bold">
                {selected?.name ?? '업무 문서를 한곳에'}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted">
                {manage
                  ? '왼쪽 폴더에서 문서를 선택하거나 새 문서를 만드세요. 프로젝트별로 폴더를 만들어 문서를 정리할 수 있습니다.'
                  : '운영자가 공개한 문서를 폴더에서 선택해 열람하세요.'}
              </p>
            </section>
          )}
        </div>
      </div>
      <Dialog
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Work 폴더 탐색"
        initialFocus="#work-search-mobile"
      >
        {drawer ? sidebar : null}
      </Dialog>
      {operation ? (
        <WorkNodeDialog
          operation={operation}
          node={selected}
          nodes={tree.nodes}
          busy={busy}
          error={error}
          onClose={() => {
            setOperation(null);
            setError('');
          }}
          onCreate={create}
          onChange={change}
        />
      ) : null}
      <Dialog
        open={trash !== null}
        onClose={() => {
          if (!busy) setTrash(null);
        }}
        title="휴지통"
      >
        <p className="mb-4 text-sm leading-6 text-muted">
          삭제 후 30일 동안 복구할 수 있습니다. 복구한 항목은 비공개로 전환됩니다. 원래 폴더가
          없으면 최상위로 복구하고, 중복 이름에는 복구 번호를 붙입니다.
        </p>
        {error ? (
          <p role="alert" className="mb-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <ul className="space-y-3">
          {trash?.nodes.map((node) => (
            <li
              key={node.id}
              className="flex items-center justify-between gap-3 border-b border-line pb-3"
            >
              <span className="min-w-0 break-all text-sm">{node.name}</span>
              <Button
                variant="secondary"
                disabled={busy}
                aria-label={`${node.name} 복구`}
                onClick={() => {
                  void change({ action: 'restore' }, node.id);
                }}
              >
                복구
              </Button>
            </li>
          ))}
        </ul>
        {trash?.nodes.length === 0 ? (
          <p className="text-sm text-muted">휴지통이 비어 있습니다.</p>
        ) : null}
      </Dialog>
    </main>
  );
}
