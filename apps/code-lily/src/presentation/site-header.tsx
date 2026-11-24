'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button, Dialog, Input, ThemeToggle } from '@codelily/ui';
import { GoogleLoginButton, useSession } from '@/modules/identity/presentation/session-provider';
import { archiveHref } from '@/modules/posts/presentation/archive-query';
import brandMark from '@/app/icon.svg';

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { actor } = useSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const links = [
    { href: '/posts', label: 'Posts' },
    { href: '/series', label: '시리즈' },
    { href: '/about', label: 'About' },
    ...(actor ? [{ href: '/work', label: 'Work' }] : []),
    ...(actor && actor.role !== 'MEMBER' ? [{ href: '/manage', label: '내 Posts' }] : []),
  ];

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-base/95 backdrop-blur-md">
        <div className="publication-shell grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <Link
            href="/"
            aria-label="code-lily 홈"
            className="col-start-1 row-start-1 flex min-h-16 w-fit items-center gap-2.5 text-[1.65rem] font-bold tracking-tight"
          >
            <Image src={brandMark} alt="" width={34} height={34} unoptimized className="shrink-0" />
            <span>code-lily</span>
          </Link>
          <nav
            aria-label="주 메뉴"
            className="col-span-2 row-start-2 flex flex-wrap items-center gap-x-3 border-t border-line md:col-span-1 md:col-start-2 md:row-start-1 md:justify-center md:gap-x-5 md:border-0"
          >
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={
                  pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined
                }
                className="flex min-h-11 items-center px-2 text-sm font-semibold text-ink hover:text-accent aria-[current=page]:text-accent aria-[current=page]:underline aria-[current=page]:underline-offset-4 md:text-[1rem]"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="col-start-2 row-start-1 flex items-center justify-end gap-0.5 md:col-start-3 md:gap-2">
            <Button
              variant="ghost"
              className="w-11 px-0"
              onClick={() => setOpen(true)}
              aria-label="글 검색"
              aria-keyshortcuts="Control+K Meta+K"
            >
              <Search size={21} strokeWidth={1.7} aria-hidden="true" />
            </Button>
            <ThemeToggle />
            <GoogleLoginButton />
          </div>
        </div>
      </header>
      <Dialog
        initialFocus="#site-search"
        open={open}
        onClose={() => setOpen(false)}
        title="글 검색"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            router.push(archiveHref({ q: query.trim() }));
            setOpen(false);
          }}
          className="flex gap-3"
        >
          <label className="sr-only" htmlFor="site-search">
            검색어
          </label>
          <Input
            id="site-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목과 요약 검색"
            maxLength={100}
          />
          <Button type="submit">검색</Button>
        </form>
      </Dialog>
    </>
  );
}
