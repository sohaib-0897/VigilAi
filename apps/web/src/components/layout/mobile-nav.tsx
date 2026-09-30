'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { SidebarPanel } from './sidebar';

const iconButton =
  'grid h-11 w-11 shrink-0 place-items-center border border-border-strong bg-surface text-foreground transition-colors duration-micro ease-standard hover:bg-muted';

/**
 * Below `lg` the console navigation opens as a left drawer. Radix Dialog provides
 * the focus trap, Escape to close, focus return to the trigger, scroll lock and
 * `aria-expanded`/`aria-controls` on the trigger.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close when the route changes (covers browser back/forward while open).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The drawer is hidden from `lg` up; close it so its focus trap and scroll lock
  // never outlive a resize to desktop.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onChange = () => desktop.matches && setOpen(false);
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger className={iconButton} aria-label="Open navigation">
        <Menu className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/55 duration-ui data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="surface-optical fixed inset-y-0 left-0 z-50 w-[min(20rem,calc(100vw-3rem))] border-r border-border shadow-overlay duration-ui ease-acquire data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
        >
          <DialogPrimitive.Title className="sr-only">Console navigation</DialogPrimitive.Title>
          <SidebarPanel
            onNavigate={() => setOpen(false)}
            brandAction={
              <DialogPrimitive.Close className={iconButton} aria-label="Close navigation">
                <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </DialogPrimitive.Close>
            }
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
