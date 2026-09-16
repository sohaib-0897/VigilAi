'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { UserPlus, AlertTriangle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      return setError('Passwords do not match. Verification failed.');
    }
    setSubmitting(true);
    setError('');
    try {
      await register(email, username, password);
    } catch (err: any) {
      setError(err.message || 'Operator enrollment failed. Check input criteria.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neo-bg bg-tech-grid p-4 text-black select-none">
      <div className="w-full max-w-md space-y-4">
        {/* Terminal Header Sticker */}
        <div className="flex items-center justify-between border-2 border-black bg-neo-yellow p-2 shadow-neo-sm font-mono text-xs font-black uppercase tracking-wider">
          <div className="flex items-center space-x-2">
            <span className="h-2.5 w-2.5 rounded-full bg-neo-green border border-black animate-pulse" />
            <span>OPERATOR ENROLLMENT PROTOCOL</span>
          </div>
          <span>SEC-REG</span>
        </div>

        <Card className="border-4 border-black bg-white shadow-neo-lg rounded-none">
          <CardHeader className="border-b-4 border-black bg-neo-cream p-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="h-10 w-10 border-2 border-black bg-neo-yellow text-black flex items-center justify-center shadow-[2px_2px_0px_#000000]">
                <UserPlus className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight">Register Operator</CardTitle>
                <p className="text-xs font-bold text-black/70 uppercase tracking-wider font-mono">
                  Provision Surveillance Credentials
                </p>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3.5 p-6">
              {error && (
                <div className="flex items-start space-x-2 border-2 border-black bg-neo-red p-3 text-white shadow-[2px_2px_0px_#000000]">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={3} />
                  <span className="text-xs font-bold uppercase tracking-wide">{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-black uppercase tracking-wider text-black">
                  Corporate / Surveillance Email
                </label>
                <Input
                  type="email"
                  placeholder="operator@vigilai.internal"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-black uppercase tracking-wider text-black">
                  Operator Identifier (Username)
                </label>
                <Input
                  type="text"
                  placeholder="operator_unit_1"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  disabled={submitting}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-black uppercase tracking-wider text-black">
                  Security Passkey
                </label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-black uppercase tracking-wider text-black">
                  Confirm Security Passkey
                </label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  disabled={submitting}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 border-t-2 border-black p-6 bg-neo-cream/40">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 text-sm font-black tracking-widest bg-neo-yellow text-black hover:bg-black hover:text-white border-2 border-black shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px]"
              >
                <ShieldCheck className="h-4 w-4 mr-2" strokeWidth={2.5} />
                {submitting ? 'ENROLLING OPERATOR...' : 'ENROLL OPERATOR & ISSUE TOKEN'}
              </Button>

              <div className="flex justify-between items-center w-full text-xs font-bold">
                <span className="text-black/60">Existing operator credentials?</span>
                <Link
                  href="/login"
                  className="bg-white border-2 border-black px-2 py-1 text-black hover:bg-neo-yellow shadow-[2px_2px_0px_#000000] uppercase tracking-wider transition-colors"
                >
                  Return to Sign In
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
