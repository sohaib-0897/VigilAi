'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Video, AlertTriangle, BarChart3, Sliders, Activity, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { TechnicalLabel } from '@/components/primitives/technical-label';
import { BrandLink } from '@/components/landing/brand-link';

export const consoleLinks = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/cameras', label: 'Cameras', icon: Video },
  { href: '/events', label: 'Events', icon: AlertTriangle },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/rules', label: 'Rules', icon: Sliders },
  { href: '/system', label: 'System', icon: Activity },
] as const;

type SidebarPanelProps = {
  /** Called after a navigation link is activated (closes the mobile drawer). */
  onNavigate?: () => void;
  /** Extra control rendered at the end of the brand row (the drawer's close button). */
  brandAction?: React.ReactNode;
};

/**
 * Console navigation: brand, numbered routes and the operator session.
 * Rendered by the fixed desktop rail and by the mobile drawer, so both stay identical.
 */
export function SidebarPanel({ onNavigate, brandAction }: SidebarPanelProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <BrandLink className="min-h-11 text-[1.25rem]" />
        {brandAction}
      </div>

      <nav aria-label="Console" className="flex-1 overflow-y-auto px-3 py-5">
        <TechnicalLabel as="div" className="mb-3 px-2">Console</TechnicalLabel>
        <ul className="space-y-px">
          {consoleLinks.map((item, index) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-11 items-center gap-3 border px-2.5 text-body-sm font-medium transition-colors duration-micro ease-standard',
                    active
                      ? 'border-signal bg-signal text-signal-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span className={cn('vg-telemetry w-5 tabular', active ? 'text-signal-foreground' : 'text-muted-foreground')}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 space-y-3 border-t border-border p-3">
        <div className="flex items-center gap-2.5 px-1">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center border border-border-strong font-display text-sm font-bold uppercase"
          >
            {user?.username?.charAt(0) || '?'}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body-sm font-semibold">{user?.username}</span>
            <span className="vg-telemetry truncate text-muted-foreground">{user?.email}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex min-h-11 w-full items-center justify-center gap-2 border border-border px-3 text-body-sm font-medium text-foreground transition-colors duration-micro ease-standard hover:border-danger hover:bg-danger hover:text-danger-foreground"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}

/** Fixed navigation rail, shown from `lg` up. Below `lg` the same panel opens in `MobileNav`. */
export function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={cn('surface-optical w-64 shrink-0 border-r border-border', className)}>
      <SidebarPanel />
    </aside>
  );
}
