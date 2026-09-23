'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/lib/types';
import { api } from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, user: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    api.getMe()
      .then(u => {
        setUser(u);
        if (pathname === '/login' || pathname === '/register') router.push('/dashboard');
      })
      .catch(() => {
        setUser(null);
        if (!['/', '/login', '/register'].includes(pathname)) router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [pathname, router]);

  const login = async (e: string, p: string) => {
    await api.login(e, p);
    setUser(await api.getMe());
    router.push('/dashboard');
  };

  const register = async (e: string, u: string, p: string) => {
    await api.register(e, u, p);
    await api.login(e, p);
    setUser(await api.getMe());
    router.push('/dashboard');
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    router.push('/login');
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
