'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { ConsoleLink } from './console-link';
import styles from './landing.module.css';

const links = [
  ['System', '#system'],
  ['Capabilities', '#capabilities'],
  ['Performance', '#performance'],
  ['Architecture', '#architecture'],
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" aria-label="VigilAI home" className={styles.brand}>
          <span className={styles.brandIcon}><ShieldAlert size={23} strokeWidth={2.5} aria-hidden="true" /></span>
          VIGILAI<span className={styles.brandPlus} aria-hidden="true">+</span>
        </Link>
        <nav aria-label="Main navigation" className={styles.desktopNav}>
          {links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <div className={styles.headerActions}>
          {!user && <Link href="/login" className={styles.signIn}>Sign in</Link>}
          <ConsoleLink className={styles.headerCta} />
          <Button variant="outline" size="icon" className={styles.menuToggle}
            aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open}
            aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </div>
      <nav id="mobile-navigation" aria-label="Mobile navigation" hidden={!open} className={styles.mobileNav}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            setOpen(false);
            document.querySelector<HTMLButtonElement>('[aria-controls="mobile-navigation"]')?.focus();
          }
        }}>
        {links.map(([label, href], index) => (
          <a key={href} href={href} onClick={() => setOpen(false)}><span>0{index + 1}{' //'}</span> {label}</a>
        ))}
        <ConsoleLink />
      </nav>
    </header>
  );
}
