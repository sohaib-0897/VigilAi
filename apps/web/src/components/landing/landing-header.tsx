'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { BrandLink } from './brand-link';
import { ConsoleLink } from './console-link';

// Label, anchor, and the index that section shows in its own SectionIntro.
const links = [
  ['System', '#system', '01'],
  ['Capabilities', '#capabilities', '02'],
  ['PPE', '#ppe', '03'],
  ['Performance', '#performance', '04'],
  ['Architecture', '#architecture', '05'],
];

const navLink =
  'vg-label inline-flex min-h-11 items-center whitespace-nowrap text-muted-foreground transition-colors duration-micro ease-standard hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="surface-optical sticky top-0 z-40 border-b border-border">
      <div className="vg-container-wide flex h-header items-center justify-between gap-4 xl:gap-6">
        <BrandLink />

        <nav aria-label="Main navigation" className="hidden items-center gap-5 lg:flex xl:gap-8">
          {links.map(([label, href, index]) => (
            <a key={href} href={href} className={navLink}>
              <span aria-hidden="true" className="mr-2 text-muted-foreground/60 tabular">{index}</span>
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4 sm:gap-6 lg:gap-4 xl:gap-6">
          {!user && <Link href="/login" className={`${navLink} hidden sm:inline-flex`}>Sign in</Link>}
          <ConsoleLink className="hidden h-10 px-4 sm:inline-flex" />
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 lg:hidden"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </div>

      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        hidden={!open}
        className="border-t border-border lg:hidden"
        onKeyDown={event => {
          if (event.key === 'Escape') {
            setOpen(false);
            document.querySelector<HTMLButtonElement>('[aria-controls="mobile-navigation"]')?.focus();
          }
        }}
      >
        <div className="vg-container-wide flex flex-col pb-6 pt-2">
          {links.map(([label, href, index]) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center gap-5 border-b border-border text-body font-semibold uppercase tracking-[0.04em] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="vg-label text-muted-foreground tabular">{index} {'//'}</span> {label}
            </a>
          ))}
          {!user && (
            <Link href="/login" onClick={() => setOpen(false)} className={`${navLink} mt-2 sm:hidden`}>Sign in</Link>
          )}
          <ConsoleLink className="mt-4 w-full" />
        </div>
      </nav>
    </header>
  );
}
