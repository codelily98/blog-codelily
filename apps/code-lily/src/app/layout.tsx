import type { Metadata } from 'next';
import { UiProvider } from '@codelily/ui';
import '@codelily/ui/styles.css';
import './globals.css';
import { SessionProvider } from '@/modules/identity/presentation/session-provider';
import { SiteHeader } from '@/presentation/site-header';
import { SiteFooter } from '@/presentation/site-footer';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://blog.codelily.kr'),
  title: { default: 'code-lily · 기술과 생각의 기록', template: '%s · code-lily' },
  description:
    '배우고 만드는 과정을 기록하는 개발 블로그. 아키텍처, React, 데이터베이스와 일상의 생각을 나눕니다.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-scroll-behavior="smooth" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=localStorage.getItem('cl-theme')==='light'?'light':'dark'}catch(e){}",
          }}
        />
      </head>
      <body>
        <a
          href="#main-content"
          className="fixed top-2 left-2 z-50 -translate-y-24 rounded-lg bg-ink px-5 py-3 text-base focus:translate-y-0"
        >
          본문 바로가기
        </a>
        <UiProvider>
          <SessionProvider>
            <SiteHeader />
            <div className="min-h-[calc(100dvh-240px)]">{children}</div>
            <SiteFooter />
          </SessionProvider>
        </UiProvider>
      </body>
    </html>
  );
}
