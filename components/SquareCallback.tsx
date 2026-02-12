import { useEffect, useRef, useState } from 'react';

export default function SquareCallback() {
  const hasRun = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [squareTokenData, setSquareTokenData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTokenExchange = async (emailValue?: string, codeOverride?: string) => {
    try {
      const body: any = {};

      // Retry with email: use saved token data (never send code again - it's single-use!)
      if (squareTokenData) {
        console.log('Retrying with email using saved token data');
        body.email = emailValue;
        body.access_token = squareTokenData.access_token;
        body.merchant_id = squareTokenData.merchant_id;
      } else {
        // First attempt: only use code (prefer override since React state may be stale)
        body.code = codeOverride || code;
        if (emailValue) {
          body.email = emailValue;
        }
      }

      // Step 1: Exchange OAuth code for Square access token
      const tokenRes = await fetch('/api/square/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok) {
        // Check if email is needed
        if (tokenData?.needsEmail) {
          // Save the token data so we can use it when retrying with email
          setSquareTokenData({
            access_token: tokenData.access_token,
            merchant_id: tokenData.merchant_id,
          });
          setNeedsEmail(true);
          return;
        }
        throw new Error(tokenData?.message || 'Square login failed');
      }

      const { access_token: squareToken, merchant_id, supabase_auth } = tokenData;

      if (!squareToken) {
        throw new Error('No Square access token received');
      }

      if (!supabase_auth?.email || !supabase_auth?.password) {
        throw new Error('No Supabase credentials received from server');
      }

      // Step 2: Sign in on the client side to get a proper session with valid refresh tokens
      const { supabase } = await import('../lib/supabase');

      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Clear any mock user session before setting real session
      localStorage.removeItem('mock_admin_user');

      console.log('[OAuth Callback] Signing in with Supabase...');

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: supabase_auth.email,
        password: supabase_auth.password,
      });

      if (signInError) {
        throw new Error(`Failed to sign in: ${signInError.message}`);
      }

      const session = signInData?.session;
      if (!session) {
        throw new Error('No session returned from sign-in');
      }

      console.log('[OAuth Callback] Session created. User ID:', session.user.id);

      const jwtToken = session.access_token;

      // Step 3: Sync team and clients (blocking - wait so data is available on /admin)
      console.log('[OAuth Callback] Syncing team and clients...');

      const [teamResult, clientResult] = await Promise.allSettled([
        fetch('/api/square/team', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`,
          },
          body: JSON.stringify({ squareAccessToken: squareToken }),
        }).then(r => r.json()),
        fetch('/api/square/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`,
          },
          body: JSON.stringify({ squareAccessToken: squareToken }),
        }).then(r => r.json()),
      ]);

      console.log('[OAuth Callback] Team sync:', teamResult.status, teamResult.status === 'fulfilled' ? teamResult.value : teamResult.reason);
      console.log('[OAuth Callback] Client sync:', clientResult.status, clientResult.status === 'fulfilled' ? clientResult.value : clientResult.reason);
      console.log('[OAuth Callback] Redirecting to /admin');

      // Use regular redirect instead of replace to ensure session is persisted
      window.location.href = '/admin';
    } catch (err) {
      console.error('OAuth callback failed:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');

    if (!codeParam) {
      setError('Missing authorization code from Square.');
      return;
    }

    setCode(codeParam);
    console.log('OAuth callback: handling full OAuth flow with code:', codeParam.substring(0, 10) + '...');
    handleTokenExchange(undefined, codeParam);
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    await handleTokenExchange(email);
  };

  if (needsEmail) {
    return (
      <div style={{ padding: 24, maxWidth: 400 }}>
        <h2>Complete Authentication</h2>
        <p>We couldn't find an email associated with your Square account. Please provide one to continue:</p>
        <form onSubmit={handleEmailSubmit}>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              marginBottom: 12,
              border: '1px solid #ccc',
              borderRadius: 4,
              boxSizing: 'border-box',
            }}
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: 8,
              backgroundColor: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: isSubmitting ? 'default' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? 'Authenticating...' : 'Continue'}
          </button>
        </form>
        {error && (
          <p style={{ color: 'red', marginTop: 16 }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Connecting Square…</h2>
      <p>Please wait. This may take a moment.</p>
      {error && (
        <p style={{ color: 'red', marginTop: 16 }}>
          {error}
        </p>
      )}
    </div>
  );
}
