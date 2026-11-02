import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { services } from '@/composition';
import { AboutSection } from '@/modules/about/presentation/about-section';
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}
export const metadata: Metadata = {
  title: 'About',
  description: 'code-lily의 소개, 경력과 관심사, 연락처입니다.',
};
export default async function AboutPage({ params }: { params: Promise<{ section?: string[] }> }) {
  if ((await params).section?.length) notFound();
  const sections = await (await services()).about.list();
  return (
    <main id="main-content" className="about-shell">
      {!sections.some((section) => section.kind === 'INTRO') ? (
        <h1 className="text-4xl font-bold">About</h1>
      ) : null}
      {sections.map((section) => (
        <AboutSection key={section.id} section={section} />
      ))}
    </main>
  );
}
