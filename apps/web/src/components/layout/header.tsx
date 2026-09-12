import { ThemeToggle } from '@/components/theme-toggle';

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="font-medium text-lg">Dashboard</div>
      <div className="flex items-center space-x-4">
        <ThemeToggle />
      </div>
    </header>
  );
}
