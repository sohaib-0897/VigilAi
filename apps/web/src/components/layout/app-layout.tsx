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
      <div className="flex h-screen items-center justify-center bg-neo-bg bg-tech-grid">
        <div className="border-4 border-black bg-neo-yellow p-6 font-black uppercase text-sm sm:text-base shadow-neo-lg flex items-center space-x-3">
          <div className="h-3 w-3 bg-black animate-ping" />
          <span className="tracking-wider">INITIALIZING SURVEILLANCE CONSOLE...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-neo-bg text-black">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-neo-bg bg-tech-grid p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
