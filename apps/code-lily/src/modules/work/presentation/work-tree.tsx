'use client';
import { useRef, useState, type KeyboardEvent } from 'react';
import type { WorkNode } from '../domain/models';

export function WorkTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: WorkNode[];
  selectedId: string | null;
  onSelect: (node: WorkNode) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(nodes.filter((n) => n.nodeType === 'FOLDER').map((n) => n.id)),
  );
  const [focusId, setFocusId] = useState<string | null>(null);
  const tree = useRef<HTMLUListElement>(null);
  const children = new Map<string | null, WorkNode[]>();
  for (const node of nodes)
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  for (const siblings of children.values())
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const visible: WorkNode[] = [];
  function visit(parentId: string | null) {
    for (const node of children.get(parentId) ?? []) {
      visible.push(node);
      if (expanded.has(node.id)) visit(node.id);
    }
  }
  visit(null);
  const tabId =
    visible.find((node) => node.id === focusId)?.id ??
    visible.find((node) => node.id === selectedId)?.id ??
    visible[0]?.id;
  function toggle(id: string, open: boolean) {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function focus(id?: string | null) {
    if (id) tree.current?.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.focus();
  }
  function key(event: KeyboardEvent<HTMLLIElement>, node: WorkNode) {
    event.stopPropagation();
    const index = visible.findIndex((item) => item.id === node.id);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focus(visible[index + 1]?.id);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focus(visible[index - 1]?.id);
        break;
      case 'Home':
        event.preventDefault();
        focus(visible[0]?.id);
        break;
      case 'End':
        event.preventDefault();
        focus(visible.at(-1)?.id);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (node.nodeType === 'FOLDER') {
          if (expanded.has(node.id)) focus(children.get(node.id)?.[0]?.id);
          else toggle(node.id, true);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (expanded.has(node.id)) toggle(node.id, false);
        else focus(node.parentId);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect(node);
        if (node.nodeType === 'FOLDER') toggle(node.id, !expanded.has(node.id));
        break;
    }
  }
  function branch(parentId: string | null, level: number) {
    return (children.get(parentId) ?? []).map((node) => (
      <li
        key={node.id}
        role="treeitem"
        data-node-id={node.id}
        tabIndex={node.id === tabId ? 0 : -1}
        aria-selected={node.id === selectedId}
        aria-label={node.name}
        aria-expanded={node.nodeType === 'FOLDER' ? expanded.has(node.id) : undefined}
        aria-level={level}
        onFocus={(event) => {
          event.stopPropagation();
          setFocusId(node.id);
        }}
        onKeyDown={(event) => key(event, node)}
        onClick={(event) => {
          event.stopPropagation();
          event.currentTarget.focus();
          onSelect(node);
          if (node.nodeType === 'FOLDER') toggle(node.id, !expanded.has(node.id));
        }}
        className="rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <div
          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm ${node.id === selectedId ? 'bg-raised text-ink' : 'text-muted hover:bg-surface'}`}
        >
          <span aria-hidden="true">
            {node.nodeType === 'FOLDER' ? (expanded.has(node.id) ? '▾' : '▸') : '·'}
          </span>
          <span className="min-w-0 flex-1 break-words">{node.name}</span>
          {node.isPublic ? <span className="shrink-0 text-xs">공개</span> : null}
        </div>
        {node.nodeType === 'FOLDER' && expanded.has(node.id) ? (
          <ul role="group" className="ml-3 border-l border-line pl-2">
            {branch(node.id, level + 1)}
          </ul>
        ) : null}
      </li>
    ));
  }
  return nodes.length ? (
    <ul ref={tree} role="tree" aria-label="Work 폴더와 문서">
      {branch(null, 1)}
    </ul>
  ) : (
    <p className="py-8 text-sm text-muted">표시할 문서가 없습니다.</p>
  );
}
