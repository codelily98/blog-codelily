'use client';

import type { ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';

export function ManageShell({
  navigation,
  children,
}: {
  navigation: ReactNode;
  children: ReactNode;
}) {
  const writingPost = useSelectedLayoutSegment() === 'posts';
  return (
    <main id="main-content" className={writingPost ? 'page-shell editor-page-shell' : 'page-shell'}>
      {writingPost ? null : navigation}
      {children}
    </main>
  );
}
