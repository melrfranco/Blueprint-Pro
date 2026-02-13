import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Generate a deterministic UUID v4-like ID from a token
function generateUUIDFromToken(token: string): string {
  const hash = createHash('sha256').update(token).digest('hex');
  // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

export default async function handler(req: any, res: any) {
  try {
    let squareAccessToken: string | undefined;

    // Try to read token from request body first (preferred)
    if (req.method === 'POST') {
      try {
        // Vercel auto-parses JSON bodies into req.body
        let body = req.body;
        if (typeof body === 'string') {
          try { body = JSON.parse(body); } catch { body = {}; }
        }
        squareAccessToken = body?.squareAccessToken;
        console.log('[CLIENT SYNC] Token from body:', squareAccessToken ? '✓' : '✗');
      } catch (e) {
        console.log('[CLIENT SYNC] Failed to parse body:', e);
        // Ignore parse errors, fall through to headers
      }
    }

    // Fall back to headers if not in body
    if (!squareAccessToken) {
      squareAccessToken =
        (req.headers['x-square-access-token'] as string | undefined) ||
        (req.headers['x-square-access-token'.toLowerCase()] as string | undefined);
      console.log('[CLIENT SYNC] Token from headers:', squareAccessToken ? '✓' : '✗');
    }

    const authHeader = req.headers['authorization'] as string | undefined;
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    if (
      !process.env.VITE_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.VITE_SUPABASE_ANON_KEY
    ) {
      return res.status(500).json({ message: 'Supabase config missing.' });
    }

    // Service-role Supabase client (DB access)
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let supabaseUserId: string | undefined;

    // Try X-User-Id header first (lightweight, avoids Vercel 494 header size limit)
    const userIdHeader = req.headers['x-user-id'] as string | undefined;
    if (userIdHeader) {
      supabaseUserId = userIdHeader;
      console.log('[CLIENT SYNC] User ID from X-User-Id header:', supabaseUserId);
    } else if (bearer) {
      const { data: userData } = await (supabaseAdmin.auth as any).getUser(bearer);
      supabaseUserId = userData?.user?.id;
      console.log('[CLIENT SYNC] User ID from Bearer token:', supabaseUserId);
    }

    if (!supabaseUserId) {
      return res.status(401).json({ message: 'Missing auth. Provide X-User-Id or Bearer token.' });
    }

    // Resolve the Square access token and the admin user ID who owns the clients
    let adminUserId = supabaseUserId; // default: caller is the admin

    if (!squareAccessToken) {
      // 1. Try caller's own merchant_settings first (admin path)
      const { data: ms } = await supabaseAdmin
        .from('merchant_settings')
        .select('id, square_access_token')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (ms?.square_access_token) {
        squareAccessToken = ms.square_access_token;
        console.log('[CLIENT SYNC] Token from own merchant_settings ✓');
      } else {
        // 2. Caller might be a stylist — resolve admin via square_team_members
        // Get the caller's user metadata to find their stylist_id
        const { data: userData } = await (supabaseAdmin.auth as any).admin.getUserById(supabaseUserId);
        const stylistSquareId = userData?.user?.user_metadata?.stylist_id;
        let resolvedAdminId = userData?.user?.user_metadata?.admin_user_id;

        // Fallback: look up admin from square_team_members
        if (!resolvedAdminId && stylistSquareId) {
          const { data: tmRow } = await supabaseAdmin
            .from('square_team_members')
            .select('supabase_user_id')
            .eq('square_team_member_id', stylistSquareId)
            .maybeSingle();
          resolvedAdminId = tmRow?.supabase_user_id;
        }

        if (resolvedAdminId) {
          adminUserId = resolvedAdminId;
          const { data: adminMs } = await supabaseAdmin
            .from('merchant_settings')
            .select('id, square_access_token')
            .eq('supabase_user_id', resolvedAdminId)
            .maybeSingle();

          if (adminMs?.square_access_token) {
            squareAccessToken = adminMs.square_access_token;
            console.log('[CLIENT SYNC] Token from admin merchant_settings ✓ (admin:', resolvedAdminId, ')');
          }
        }
      }

      if (!squareAccessToken) {
        return res.status(401).json({
          message: 'Could not resolve Square access token for this user or their admin.',
        });
      }
    }

    const squareRes = await fetch(
      'https://connect.squareup.com/v2/customers',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-20',
        },
      }
    );

    const json = await squareRes.json();
    if (!squareRes.ok) {
      return res.status(squareRes.status).json(json);
    }

    const customers = json.customers || [];

    const rows = customers.map((c: any) => ({
      supabase_user_id: adminUserId,
      name: [c.given_name, c.family_name].filter(Boolean).join(' ') || 'Client',
      email: c.email_address || null,
      phone: c.phone_number || null,
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        [c.given_name, c.family_name].filter(Boolean).join(' ') || 'C'
      )}&background=random`,
      external_id: c.id,
    }));

    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from('clients')
        .upsert(rows, { onConflict: 'external_id' });

      if (error) {
        console.error('[CLIENT SYNC] Insert failed:', error);
        return res.status(500).json({ message: error.message });
      }
    }

    // Return the actual client data so the frontend can use it directly (bypasses RLS)
    return res.status(200).json({ inserted: rows.length, clients: rows });
  } catch (e: any) {
    console.error('[CLIENT SYNC] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
}
