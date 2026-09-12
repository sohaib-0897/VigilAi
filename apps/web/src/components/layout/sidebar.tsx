import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Video, AlertTriangle, BarChart, FileText, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const links = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/cameras', label: 'Cameras', icon: Video },
    { href: '/events', label: 'Events', icon: AlertTriangle },
    { href: '/analytics', label: 'Analytics', icon: BarChart },
    { href: '/rules', label: 'Rules', icon: FileText },
    { href: '/system', label: 'System', icon: Settings },
  ];

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <h1 className="text-xl font-bold tracking-tight">VigilAI</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {links.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} className={cn("flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", active ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground")}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.username}</span>
          </div>
        </div>
        <button onClick={logout} className="flex w-full items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
