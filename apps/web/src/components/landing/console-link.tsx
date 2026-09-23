'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

export function ConsoleLink({ className = '' }: { className?: string }) {
  const { user } = useAuth();

  return (
    <Button asChild variant="secondary" size="lg" className={className}>
      <Link href={user ? '/dashboard' : '/login'}>
        {user ? 'Open console' : 'Launch VigilAI'}
        <ArrowUpRight className="ml-3 h-5 w-5" aria-hidden="true" />
      </Link>
    </Button>
  );
}
