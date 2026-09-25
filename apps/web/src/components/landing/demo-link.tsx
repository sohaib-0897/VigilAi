'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, LoaderCircle, Play } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function DemoLink() {
  const { user, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const createOrOpen = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const camera = await api.createDemoCamera();
      router.push(`/cameras/${camera.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the demo camera');
      setSubmitting(false);
    }
  };

  if (!user) {
    return <Button asChild variant="violet" size="lg" disabled={authLoading}>
      <Link href="/login">TRY THE DEMO<Play className="ml-3 h-4 w-4" aria-hidden="true" /></Link>
    </Button>;
  }

  return <span className="inline-flex flex-col items-start gap-2">
    <Button variant="violet" size="lg" onClick={createOrOpen} disabled={submitting}>
      {submitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="mr-2 h-4 w-4" aria-hidden="true" />}
      {submitting ? 'Opening feed…' : 'USE DEMO VIDEO'}
      {!submitting && <ArrowUpRight className="ml-3 h-4 w-4" aria-hidden="true" />}
    </Button>
    {error && <span role="alert" className="max-w-xs border-2 border-black bg-neo-red px-2 py-1 text-xs font-bold">{error}</span>}
  </span>;
}
