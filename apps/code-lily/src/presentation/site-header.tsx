'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Flower2, Search } from 'lucide-react';
import { Button, Dialog, Input, ThemeToggle } from '@codelily/ui';
import { GoogleLoginButton, useSession } from '@/modules/identity/presentation/session-provider';
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { actor } = useSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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
        <div className="mx-auto flex min-h-[72px] max-w-[1168px] items-center gap-3 px-5 sm:px-6">
          <Link
            href="/"
            aria-label="code-lily 홈"
            className="mr-auto flex min-h-11 shrink-0 items-center gap-2.5 text-xl font-bold tracking-tight"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line">
              <Flower2 size={19} strokeWidth={1.8} />
            </span>
            <span>code-lily</span>
          </Link>
          <nav aria-label="주 메뉴" className="hidden items-center gap-1 sm:flex">
            <Link
              href="/posts"
              aria-current={pathname === '/' || pathname.startsWith('/posts') ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold ${pathname === '/' || pathname.startsWith('/posts') ? 'bg-surface text-ink' : 'text-muted hover:text-ink'}`}
            >
              Posts
            </Link>
            <Link
              href="/about"
              aria-current={pathname === '/about' ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold ${pathname === '/about' ? 'bg-surface text-ink' : 'text-muted hover:text-ink'}`}
            >
              About
            </Link>
          </nav>
          <Button
            variant="ghost"
            className="hidden gap-2 rounded-full border border-line px-3 md:inline-flex"
            onClick={() => setOpen(true)}
            aria-label="글 검색"
          >
            <Search size={15} />
            <span className="text-xs">검색</span>
            <kbd className="ml-1 rounded bg-surface px-1.5 py-1 text-[10px] text-muted">⌘K</kbd>
          </Button>
          <Button
            variant="ghost"
            className="w-11 px-0 md:hidden"
            onClick={() => setOpen(true)}
            aria-label="글 검색"
          >
            <Search size={18} />
          </Button>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          {actor && actor.role !== 'MEMBER' ? (
            <Link
              href="/manage"
              className="hidden min-h-11 items-center px-2 text-sm text-muted hover:text-ink md:flex"
            >
              내 Posts
            </Link>
          ) : null}
          <GoogleLoginButton />
        </div>
        <div className="mx-auto flex max-w-[1168px] items-center border-t border-line px-5 sm:hidden">
          <nav aria-label="주 메뉴" className="mr-auto flex items-center gap-1">
            <Link href="/posts" className="flex min-h-11 items-center px-3 text-sm font-semibold">
              Posts
            </Link>
            <Link href="/about" className="flex min-h-11 items-center px-3 text-sm font-semibold">
              About
            </Link>
          </nav>
          <ThemeToggle />
          {actor && actor.role !== 'MEMBER' ? (
            <Link href="/manage" className="flex min-h-11 items-center px-3 text-sm">
              내 Posts
            </Link>
          ) : null}
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
            router.push(`/posts?q=${encodeURIComponent(query)}`);
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
            placeholder="궁금한 주제를 검색하세요"
            maxLength={100}
          />
          <Button type="submit">검색</Button>
        </form>
        <p className="mt-4 text-xs text-muted">제목과 요약에서 검색합니다.</p>
      </Dialog>
    </>
  );
}
