'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Video, AlertTriangle, BarChart3, Sliders, Activity, LogOut, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const links = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, tag: 'LIVE' },
    { href: '/cameras', label: 'Cameras', icon: Video, tag: 'NODES' },
    { href: '/events', label: 'Events', icon: AlertTriangle, tag: 'ALERTS' },
    { href: '/analytics', label: 'Analytics', icon: BarChart3, tag: 'METRICS' },
    { href: '/rules', label: 'Rules', icon: Sliders, tag: 'POLICIES' },
    { href: '/system', label: 'System', icon: Activity, tag: 'DIAG' },
  ];

  return (
    <aside className="flex h-full w-64 flex-col border-r-4 border-black bg-neo-bg text-black select-none z-20 shrink-0">
      {/* Brand Header */}
      <div className="flex flex-col border-b-4 border-black bg-neo-yellow p-4 shadow-[0_2px_0px_#000000]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 border-2 border-black bg-black flex items-center justify-center text-neo-yellow">
              <ShieldAlert className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-black uppercase tracking-tighter">VigilAI</span>
          </div>
          <span className="border border-black bg-white px-1.5 py-0.5 text-[9px] font-black tracking-widest uppercase">
            v1.0
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-black/70">
          <span>OPERATIONAL CONSOLE</span>
          <span className="inline-block h-2 w-2 rounded-full bg-neo-green border border-black animate-pulse" />
        </div>
      </div>

      {/* Navigation Matrix */}
      <nav className="flex-1 space-y-2 p-3 overflow-y-auto">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-black/50 px-2 py-1">
          Surveillance Matrix
        </div>
        {links.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center justify-between border-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-100",
                active
                  ? "bg-neo-yellow text-black border-black shadow-neo-sm translate-x-1 font-black"
                  : "bg-white text-black border-black/40 hover:border-black hover:bg-black hover:text-white hover:translate-x-1"
              )}
            >
              <div className="flex items-center space-x-3">
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span>{item.label}</span>
              </div>
              <span
                className={cn(
                  "text-[9px] font-mono px-1 py-0.5 border text-black transition-colors",
                  active
                    ? "bg-white border-black font-black"
                    : "bg-neo-muted border-black/30 group-hover:bg-neo-yellow group-hover:text-black group-hover:border-black"
                )}
              >
                {item.tag}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Operator Session Footer */}
      <div className="border-t-4 border-black bg-white p-3 space-y-3">
        <div className="border-2 border-black bg-neo-cream p-2 flex items-center space-x-2.5 shadow-[2px_2px_0px_#000000]">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-neo-yellow text-black font-black text-sm">
            {user?.username?.charAt(0).toUpperCase() || 'OP'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-black uppercase truncate text-black">{user?.username || 'Operator'}</span>
            <span className="text-[10px] font-mono text-black/60 truncate">ACTIVE SESSION</span>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex w-full items-center justify-center space-x-2 border-2 border-black bg-white hover:bg-neo-red hover:text-white px-3 py-2 text-xs font-black uppercase tracking-wider shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-100"
        >
          <LogOut className="h-4 w-4" strokeWidth={2.5} />
          <span>Terminate Session</span>
        </button>
      </div>
    </aside>
  );
}
