'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './primitives';
export function Dialog({
  open,
  onClose,
  title,
  children,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  initialFocus?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const callback = useRef(onClose);
  callback.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (open && !dialog.open) {
      dialog.showModal();
      if (initialFocus) dialog.querySelector<HTMLElement>(initialFocus)?.focus();
    } else if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      previous?.focus();
    };
  }, [open, initialFocus]);
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
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-line bg-base p-0 text-ink shadow-2xl backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
        <Button variant="ghost" className="px-3" aria-label="닫기" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
