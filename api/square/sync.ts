import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

/**
 * POST /api/square/sync
 *
 * Unified Square data sync endpoint. Routes by `action` field:
 *   - "clients"  → sync Square customers → Supabase clients table
 *   - "services" → sync Square catalog → Supabase services table
 *   - "team"     → sync Square team members → Supabase square_team_members table
 *
 * Consolidated from: api/square/clients.ts, services.ts, team.ts
 */

// Generate a deterministic UUID v4-like ID from a token
function generateUUIDFromToken(token: string): string {
  const hash = createHash('sha256').update(token).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

function parseBody(req: any) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body;
}

/**
 * Shared: resolve user ID and Square access token from request.
 * Returns { supabaseUserId, adminUserId, squareAccessToken, supabaseAdmin, merchantId? }
 */
async function resolveAuth(req: any) {
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: { status: 500, message: 'Supabase config missing.' } };
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const body = parseBody(req);
  let squareAccessToken: string | undefined = body?.squareAccessToken;

  // Fall back to headers
  if (!squareAccessToken) {
    squareAccessToken =
      (req.headers['x-square-access-token'] as string | undefined) ||
      (req.headers['x-square-access-token'.toLowerCase()] as string | undefined);
  }

  // Resolve user ID
  let supabaseUserId: string | undefined;
  const userIdHeader = req.headers['x-user-id'] as string | undefined;
  console.log(`[SYNC:resolveAuth] X-User-Id header:`, userIdHeader || '(missing)');
  if (userIdHeader) {
    supabaseUserId = userIdHeader;
  } else {
    const authHeader = req.headers['authorization'] as string | undefined;
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (bearer) {
      const { data: userData } = await (supabaseAdmin.auth as any).getUser(bearer);
      supabaseUserId = userData?.user?.id;
    }
  }

  console.log(`[SYNC:resolveAuth] resolved supabaseUserId:`, supabaseUserId || '(missing)');

  if (!supabaseUserId) {
    console.error('[SYNC:resolveAuth] RETURN 401 — no user ID resolved');
    return { error: { status: 401, message: 'Missing auth. Provide X-User-Id or Bearer token.' } };
  }

  // Resolve Square access token and admin user ID
  let adminUserId = supabaseUserId;
  let merchantId: string | undefined;

  if (!squareAccessToken) {
    // 1. Try caller's own merchant_settings (admin path)
    const { data: ms, error: msErr } = await supabaseAdmin
      .from('merchant_settings')
      .select('id, square_access_token')
      .eq('supabase_user_id', supabaseUserId)
      .maybeSingle();

    console.log(`[SYNC:resolveAuth] merchant_settings lookup for user ${supabaseUserId}:`, {
      found: !!ms,
      hasToken: !!ms?.square_access_token,
      tokenLength: ms?.square_access_token?.length ?? 0,
      error: msErr?.message || null,
    });

    merchantId = ms?.id;

    if (ms?.square_access_token) {
      squareAccessToken = ms.square_access_token;
      console.log(`[SYNC:resolveAuth] token found in merchant_settings.square_access_token`);
    }

    if (!squareAccessToken) {
      // 3. Caller might be a stylist — resolve admin's token
      console.log(`[SYNC:resolveAuth] no token from own merchant_settings, trying stylist→admin fallback`);
      const { data: userData } = await (supabaseAdmin.auth as any).admin.getUserById(supabaseUserId);
      const stylistSquareId = userData?.user?.user_metadata?.stylist_id;
      let resolvedAdminId = userData?.user?.user_metadata?.admin_user_id;
      console.log(`[SYNC:resolveAuth] user metadata:`, {
        metadataRole: userData?.user?.user_metadata?.role,
        stylistSquareId: stylistSquareId || null,
        adminUserId: resolvedAdminId || null,
      });

      if (!resolvedAdminId && stylistSquareId) {
        const { data: tmRow } = await supabaseAdmin
          .from('square_team_members')
          .select('supabase_user_id')
          .eq('square_team_member_id', stylistSquareId)
          .maybeSingle();
        resolvedAdminId = tmRow?.supabase_user_id;
        console.log(`[SYNC:resolveAuth] resolved admin via team_members:`, resolvedAdminId || null);
      }

      if (resolvedAdminId) {
        adminUserId = resolvedAdminId;
        const { data: adminMs, error: adminMsErr } = await supabaseAdmin
          .from('merchant_settings')
          .select('id, square_access_token')
          .eq('supabase_user_id', resolvedAdminId)
          .maybeSingle();

        console.log(`[SYNC:resolveAuth] admin merchant_settings lookup for ${resolvedAdminId}:`, {
          found: !!adminMs,
          hasToken: !!adminMs?.square_access_token,
          error: adminMsErr?.message || null,
        });

        merchantId = adminMs?.id;
        if (adminMs?.square_access_token) {
          squareAccessToken = adminMs.square_access_token;
          console.log(`[SYNC:resolveAuth] token found via admin fallback`);
        }
      }
    }

    if (!squareAccessToken) {
      console.error('[SYNC:resolveAuth] RETURN 401 — could not resolve Square access token for user or their admin');
      return {
        error: {
          status: 401,
          message: 'Could not resolve Square access token for this user or their admin.',
          debug: {
            supabaseUserId,
            msFound: !!ms,
            msHasToken: !!ms?.square_access_token,
            msTokenLength: ms?.square_access_token?.length ?? 0,
            msError: msErr?.message || null,
          },
        },
      };
    }
  } else {
    // Token was provided — look up merchant_id for team sync
    const { data: ms } = await supabaseAdmin
      .from('merchant_settings')
      .select('id')
      .eq('supabase_user_id', supabaseUserId)
      .maybeSingle();
    merchantId = ms?.id;
  }

  // ── Resolve salon_id ──
  // Priority: body param > salon_memberships > salons.owner_user_id
  let salonId: string | undefined = body?.salon_id;

  if (!salonId) {
    // 1. Try salon_memberships for the admin user
    const { data: membership } = await supabaseAdmin
      .from('salon_memberships')
      .select('salon_id')
      .eq('user_id', adminUserId)
      .eq('role', 'owner')
      .maybeSingle();
    salonId = membership?.salon_id;
  }

  if (!salonId) {
    // 2. Fallback: salons.owner_user_id
    const { data: salon } = await supabaseAdmin
      .from('salons')
      .select('id')
      .eq('owner_user_id', adminUserId)
      .maybeSingle();
    salonId = salon?.id;
  }

  if (!salonId) {
    console.warn('[SYNC] ⚠️ No salon_id resolved for admin:', adminUserId, '— rows will lack salon_id');
  }

  return { supabaseUserId, adminUserId, squareAccessToken, supabaseAdmin, merchantId, salonId };
}

// ─── CLIENTS SYNC ────────────────────────────────────────────────────────────
async function handleClients(req: any, res: any, ctx: any) {
  const { adminUserId, squareAccessToken } = ctx;

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
    salon_id: ctx.salonId || null,
    name: [c.given_name, c.family_name].filter(Boolean).join(' ') || 'Client',
    email: c.email_address || null,
    phone: c.phone_number || null,
    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(
      [c.given_name, c.family_name].filter(Boolean).join(' ') || 'C'
    )}&background=random`,
    external_id: c.id,
  }));

  if (rows.length > 0) {
    const { error } = await ctx.supabaseAdmin
      .from('clients')
      .upsert(rows, { onConflict: 'external_id' });

    if (error) {
      console.error('[SYNC:clients] Insert failed:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  const externalIds = rows.map((r: any) => r.external_id).filter(Boolean);
  const { data: dbRows, error: fetchError } = await ctx.supabaseAdmin
    .from('clients')
    .select('id, external_id, name, email, phone, avatar_url, supabase_user_id')
    .in('external_id', externalIds)
    .eq('supabase_user_id', ctx.adminUserId);

  if (fetchError) {
    console.error('[SYNC:clients] Post-upsert fetch failed:', fetchError);
    return res.status(500).json({ message: fetchError.message });
  }

  return res.status(200).json({ inserted: rows.length, clients: dbRows || [] });
}

// ─── SERVICES SYNC ────────────────────────────────────────────────────────────
async function handleServices(req: any, res: any, ctx: any) {
  const { adminUserId, squareAccessToken, supabaseAdmin } = ctx;

  const env = (process.env.VITE_SQUARE_ENV || 'production').toLowerCase();
  const squareBase = env === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

  // Fetch catalog from Square (items + variations)
  const allObjects: any[] = [];
  let cursor: string | undefined;

  do {
    const url = `${squareBase}/v2/catalog/list?types=ITEM,ITEM_VARIATION${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;

    const squareRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${squareAccessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2025-10-16',
      },
    });

    if (!squareRes.ok) {
      const err = await squareRes.json();
      console.error('[SYNC:services] Square API error:', err);
      return res.status(squareRes.status).json({ message: 'Failed to fetch catalog', details: err });
    }

    const data = await squareRes.json();
    if (data.objects) {
      allObjects.push(...data.objects);
    }
    cursor = data.cursor;
  } while (cursor);

  // Build items and variations maps
  const items = allObjects.filter((o: any) => o.type === 'ITEM');
  const variations = allObjects.filter((o: any) => o.type === 'ITEM_VARIATION');

  const rows: any[] = [];
  for (const item of items) {
    const itemData = item.item_data;
    if (!itemData) continue;

    const itemVariations = (itemData.variations || []).concat(
      variations.filter((v: any) => v.item_variation_data?.item_id === item.id)
    );

    const seen = new Set<string>();
    for (const v of itemVariations) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);

      const vData = v.item_variation_data || {};
      const priceMoney = vData.price_money;

      rows.push({
        salon_id: ctx.salonId || null,
        name: `${itemData.name || 'Unnamed Service'}${vData.name && vData.name !== 'Regular' ? ` — ${vData.name}` : ''}`,
        cost: priceMoney?.amount ? Number(priceMoney.amount) / 100 : null,
        duration: vData.service_duration ? Math.round(Number(vData.service_duration) / 60000) : null,
        category: itemData.category_id || null,
        source: 'square',
        metadata: {
          square_variation_id: v.id,
          square_item_id: item.id,
          variation_name: vData.name || null,
          price_cents: priceMoney?.amount ? Number(priceMoney.amount) : null,
          currency: priceMoney?.currency || 'USD',
          admin_user_id: adminUserId,
        },
      });
    }
  }

  if (rows.length > 0) {
    // Two-step upsert: find existing by square_variation_id in metadata,
    // then insert new or update existing. Cannot use onConflict with jsonb.
    for (const row of rows) {
      const variationId = row.metadata.square_variation_id;

      let existing: any = null;

      // Primary: dedup by salon_id + source + variation_id
      if (ctx.salonId) {
        const { data } = await supabaseAdmin
          .from('services')
          .select('id')
          .eq('salon_id', ctx.salonId)
          .eq('source', 'square')
          .contains('metadata', { square_variation_id: variationId })
          .maybeSingle();
        existing = data;
      }

      // Fallback: if no match with salon_id, retry without it
      if (!existing) {
        console.warn(`[FALLBACK:sync:dedup] salon_id=${ctx.salonId} found 0 existing services for variation ${variationId}, falling back to source-only lookup`);
        const { data } = await supabaseAdmin
          .from('services')
          .select('id')
          .eq('source', 'square')
          .contains('metadata', { square_variation_id: variationId })
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        await supabaseAdmin
          .from('services')
          .update(row)
          .eq('id', existing.id);
      } else {
        await supabaseAdmin
          .from('services')
          .insert(row);
      }
    }
  }

  return res.status(200).json({ inserted: rows.length, services: rows });
}

// ─── TEAM SYNC ───────────────────────────────────────────────────────────────
async function handleTeam(req: any, res: any, ctx: any) {
  const { supabaseUserId, squareAccessToken, supabaseAdmin, merchantId } = ctx;

  // If token was provided and no merchant_settings exists, save it now
  if (squareAccessToken && !merchantId) {
    const { data: newMerchant, error: createErr } = await supabaseAdmin
      .from('merchant_settings')
      .insert([{
        supabase_user_id: supabaseUserId,
        square_access_token: squareAccessToken,
      }])
      .select('id')
      .single();

    if (!createErr) {
      ctx.merchantId = newMerchant?.id;
    }
  } else if (squareAccessToken && merchantId) {
    // Update the token in merchant_settings
    await supabaseAdmin
      .from('merchant_settings')
      .update({ square_access_token: squareAccessToken })
      .eq('id', merchantId);
  }

  const squareRes = await fetch(
    'https://connect.squareup.com/v2/team-members/search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${squareAccessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-20',
      },
      body: JSON.stringify({
        query: { filter: {} },
        limit: 100,
      }),
    }
  );

  if (!squareRes.ok) {
    const squareError = await squareRes.json();
    console.error('[SYNC:team] Square API error:', squareError);
    return res.status(squareRes.status).json({
      message: 'Failed to fetch team members from Square',
      details: squareError,
    });
  }

  const squareData = await squareRes.json();
  const teamMembers = squareData.team_members || [];

  const rows = teamMembers.map((m: any) => ({
    supabase_user_id: supabaseUserId,
    salon_id: ctx.salonId || null,
    merchant_id: ctx.merchantId || merchantId,
    square_team_member_id: m.id,
    name: [m.given_name, m.family_name].filter(Boolean).join(' ') || 'Team Member',
    email: m.email_address ?? null,
    role: m.is_owner ? 'Owner' : 'Team Member',
    status: m.status,
    raw: m,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from('square_team_members')
    .upsert(rows, { onConflict: 'square_team_member_id' });

  if (error) {
    console.error('[SYNC:team] Supabase error:', error);
    return res.status(500).json({ message: error.message });
  }

  return res.status(200).json({ inserted: rows.length, team: rows });
}

// ─── Router ──────────────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const ctx = await resolveAuth(req);
    if (ctx.error) {
      return res.status(ctx.error.status).json({ message: ctx.error.message, debug: ctx.error.debug });
    }

    const body = parseBody(req);
    const action = body?.action;

    switch (action) {
      case 'clients':
        return await handleClients(req, res, ctx);
      case 'services':
        return await handleServices(req, res, ctx);
      case 'team':
        return await handleTeam(req, res, ctx);
      default:
        return res.status(400).json({ message: `Unknown action: ${action}. Use clients, services, or team.` });
    }
  } catch (e: any) {
    console.error('[SYNC] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
}
