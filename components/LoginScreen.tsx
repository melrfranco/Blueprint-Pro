import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

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
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500 relative overflow-hidden bg-primary"
    >
      {/* Blueprint grid background */}
      <div className="absolute inset-0 opacity-10 bp-grid-bg" />

      <div className="bg-white bp-container-tall shadow-2xl w-full max-w-md relative border border-border depth-3 overflow-hidden">
        <div className="p-10 text-center">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2F8d6a989189ff4d9e8633804d5d0dbd86%2F7093acbcb2ca4ac783c4b84bc621e52f"
            alt="Blueprint Logo"
            className="login-logo object-contain mx-auto w-full block"
          />
        </div>

        <div className="px-10 pb-10 pt-2">
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-0.5 bg-foreground/30" />
            <span className="bp-overline text-foreground">Admin access</span>
            <div className="flex-1 h-0.5 bg-foreground/30" />
          </div>

          <button
            data-ui="button"
            onClick={startSquareOAuth}
            className="w-full py-4 bp-btn-primary text-center"
          >
            Login with Square
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-0.5 bg-foreground/30" />
            <span className="bp-overline text-foreground">Team access</span>
            <div className="flex-1 h-0.5 bg-foreground/30" />
          </div>

          {!showStylistLogin ? (
            <div className="space-y-3">
              <button
                data-ui="button"
                onClick={() => setShowStylistLogin(true)}
                className="w-full py-4 bp-btn-secondary text-center"
              >
                Stylist Login
              </button>
              <button
                data-ui="button"
                onClick={() => { window.location.href = '/join'; }}
                className="w-full py-3 text-xs uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground transition-colors"
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
                className="w-full p-3 border-2 bp-container-compact font-medium outline-none bg-muted text-foreground focus:border-accent transition-all text-sm"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full p-3 border-2 bp-container-compact font-medium outline-none bg-muted text-foreground focus:border-accent transition-all text-sm"
                required
              />
              {error && (
                <p className="text-destructive text-xs font-semibold text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                data-ui="button"
                className="w-full py-4 bp-btn-secondary text-center disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
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
    </div>
  );
};

export default LoginScreen;
