'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthAlert, AuthShell, authSwitchLink } from '@/components/auth/auth-shell';
import { PasswordField } from '@/components/auth/password-field';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Sign-in failed. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      label="Sign in"
      title="Operator console"
      description="Sign in to manage cameras, zones, rules and events."
      footer={
        <p className="flex flex-wrap items-center gap-x-2">
          No account yet?
          <Link href="/register" className={authSwitchLink}>Create an account</Link>
        </p>
      }
    >
      <form method="post" onSubmit={handleSubmit} aria-busy={submitting} className="mt-6 space-y-5">
        <AuthAlert message={error} />

        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={submitting}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <PasswordField
            id="login-password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={submitting}
            className="h-11"
          />
        </div>

        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? 'Authenticating…' : 'Authenticate & enter'}
        </Button>
      </form>
    </AuthShell>
  );
}
