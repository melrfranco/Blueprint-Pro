import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateRawToken, hashToken } from './token-utils';
import { log } from '../lib/logger';

/**
 * POST /api/invitations/resend
 *
 * Regenerates the activation token and extends expiry for a pending invitation.
 * Also re-resolves provider_customer_id in case the client was linked
 * to a Square customer after the original invitation was sent.
 *
 * AUTHORIZATION:
 * - Caller must be authenticated with a valid Supabase JWT.
 * - Caller must have an active salon_memberships record for the invitation's salon.
 * - The invitation's salon_id must match the caller's verified membership.
 *
 * TOKEN SECURITY:
 * - New token is stored as SHA-256 hash. Raw token only returned in the link.
 */

const CLIENT_APP_URL = process.env.BLUEPRINT_CLIENT_URL || 'https://blueprint-client.vercel.app';

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

  // ── Step 3: Load the existing invitation ──
  const { data: invitation, error: findError } = await supabaseAdmin
    .from('client_invitations')
    .select('id, salon_id, plan_id, invite_email, invite_name, invite_phone, status, provider_customer_id')
    .eq('id', invitation_id)
    .maybeSingle();

  if (findError || !invitation) {
    return res.status(404).json({ message: 'Invitation not found' });
  }

  if (invitation.status !== 'pending') {
    return res.status(400).json({ code: 'INVALID_STATUS', message: `Cannot resend invitation with status '${invitation.status}'. Only pending invitations can be resent.` });
  }

  // ── Step 4: Verify the invitation belongs to the caller's salon ──
  if (invitation.salon_id !== callerSalonId) {
    log('INVITE_RESEND_SALON_MISMATCH', { callerSalonId, invitationSalonId: invitation.salon_id });
    return res.status(403).json({ code: 'SALON_MISMATCH', message: 'This invitation does not belong to your salon' });
  }

  // ── Step 5: Re-resolve provider_customer_id ──
  let providerCustomerId = invitation.provider_customer_id;

  if (invitation.plan_id) {
    const { data: plan } = await supabaseAdmin
      .from('plans')
      .select('client_id')
      .eq('id', invitation.plan_id)
      .maybeSingle();

    if (plan?.client_id) {
      const { data: clientRow } = await supabaseAdmin
        .from('clients')
        .select('external_id')
        .eq('id', plan.client_id)
        .maybeSingle();

      if (clientRow?.external_id) {
        providerCustomerId = clientRow.external_id;
      }
    }
  }

  // ── Step 6: Generate new hashed token and extend expiry ──
  const rawToken = generateRawToken();
  const hashedToken = hashToken(rawToken);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('client_invitations')
    .update({
      activation_token: hashedToken,
      activation_expires_at: newExpiresAt,
      provider_customer_id: providerCustomerId,
    })
    .eq('id', invitation.id);

  if (updateError) {
    log('INVITE_RESEND_FAILED', { invitationId: invitation.id, error: updateError.message });
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to regenerate invitation' });
  }

  log('INVITE_RESENT', { invitationId: invitation.id, salonId: callerSalonId, bookingEligible: !!providerCustomerId });

  // Raw token only returned here — never stored
  const activationLink = `${CLIENT_APP_URL}/activate?token=${rawToken}`;

  return res.status(200).json({
    code: 'INVITATION_RESENT',
    id: invitation.id,
    activation_link: activationLink,
    provider_customer_id: providerCustomerId,
    booking_eligible: !!providerCustomerId,
    message: providerCustomerId
      ? 'Invitation resent with new link. The client will be able to book appointments after activation.'
      : 'Invitation resent, but booking will remain unavailable until provider linkage is completed.',
  });
}
