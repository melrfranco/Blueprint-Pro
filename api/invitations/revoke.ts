import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { log } from '../lib/logger';

/**
 * POST /api/invitations/revoke
 *
 * Revokes a pending invitation. The activation link will no longer work.
 * Only pending invitations can be revoked.
 *
 * AUTHORIZATION:
 * - Caller must be authenticated with a valid Supabase JWT.
 * - Caller must have an active salon_memberships record for the invitation's salon.
 * - The invitation's salon_id must match the caller's verified membership.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  // ── Step 1: Authenticate caller via verified JWT ──
  const authHeader = req.headers['authorization'] as string | undefined;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing authorization header' });
  }

  const bearer = authHeader.slice(7);

  const supabaseAnon = createClient(supabaseUrl, anonKey);
  const { data: userData, error: authError } = await supabaseAnon.auth.getUser(bearer);
  if (authError || !userData?.user) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  const callerUserId = userData.user.id;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { invitation_id } = req.body;

  if (!invitation_id) {
    return res.status(400).json({ message: 'Missing required field: invitation_id' });
  }

  // ── Step 2: Resolve caller's salon_id from verified membership ──
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('salon_memberships')
    .select('salon_id, role, status')
    .eq('user_id', callerUserId)
    .in('role', ['admin', 'stylist', 'owner'])
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError || !membership) {
    return res.status(403).json({ message: 'No active salon membership found for this account' });
  }

  const callerSalonId = membership.salon_id;

  // ── Step 3: Load the invitation ──
  const { data: invitation, error: findError } = await supabaseAdmin
    .from('client_invitations')
    .select('id, salon_id, status')
    .eq('id', invitation_id)
    .maybeSingle();

  if (findError || !invitation) {
    return res.status(404).json({ message: 'Invitation not found' });
  }

  if (invitation.status !== 'pending') {
    return res.status(400).json({
      code: 'INVALID_STATUS',
      message: `Cannot revoke invitation with status '${invitation.status}'. Only pending invitations can be revoked.`,
    });
  }

  // ── Step 4: Verify the invitation belongs to the caller's salon ──
  if (invitation.salon_id !== callerSalonId) {
    log('INVITE_REVOKE_SALON_MISMATCH', { callerSalonId, invitationSalonId: invitation.salon_id });
    return res.status(403).json({ code: 'SALON_MISMATCH', message: 'This invitation does not belong to your salon' });
  }

  // ── Step 5: Revoke ──
  const { error: updateError } = await supabaseAdmin
    .from('client_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitation.id);

  if (updateError) {
    log('INVITE_REVOKE_FAILED', { invitationId: invitation.id, error: updateError.message });
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to revoke invitation' });
  }

  log('INVITE_REVOKED', { invitationId: invitation.id, salonId: callerSalonId });

  return res.status(200).json({
    code: 'INVITATION_REVOKED',
    id: invitation.id,
    status: 'revoked',
    message: 'Invitation revoked. The activation link is no longer valid.',
  });
}
