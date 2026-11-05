import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Work', robots: { index: false, follow: false } };
export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
