import { createClient } from '@supabase/supabase-js';

/**
 * /api/stylist-data
 * 
 * Reads services, clients, and team members from Supabase for a stylist's admin.
 * No Square API calls — just reads what the admin already synced.
 */
export default async function handler(req: any, res: any) {
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

    // Identify the calling user
    const userIdHeader = req.headers['x-user-id'] as string | undefined;
    if (!userIdHeader) {
      return res.status(401).json({ message: 'Missing X-User-Id header.' });
    }

    // Get the stylist's auth record to find their admin
    const { data: userData, error: userError } = await (supabaseAdmin.auth as any).admin.getUserById(userIdHeader);
    if (userError || !userData?.user) {
      return res.status(401).json({ message: 'Could not resolve user.' });
    }

    const userMeta = userData.user.user_metadata || {};
    const stylistSquareId = userMeta.stylist_id;
    let adminUserId = userMeta.admin_user_id;

    // Fallback: resolve admin from square_team_members
    if (!adminUserId && stylistSquareId) {
      const { data: tmRow } = await supabaseAdmin
        .from('square_team_members')
        .select('supabase_user_id')
        .eq('square_team_member_id', stylistSquareId)
        .maybeSingle();
      adminUserId = tmRow?.supabase_user_id;
    }

    if (!adminUserId) {
      return res.status(404).json({
        message: 'Could not determine your admin. Contact your salon admin.',
        debug: { stylistSquareId, userMeta },
      });
    }

    console.log(`[STYLIST-DATA] Stylist ${userIdHeader} → Admin ${adminUserId}`);

    // Fetch services that the admin synced
    const { data: services, error: svcErr } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('supabase_user_id', adminUserId);

    if (svcErr) {
      console.error('[STYLIST-DATA] Services query error:', svcErr);
    }

    // Fetch clients that the admin synced
    const { data: clients, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('supabase_user_id', adminUserId);

    if (clientErr) {
      console.error('[STYLIST-DATA] Clients query error:', clientErr);
    }

    // Fetch team members under the admin
    const { data: team, error: teamErr } = await supabaseAdmin
      .from('square_team_members')
      .select('*')
      .eq('supabase_user_id', adminUserId);

    if (teamErr) {
      console.error('[STYLIST-DATA] Team query error:', teamErr);
    }

    console.log(`[STYLIST-DATA] Results: ${services?.length || 0} services, ${clients?.length || 0} clients, ${team?.length || 0} team members`);

    return res.status(200).json({
      adminUserId,
      services: services || [],
      clients: clients || [],
      team: team || [],
    });
  } catch (e: any) {
    console.error('[STYLIST-DATA] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
}
