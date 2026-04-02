import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

const LoginScreen: React.FC = () => {
  const [showStylistLogin, setShowStylistLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startSquareOAuth = () => {
    window.location.href = '/api/square/oauth/start';
  };

  const handleStylistLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <Card className="relative mx-auto w-full max-w-3xl bp-shell">
        <div className="pointer-events-none absolute inset-0.75rem rounded-[1.35rem] border border-[color:var(--panel-inner-border)]" style={{ opacity: 0.9 }} />

        <CardContent className="px-6 py-8 sm:px-10 sm:py-12">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <header className="mb-10">
              <h1
                className="bp-title text-5xl sm:text-7xl text-primary"
                aria-label="BLUEPRINT Salon Software"
              >
                BLUEPRINT
              </h1>

              <p className="mt-2 text-2xl sm:text-3xl font-light tracking-tight text-foreground/85">
                Salon Software
              </p>
            </header>

            <div className="w-full space-y-6" role="group" aria-label="Authentication options">
              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="bp-label">
                  Admin Access
                </span>
                <Separator className="flex-1" />
              </div>

              <Button
                onClick={startSquareOAuth}
                aria-label="Log in with Square for admin access"
              >
                Login with Square
              </Button>

              <div className="flex items-center gap-4 pt-2">
                <Separator className="flex-1" />
                <span className="bp-label">
                  Team Access
                </span>
                <Separator className="flex-1" />
              </div>

              {!showStylistLogin ? (
                <div className="space-y-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowStylistLogin(true)}
                    aria-label="Stylist login"
                  >
                    Stylist Login
                  </Button>

                  <button
                    type="button"
                    className="text-primary text-sm font-semibold uppercase tracking-[0.12em] underline-offset-4 hover:underline"
                    onClick={() => { window.location.href = '/join'; }}
                    aria-label="New here? Join with PIN"
                  >
                    New here? Join with PIN
                  </button>
                </div>
              ) : (
                <form onSubmit={handleStylistLogin} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="bp-field"
                    required
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="bp-field"
                    required
                  />
                  {error && (
                    <p className="text-destructive text-xs font-semibold text-center">{error}</p>
                  )}
                  <Button
                    variant="secondary"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setShowStylistLogin(false); setError(null); }}
                    className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginScreen;
