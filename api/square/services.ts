import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  console.log('[SERVICES SYNC] Request received:', req.method);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ message: 'Supabase config missing.' });
    }

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get Square access token from body
    let squareAccessToken: string | undefined;
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    squareAccessToken = body?.squareAccessToken;
    console.log('[SERVICES SYNC] Token from body:', squareAccessToken ? '✓' : '✗');

    // Get user ID
    let supabaseUserId: string | undefined;
    const userIdHeader = req.headers['x-user-id'] as string | undefined;
    if (userIdHeader) {
      supabaseUserId = userIdHeader;
      console.log('[SERVICES SYNC] User ID from X-User-Id:', supabaseUserId);
    } else {
      const authHeader = req.headers['authorization'] as string | undefined;
      const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      if (bearer) {
        const { data: userData } = await (supabaseAdmin.auth as any).getUser(bearer);
        supabaseUserId = userData?.user?.id;
        console.log('[SERVICES SYNC] User ID from Bearer:', supabaseUserId);
      }
    }

    if (!supabaseUserId) {
      return res.status(401).json({ message: 'Missing auth. Provide X-User-Id or Bearer token.' });
    }

    // Resolve Square access token and admin user ID
    let adminUserId = supabaseUserId;

    if (!squareAccessToken) {
      // 1. Try caller's own merchant_settings (admin path)
      const { data: ms } = await supabaseAdmin
        .from('merchant_settings')
        .select('square_access_token')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (ms?.square_access_token) {
        squareAccessToken = ms.square_access_token;
        console.log('[SERVICES SYNC] Token from own merchant_settings ✓');
      } else {
        // 2. Caller is a stylist — resolve admin's token
        const { data: userData } = await (supabaseAdmin.auth as any).admin.getUserById(supabaseUserId);
        const stylistSquareId = userData?.user?.user_metadata?.stylist_id;
        let resolvedAdminId = userData?.user?.user_metadata?.admin_user_id;

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
            .select('square_access_token')
            .eq('supabase_user_id', resolvedAdminId)
            .maybeSingle();

          if (adminMs?.square_access_token) {
            squareAccessToken = adminMs.square_access_token;
            console.log('[SERVICES SYNC] Token from admin merchant_settings ✓ (admin:', resolvedAdminId, ')');
          }
        }
      }

      if (!squareAccessToken) {
        return res.status(401).json({ message: 'Could not resolve Square access token for this user or their admin.' });
      }
    }

    // Fetch catalog from Square (items + variations)
    const allObjects: any[] = [];
    let cursor: string | undefined;

    do {
      const url = `https://connect.squareup.com/v2/catalog/list?types=ITEM,ITEM_VARIATION${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      console.log('[SERVICES SYNC] Fetching:', url);

      const squareRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2025-10-16',
        },
      });

      if (!squareRes.ok) {
        const err = await squareRes.json();
        console.error('[SERVICES SYNC] Square API error:', err);
        return res.status(squareRes.status).json({ message: 'Failed to fetch catalog', details: err });
      }

      const data = await squareRes.json();
      if (data.objects) {
        allObjects.push(...data.objects);
      }
      cursor = data.cursor;
    } while (cursor);

    console.log('[SERVICES SYNC] Total catalog objects:', allObjects.length);

    // Build items and variations maps
    const items = allObjects.filter((o: any) => o.type === 'ITEM');
    const variations = allObjects.filter((o: any) => o.type === 'ITEM_VARIATION');

    // Create service rows from items with their variations
    const rows: any[] = [];
    for (const item of items) {
      const itemData = item.item_data;
      if (!itemData) continue;

      const itemVariations = (itemData.variations || []).concat(
        variations.filter((v: any) => v.item_variation_data?.item_id === item.id)
      );

      // Deduplicate variations by ID
      const seen = new Set<string>();
      for (const v of itemVariations) {
        if (seen.has(v.id)) continue;
        seen.add(v.id);

        const vData = v.item_variation_data || {};
        const priceMoney = vData.price_money;

        rows.push({
          supabase_user_id: adminUserId,
          square_item_id: item.id,
          square_variation_id: v.id,
          name: itemData.name || 'Unnamed Service',
          variation_name: vData.name || null,
          price_cents: priceMoney?.amount ? Number(priceMoney.amount) : null,
          currency: priceMoney?.currency || 'USD',
          duration_minutes: vData.service_duration ? Math.round(Number(vData.service_duration) / 60000) : null,
          category: itemData.category_id || null,
          updated_at: new Date().toISOString(),
        });
      }
    }

    console.log('[SERVICES SYNC] Services to upsert:', rows.length);

    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from('services')
        .upsert(rows, { onConflict: 'square_variation_id' });

      if (error) {
        console.error('[SERVICES SYNC] Upsert failed:', error);
        return res.status(500).json({ message: error.message });
      }
    }

    console.log('[SERVICES SYNC] Done. Synced', rows.length, 'services');
    return res.status(200).json({ inserted: rows.length, services: rows });
  } catch (e: any) {
    console.error('[SERVICES SYNC] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
}
