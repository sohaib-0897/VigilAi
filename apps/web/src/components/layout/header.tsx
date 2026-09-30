'use client';
import { useEffect, useState } from 'react';
import { TechnicalLabel } from '@/components/primitives/technical-label';
import { BrandLink } from '@/components/landing/brand-link';
import { MobileNav } from './mobile-nav';

export function Header() {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border-strong bg-background px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-3 lg:hidden">
          <MobileNav />
          <BrandLink className="min-h-11 text-[1.25rem]" />
        </div>
        <TechnicalLabel as="span" tone="strong" className="hidden lg:inline-flex">Monitoring console</TechnicalLabel>
      </div>
      {time && (
        <time className="vg-telemetry hidden text-muted-foreground sm:inline" dateTime={time.replace(' UTC', 'Z').replace(' ', 'T')}>
          {time}
        </time>
      )}
    </header>
  );
}
