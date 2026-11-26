import type { ReactNode } from 'react';

export function EditorActions({ status, children }: { status: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-y border-line py-2">
      <div className="min-w-0 text-sm text-muted">{status}</div>
      <div className="flex flex-wrap items-center gap-2 [&>button]:transition-none">{children}</div>
    </div>
  );
}
