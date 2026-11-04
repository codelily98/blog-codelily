import Link from 'next/link';
import { Flower2 } from 'lucide-react';
import { AnalyticsConsent } from '@/modules/telemetry/presentation/analytics-consent';
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-[1168px] flex-col justify-between gap-5 px-6 py-8 text-xs text-muted sm:flex-row">
        <div>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-base font-bold text-ink"
          >
            <Flower2 size={18} />
            code-lily
          </Link>
          <p className="mt-1 leading-6">기술을 배우고, 기록하고, 조금씩 더 나아가는 공간입니다.</p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div className="flex flex-wrap items-center gap-x-5">
            <Link href="/posts" className="flex min-h-11 items-center">
              Posts
            </Link>
            <Link href="/about" className="flex min-h-11 items-center">
              About
            </Link>
            <Link href="/privacy" className="flex min-h-11 items-center">
              개인정보처리방침
            </Link>
            <Link href="/terms" className="flex min-h-11 items-center">
              이용약관
            </Link>
            <AnalyticsConsent />
          </div>
          <p>© {new Date().getFullYear()} code-lily. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
