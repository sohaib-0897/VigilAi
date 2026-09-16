'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ShieldAlert, KeyRound, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

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
      setError(err.message || 'Authentication rejected. Verify credentials.');
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
            <span className="h-2.5 w-2.5 rounded-full bg-neo-red border border-black animate-ping" />
            <span>OPERATOR ACCESS TERMINAL</span>
          </div>
          <span>SEC-LVL 4</span>
        </div>

        <Card className="border-4 border-black bg-white shadow-neo-lg rounded-none">
          <CardHeader className="border-b-4 border-black bg-neo-cream p-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="h-10 w-10 border-2 border-black bg-black text-neo-yellow flex items-center justify-center">
                <ShieldAlert className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight">VigilAI</CardTitle>
                <p className="text-xs font-bold text-black/70 uppercase tracking-wider font-mono">
                  Real-Time CV Surveillance
                </p>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 p-6">
              {error && (
                <div className="flex items-start space-x-2 border-2 border-black bg-neo-red p-3 text-white shadow-[2px_2px_0px_#000000]">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={3} />
                  <span className="text-xs font-bold uppercase tracking-wide">{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-black">
                  Operator Email
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

              <div className="space-y-1.5">
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
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 border-t-2 border-black p-6 bg-neo-cream/40">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 text-sm font-black tracking-widest bg-black text-white hover:bg-neo-yellow hover:text-black border-2 border-black shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px]"
              >
                <KeyRound className="h-4 w-4 mr-2" strokeWidth={2.5} />
                {submitting ? 'AUTHENTICATING...' : 'AUTHENTICATE & ENTER'}
              </Button>

              <div className="flex justify-between items-center w-full text-xs font-bold">
                <span className="text-black/60">New operator deployment?</span>
                <Link
                  href="/register"
                  className="bg-white border-2 border-black px-2 py-1 text-black hover:bg-neo-yellow shadow-[2px_2px_0px_#000000] uppercase tracking-wider transition-colors"
                >
                  Create Account
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center font-mono text-[10px] text-black/50 uppercase tracking-widest">
          UNAUTHORIZED SURVEILLANCE INTERCEPTION IS LOGGED AND PERSISTED
        </div>
      </div>
    </div>
  );
}
