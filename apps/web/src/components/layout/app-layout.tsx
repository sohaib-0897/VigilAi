'use client';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useAuth } from '@/contexts/auth-context';
import { useEffect, useState } from 'react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background" role="status" aria-live="polite">
        <div className="vg-brackets flex items-center gap-3 px-6 py-5">
          <span className="h-2 w-2 bg-foreground motion-safe:animate-signal-blink" aria-hidden="true" />
          <span className="vg-label text-foreground">Loading console</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[60] -translate-y-[150%] border border-border-strong bg-signal px-4 py-2.5 text-body-sm font-semibold text-signal-foreground focus:translate-y-0"
      >
        Skip to content
      </a>
      <Sidebar className="hidden lg:block" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        {/* `relative` makes main the containing block for absolutely positioned descendants
            (sr-only live regions, Radix's hidden native <select>); otherwise they escape the
            scroll container, grow the document and let focus scrolling shift the whole shell. */}
        <main id="main-content" tabIndex={-1} className="relative flex-1 overflow-y-auto focus:outline-none">
          <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
