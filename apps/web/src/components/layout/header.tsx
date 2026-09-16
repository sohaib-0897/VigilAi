'use client';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

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
    <header className="flex h-14 items-center justify-between border-b-4 border-black bg-white px-4 sm:px-6 shadow-[0_2px_0px_#000000] z-10">
      <div className="flex items-center space-x-3">
        <span className="border-2 border-black bg-neo-cream px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
          Monitoring Console
        </span>
      </div>

      <div className="flex items-center space-x-4">
        {time && (
          <span className="hidden sm:inline-block font-mono text-xs font-bold bg-black text-white px-2 py-1 border border-black">
            {time}
          </span>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
