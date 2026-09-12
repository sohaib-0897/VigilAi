'use client';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useAuth } from '@/contexts/auth-context';
import { useEffect, useState } from 'react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
