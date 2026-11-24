'use client';
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { Button } from './primitives';
export function Dialog({
  open,
  onClose,
  title,
  children,
  initialFocus,
  wide = false,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  initialFocus?: string;
  wide?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const callback = useRef(onClose);
  callback.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = returnFocusRef?.current ?? (document.activeElement as HTMLElement | null);
    dialog.showModal();
    if (initialFocus) dialog.querySelector<HTMLElement>(initialFocus)?.focus();
    return () => {
      dialog.close();
      previous?.focus({ preventScroll: true });
    };
  }, [open, initialFocus, returnFocusRef]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        callback.current();
      }}
      onClick={(event) => {
        if (event.target === ref.current) callback.current();
      }}
      className={`m-auto max-h-[85dvh] overflow-y-auto rounded-2xl border border-line bg-base p-0 text-ink shadow-2xl backdrop:bg-black/60 ${wide ? 'w-full max-w-4xl scroll-pt-20 sm:w-[calc(100%-2rem)]' : 'w-[calc(100%-2rem)] max-w-xl'}`}
    >
      <div
        className={`flex items-center justify-between border-b border-line px-6 py-4 ${wide ? 'sticky top-0 z-10 bg-base' : ''}`}
      >
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
        <Button variant="ghost" className="px-3" aria-label="닫기" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <div className={wide ? 'pb-6' : 'p-6'}>{children}</div>
    </dialog>
  );
}
