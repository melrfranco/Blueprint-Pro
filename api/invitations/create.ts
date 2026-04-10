import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateRawToken, hashToken } from './token-utils';
import { log } from '../lib/logger';

/**
 * POST /api/invitations/create
 *
 * Creates a client_invitations record from an approved plan/client flow.
 *
 * AUTHORIZATION:
 * - Caller must be authenticated with a valid Supabase JWT.
 * - Caller must have an active salon_memberships record (admin or stylist).
 * - The plan must belong to the caller's salon scope (verified server-side).
 * - salon_id is derived from the caller's verified membership, never from request input.
 *
 * TOKEN SECURITY:
 * - Activation tokens are stored as SHA-256 hashes. The raw token is only
 *   returned in the activation link and never stored in plaintext.
 * - When validating (in activate.ts), the incoming token is hashed and
 *   compared against the stored hash.
 *
 * Provider mapping enforcement:
 * - If the client has an external_id (Square customer ID), it is included
 *   as provider_customer_id — the client will be booking-eligible on activation.
 * - If external_id is missing, the invitation is still created but
 *   provider_customer_id is null — the client will be active but NOT booking-eligible
 *   until the admin links a provider customer. This state is explicit and visible.
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

  // ── Step 1: Authenticate caller via verified JWT (anon key client) ──
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
  const callerRole = userData.user.user_metadata?.role;

  // Only admin or stylist can create invitations
  if (callerRole !== 'admin' && callerRole !== 'stylist' && callerRole !== 'owner') {
    return res.status(403).json({ message: 'Only salon admins or stylists can create invitations' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { plan_id, invite_email, invite_name, invite_phone } = req.body;

  if (!plan_id || !invite_email || !invite_name) {
    return res.status(400).json({
      message: 'Missing required fields: plan_id, invite_email, invite_name',
    });
  }

  // ── Step 2: Resolve salon_id from caller's verified membership ──
  // salon_id comes from the authenticated user's membership record,
  // never from request body or query params — cannot be spoofed.
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

  const salonId = membership.salon_id;

  // ── Step 3: Verify the plan exists ──
  const { data: plan, error: planError } = await supabaseAdmin
    .from('plans')
    .select('id, client_id')
    .eq('id', plan_id)
    .maybeSingle();

  if (planError || !plan) {
    return res.status(404).json({ message: 'Plan not found' });
  }

  // ── Step 4: Verify the plan belongs to the caller's salon ──
  // The plan's client must have been created under this salon's admin.
  // This prevents a user from creating invitations for plans in other salons.
  const { data: salon } = await supabaseAdmin
    .from('salons')
    .select('owner_user_id')
    .eq('id', salonId)
    .maybeSingle();

  if (!salon?.owner_user_id) {
    return res.status(403).json({ message: 'Cannot verify salon ownership for authorization' });
  }

  if (plan.client_id) {
    const { data: planClient } = await supabaseAdmin
      .from('clients')
      .select('supabase_user_id')
      .eq('id', plan.client_id)
      .maybeSingle();

    // The plan's client must belong to this salon's admin
    if (!planClient || planClient.supabase_user_id !== salon.owner_user_id) {
      return res.status(403).json({ message: 'This plan does not belong to your salon' });
    }
  }

  // Stylist-specific: verify they have permission to send invites
  if (membership.role === 'stylist') {
    const { data: stylistRecord } = await supabaseAdmin
      .from('square_team_members')
      .select('permissions')
      .eq('supabase_user_id', callerUserId)
      .maybeSingle();

    const permissions = stylistRecord?.permissions;
    if (permissions && !permissions.viewClientContact) {
      return res.status(403).json({ message: 'You do not have permission to send client invitations' });
    }
  }

  // ── Step 5: Resolve provider_customer_id from the client's external_id ──
  const clientDbId = plan.client_id;
  let providerCustomerId: string | null = null;

  if (clientDbId) {
    const { data: clientRow } = await supabaseAdmin
      .from('clients')
      .select('external_id')
      .eq('id', clientDbId)
      .maybeSingle();

    if (clientRow?.external_id) {
      providerCustomerId = clientRow.external_id;
    }
  }

  // ── Step 6: Check for existing pending invitation (idempotency) ──
  // Also prevents rapid duplicate creation spam
  const { data: existingInvite } = await supabaseAdmin
    .from('client_invitations')
    .select('id, status, created_at')
    .eq('salon_id', salonId)
    .eq('invite_email', invite_email)
    .eq('status', 'pending')
    .maybeSingle();

  // Rate-limit: if an invitation was created in the last 60 seconds, reject
  if (existingInvite) {
    const createdAgo = Date.now() - new Date(existingInvite.created_at).getTime();
    if (createdAgo < 60_000) {
      log('INVITE_RATE_LIMITED', { salonId, inviteEmail: invite_email, createdAgo });
      return res.status(429).json({
        code: 'RATE_LIMITED',
        message: 'An invitation was just created for this client. Please wait before creating another.',
      });
    }
  }

  if (existingInvite) {
    // Cannot recover the raw token from the hash — must regenerate.
    // This is equivalent to a resend operation.
    log('INVITE_REGENERATE', { salonId, inviteEmail: invite_email, existingId: existingInvite.id });
    const rawToken = generateRawToken();
    const hashedToken = hashToken(rawToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('client_invitations')
      .update({
        activation_token: hashedToken,
        activation_expires_at: newExpiresAt,
        provider_customer_id: providerCustomerId,
        invited_by_user_id: callerUserId,
      })
      .eq('id', existingInvite.id);

    if (updateError) {
      console.error('[INVITATION CREATE] Update existing error:', updateError);
      return res.status(500).json({ message: 'Failed to regenerate existing invitation' });
    }

    const activationLink = `${CLIENT_APP_URL}/activate?token=${rawToken}`;
    return res.status(200).json({
      id: existingInvite.id,
      activation_link: activationLink,
      provider_customer_id: providerCustomerId,
      booking_eligible: !!providerCustomerId,
      message: providerCustomerId
        ? 'Existing pending invitation found. A new link has been generated — share this with the client.'
        : 'Existing pending invitation found, but booking will be unavailable until provider linkage is completed.',
      is_existing: true,
    });
  }

  // ── Step 7: Create the invitation record with hashed token ──
  const rawToken = generateRawToken();
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invitation, error: insertError } = await supabaseAdmin
    .from('client_invitations')
    .insert({
      salon_id: salonId,
      plan_id,
      invited_by_user_id: callerUserId,
      invite_email,
      invite_name,
      invite_phone: invite_phone || null,
      activation_token: hashedToken,
      activation_expires_at: expiresAt,
      provider_customer_id: providerCustomerId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[INVITATION CREATE] Insert error:', insertError);
    return res.status(500).json({ message: 'Failed to create invitation' });
  }

  log('INVITE_CREATED', { invitationId: invitation.id, salonId, planId: plan_id, bookingEligible: !!providerCustomerId });

  // Raw token is only returned here — never stored or logged
  const activationLink = `${CLIENT_APP_URL}/activate?token=${rawToken}`;

  return res.status(201).json({
    code: 'INVITATION_CREATED',
    id: invitation.id,
    activation_link: activationLink,
    provider_customer_id: providerCustomerId,
    booking_eligible: !!providerCustomerId,
    message: providerCustomerId
      ? 'Invitation created. Share this link with the client — they will be able to book appointments after activation.'
      : 'Invitation created, but booking will be unavailable until provider linkage is completed. Link a Square customer to this client first, then resend the invitation.',
    is_existing: false,
  });
}
