'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthAlert, AuthShell, authSwitchLink } from '@/components/auth/auth-shell';
import { PasswordField } from '@/components/auth/password-field';

const MISMATCH = 'Passwords do not match.';

export default function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const confirmRef = useRef<HTMLInputElement>(null);
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMismatch(true);
      setError(MISMATCH);
      confirmRef.current?.focus();
      return;
    }
    setMismatch(false);
    setSubmitting(true);
    setError('');
    try {
      await register(email, username, password);
    } catch (err: any) {
      setError(err.message || 'Account creation failed. Check the fields and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Editing either password clears a stale mismatch.
  const clearMismatch = () => {
    if (!mismatch) return;
    setMismatch(false);
    setError('');
  };

  return (
    <AuthShell
      label="Create account"
      title="New operator"
      description="Create an account to configure cameras and review events."
      footer={
        <p className="flex flex-wrap items-center gap-x-2">
          Already have an account?
          <Link href="/login" className={authSwitchLink}>Sign in</Link>
        </p>
      }
    >
      <form method="post" onSubmit={handleSubmit} aria-busy={submitting} className="mt-6 space-y-5">
        <AuthAlert message={error} />

        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            maxLength={255}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={submitting}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-username">Username</Label>
          <Input
            id="register-username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            minLength={3}
            maxLength={50}
            aria-describedby="register-username-hint"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            disabled={submitting}
            className="h-11"
          />
          <p id="register-username-hint" className="text-caption text-muted-foreground">3–50 characters.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-password">Password</Label>
          <PasswordField
            id="register-password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            aria-describedby="register-password-hint"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              clearMismatch();
            }}
            required
            disabled={submitting}
            className="h-11"
          />
          <p id="register-password-hint" className="text-caption text-muted-foreground">At least 8 characters.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-confirm">Confirm password</Label>
          <PasswordField
            ref={confirmRef}
            id="register-confirm"
            name="confirm-password"
            autoComplete="new-password"
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? 'register-confirm-error' : undefined}
            value={confirm}
            onChange={e => {
              setConfirm(e.target.value);
              clearMismatch();
            }}
            required
            disabled={submitting}
            className="h-11"
          />
          {mismatch && (
            <p id="register-confirm-error" className="text-caption font-medium text-danger-ink">
              {MISMATCH} Re-enter the same password.
            </p>
          )}
        </div>

        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
