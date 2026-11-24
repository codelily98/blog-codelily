'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, requestApi } from '@/presentation/client-api';
import type { Post, PostDraft, PostDraftFields } from '../domain/models';
import { initialDraftFields } from './draft-fields';

type DraftReceipt = Pick<PostDraft, 'version' | 'updatedAt' | 'baseVersion'>;
type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';

export function usePostDraft(post?: Post, draft?: PostDraft, paused = false) {
  const [fields, setFields] = useState(() => draft?.fields ?? initialDraftFields(post));
  const [status, setStatus] = useState<SaveStatus>(draft ? 'saved' : 'idle');
  const [updatedAt, setUpdatedAt] = useState(draft?.updatedAt);
  const [saveError, setSaveError] = useState('');
  const [composing, setComposing] = useState(false);
  const latest = useRef(fields);
  const confirmed = useRef(fields);
  const id = useRef<string | null>(draft?.id ?? post?.id ?? null);
  const version = useRef(draft?.version ?? null);
  const baseVersion = useRef(draft?.baseVersion ?? post?.editVersion ?? null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const editingEntry = useRef<{ url: string; state: unknown } | null>(null);
  const postId = post?.id ?? null;

  function change<K extends keyof PostDraftFields>(key: K, value: PostDraftFields[K]) {
    if (latest.current[key] === value) return;
    const next = { ...latest.current, [key]: value };
    latest.current = next;
    editingEntry.current = { url: window.location.href, state: window.history.state };
    setFields(next);
    setStatus((current) => (current === 'conflict' || current === 'saving' ? current : 'pending'));
    setSaveError('');
  }

  const save = useCallback(
    (force = false): Promise<boolean> => {
      if (inFlight.current) return inFlight.current;
      if (latest.current === confirmed.current && (!force || version.current))
        return Promise.resolve(true);
      const draftId = id.current ?? crypto.randomUUID();
      id.current = draftId;
      const snapshot = latest.current;
      setStatus('saving');
      setSaveError('');
      const request = requestApi<DraftReceipt>(`/api/post-drafts/${draftId}`, 'PUT', {
        postId,
        baseVersion: baseVersion.current,
        version: version.current,
        fields: snapshot,
      })
        .then((saved) => {
          if (!postId && !version.current) {
            window.history.replaceState(null, '', `/manage/posts/new?draft=${draftId}`);
            editingEntry.current = { url: window.location.href, state: window.history.state };
          }
          version.current = saved.version;
          baseVersion.current = saved.baseVersion;
          confirmed.current = snapshot;
          setUpdatedAt(saved.updatedAt);
          setStatus(latest.current === snapshot ? 'saved' : 'pending');
          return true;
        })
        .catch((error: unknown) => {
          setSaveError(
            error instanceof ApiError
              ? error.message
              : '연결을 확인한 뒤 저장을 다시 시도해주세요.',
          );
          setStatus(
            error instanceof ApiError && error.code === 'POST_DRAFT_CONFLICT'
              ? 'conflict'
              : 'error',
          );
          return false;
        })
        .finally(() => {
          inFlight.current = null;
        });
      inFlight.current = request;
      return request;
    },
    [postId],
  );

  const flush = useCallback(
    async (force = false) => {
      if (!(await save(force))) return null;
      while (latest.current !== confirmed.current) {
        if (!(await save())) return null;
      }
      return id.current && version.current ? { id: id.current, version: version.current } : null;
    },
    [save],
  );

  useEffect(() => {
    if (status !== 'pending' || composing || paused) return;
    const timer = window.setTimeout(() => void save(), 1500);
    return () => window.clearTimeout(timer);
  }, [fields, status, composing, paused, save]);

  useEffect(() => {
    const dirty = () => latest.current !== confirmed.current;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty()) return;
      event.preventDefault();
      event.returnValue = '';
    }
    function leaving(event: MouseEvent) {
      const anchor = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (
        !dirty() ||
        !anchor ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      )
        return;
      const destination = new URL(anchor.href);
      if (
        destination.origin !== location.origin ||
        (destination.pathname === location.pathname && destination.search === location.search)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void flush().then((saved) => {
        if (saved) location.assign(destination);
      });
    }
    function traversing(event: Event) {
      const entry = editingEntry.current;
      if (!entry || !dirty()) return;
      event.preventDefault();
      const destination = location.href;
      history.pushState(entry.state, '', entry.url);
      void flush().then((saved) => {
        if (saved) location.assign(destination);
      });
    }
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', leaving, true);
    document.addEventListener('codelily:before-history', traversing);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', leaving, true);
      document.removeEventListener('codelily:before-history', traversing);
    };
  }, [flush]);

  function allowExit() {
    confirmed.current = latest.current;
  }

  return {
    fields,
    status,
    updatedAt,
    saveError,
    id: id.current,
    version: version.current,
    baseVersion: baseVersion.current,
    change,
    flush,
    setComposing,
    composing,
    allowExit,
    appendSource: (suffix: string) => change('source', latest.current.source + suffix),
  };
}
