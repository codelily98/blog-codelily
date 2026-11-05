'use client';
import { useState } from 'react';
import { Button, Dialog, Field, Input, Select } from '@codelily/ui';
import type { WorkChangeFields, WorkNode } from '../domain/models';

export type WorkOperation = 'FOLDER' | 'DOCUMENT' | 'rename' | 'move' | 'delete' | 'visibility';
export function WorkNodeDialog({
  operation,
  node,
  nodes,
  busy,
  error,
  onClose,
  onCreate,
  onChange,
}: {
  operation: WorkOperation;
  node: WorkNode | null;
  nodes: WorkNode[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onCreate: (name: string, parentId: string | null, type: WorkNode['nodeType']) => Promise<void>;
  onChange: (input: WorkChangeFields) => Promise<void>;
}) {
  const creating = operation === 'FOLDER' || operation === 'DOCUMENT';
  const [name, setName] = useState(creating ? '' : (node?.name ?? ''));
  const [parentId, setParentId] = useState(
    creating && node?.nodeType === 'FOLDER' ? node.id : (node?.parentId ?? ''),
  );
  const [position, setPosition] = useState(node?.sortOrder ?? 0);
  const titles = {
    FOLDER: '새 폴더',
    DOCUMENT: '새 문서',
    rename: '이름 변경',
    move: '항목 이동',
    delete: '휴지통으로 이동',
    visibility: '공개 설정',
  };
  const excluded = new Set<string>();
  if (!creating && node) {
    excluded.add(node.id);
    for (let depth = 0; depth < 7; depth++)
      for (const item of nodes)
        if (item.parentId && excluded.has(item.parentId)) excluded.add(item.id);
  }
  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={titles[operation]}
      initialFocus="#work-operation-first"
    >
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (creating) await onCreate(name, parentId || null, operation);
          else if (operation === 'rename') await onChange({ action: 'rename', name });
          else if (operation === 'move')
            await onChange({ action: 'move', parentId: parentId || null, sortOrder: position });
          else if (operation === 'visibility')
            await onChange({ action: 'visibility', isPublic: !node?.isPublic });
          else await onChange({ action: 'delete' });
        }}
      >
        {creating || operation === 'rename' ? (
          <Field id="work-operation-first" label="이름">
            <Input
              id="work-operation-first"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              required
              disabled={busy}
            />
          </Field>
        ) : null}
        {creating || operation === 'move' ? (
          <Field id={creating ? 'work-parent' : 'work-operation-first'} label="대상 폴더">
            <Select
              id={creating ? 'work-parent' : 'work-operation-first'}
              aria-label="대상 폴더"
              value={parentId}
              disabled={busy}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">Work 최상위</option>
              {nodes
                .filter((item) => item.nodeType === 'FOLDER' && !excluded.has(item.id))
                .map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name} · {folder.id.slice(0, 6)}
                  </option>
                ))}
            </Select>
          </Field>
        ) : null}
        {operation === 'move' ? (
          <Field id="work-position" label="배치 순서" hint="0은 첫 번째 위치입니다.">
            <Input
              id="work-position"
              type="number"
              min={0}
              max={2000}
              value={position}
              disabled={busy}
              onChange={(event) => setPosition(Number(event.target.value))}
              required
            />
          </Field>
        ) : null}
        {operation === 'delete' ? (
          <p>
            ‘{node?.name}’과 현재 포함된 하위 항목을 휴지통으로 이동합니다. 30일 동안 복구할 수
            있습니다.
          </p>
        ) : null}
        {operation === 'visibility' ? (
          <p>
            {node?.isPublic
              ? '비공개로 전환하면 이 항목과 그 아래 문서를 일반 회원이 열 수 없습니다.'
              : '공개하면 로그인한 회원이 조회할 수 있습니다. 상위 폴더도 공개되어야 하며, 하위 항목의 개별 공개 설정이 적용됩니다.'}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            취소
          </Button>
          <Button
            id={
              operation === 'delete' || operation === 'visibility'
                ? 'work-operation-first'
                : undefined
            }
            type="submit"
            variant={operation === 'delete' ? 'danger' : 'primary'}
            disabled={busy}
          >
            {busy ? '처리 중…' : '적용'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
