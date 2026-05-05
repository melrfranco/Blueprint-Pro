import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function resolveUserId(req: any): Promise<string | null> {
  const userIdHeader = req.headers['x-user-id'] as string | undefined;
  if (userIdHeader) return userIdHeader;

  const authHeader = req.headers['authorization'] as string | undefined;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!bearer) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await (supabaseAdmin.auth as any).getUser(bearer);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function resolveSquareAccessToken(userId: string): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdmin();

  // 1. Try caller's own merchant_settings (admin)
  const { data: ms } = await supabaseAdmin
    .from('merchant_settings')
    .select('square_access_token')
    .eq('supabase_user_id', userId)
    .maybeSingle();
  if (ms?.square_access_token) return ms.square_access_token;

  // 2. Try stylist→admin path
  const { data: userData } = await (supabaseAdmin.auth as any).admin.getUserById(userId);
  const stylistSquareId = userData?.user?.user_metadata?.stylist_id;
  const userRole = userData?.user?.user_metadata?.role;
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
    const { data: adminMs } = await supabaseAdmin
      .from('merchant_settings')
      .select('square_access_token')
      .eq('supabase_user_id', resolvedAdminId)
      .maybeSingle();
    if (adminMs?.square_access_token) return adminMs.square_access_token;
  }

  // 3. Client→admin path
  if (!resolvedAdminId && userRole === 'client') {
    const { data: clientRow } = await supabaseAdmin
      .from('clients')
      .select('salon_id')
      .eq('supabase_user_id', userId)
      .maybeSingle();

    if (clientRow?.salon_id) {
      const { data: salonOwner } = await supabaseAdmin
        .from('salons')
        .select('owner_user_id')
        .eq('id', clientRow.salon_id)
        .maybeSingle();

      if (salonOwner?.owner_user_id) {
        const { data: ownerMs } = await supabaseAdmin
          .from('merchant_settings')
          .select('square_access_token')
          .eq('supabase_user_id', salonOwner.owner_user_id)
          .maybeSingle();
        if (ownerMs?.square_access_token) return ownerMs.square_access_token;
      }
    }
  }

  // 4. Fallback to env var
  return process.env.VITE_SQUARE_ACCESS_TOKEN || null;
}
