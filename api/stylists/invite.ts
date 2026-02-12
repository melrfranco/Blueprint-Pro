import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_PERMISSIONS = {
  canBookAppointments: true,
  canOfferDiscounts: false,
  requiresDiscountApproval: true,
  viewGlobalReports: false,
  viewClientContact: true,
  viewAllSalonPlans: false,
  can_book_own_schedule: true,
  can_book_peer_schedules: false,
};

const APP_URL = 'https://v0-blueprint-pro-lemon.vercel.app';

function buildInviteEmail(name: string, inviteLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h1 style="font-size: 22px; color: #0B3559; margin: 0 0 8px;">You're invited to Blueprint Pro</h1>
    <p style="font-size: 15px; color: #444; line-height: 1.5; margin: 0 0 24px;">
      Hi ${name}, you've been added to the team. Tap the button below to set up your password and get started.
    </p>
    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #0B3559; color: #ffffff; text-decoration: none; border-radius: 9999px; font-weight: 700; font-size: 15px;">
      Set Up My Account
    </a>
    <p style="font-size: 12px; color: #999; margin-top: 32px; line-height: 1.4;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <span style="color: #3D7A94; word-break: break-all;">${inviteLink}</span>
    </p>
  </div>
</body>
</html>`.trim();
}

async function sendEmailViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { ok: false, error: 'RESEND_API_KEY not configured on server.' };
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Blueprint Pro <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return { ok: false, error: `Email send failed: ${resp.status} ${text}` };
  }
  return { ok: true };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (!body && typeof req.json === 'function') {
      body = await req.json();
    }
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = undefined;
      }
    }

    const name = body?.name?.trim();
    const email = body?.email?.trim();
    const levelId = body?.levelId || 'lvl_1';
    const squareTeamMemberId = body?.squareTeamMemberId?.trim() || null;

    if (!name || !email) {
      return res.status(400).json({ message: 'Stylist name and email are required.' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ message: 'Supabase credentials not configured on server.' });
    }

    const authHeader = req.headers['authorization'];
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!bearerToken) {
      return res.status(401).json({ message: 'Missing auth token.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await (supabaseAdmin.auth as any).getUser(bearerToken);
    if (authError || !authData?.user) {
      return res.status(401).json({ message: 'Invalid user session.' });
    }

    const adminRole = authData.user.user_metadata?.role || 'admin';
    if (adminRole !== 'admin') {
      return res.status(403).json({ message: 'Only admins can invite stylists.' });
    }

    const stylistId = squareTeamMemberId || randomUUID();

    const appUrl = process.env.VITE_STYLIST_APP_URL || APP_URL;

    const userData = {
      role: 'stylist',
      stylist_id: stylistId,
      stylist_name: name,
      level_id: levelId,
      permissions: DEFAULT_PERMISSIONS,
    };

    // Generate the invite link (does NOT send Supabase's default email)
    let actionLink: string | null = null;

    const inviteResult = await (supabaseAdmin.auth as any).admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: userData,
        redirectTo: appUrl,
      },
    });

    if (inviteResult.error) {
      // User may already exist — fall back to magic link for re-invites
      const magicResult = await (supabaseAdmin.auth as any).admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: appUrl },
      });
      if (magicResult.error) {
        return res.status(400).json({ message: inviteResult.error.message });
      }
      actionLink = magicResult.data?.properties?.action_link || null;
    } else {
      actionLink = inviteResult.data?.properties?.action_link || null;
    }

    // Rewrite the action link to go through our app instead of Supabase's default confirm page
    // actionLink looks like: https://<supabase-url>/auth/v1/verify?token=...&type=invite&redirect_to=...
    // We extract the token_hash and build our own URL
    let inviteLink = actionLink;
    if (actionLink) {
      try {
        const parsed = new URL(actionLink);
        const token = parsed.searchParams.get('token');
        const type = parsed.searchParams.get('type') || 'invite';
        if (token) {
          inviteLink = `${appUrl}/auth/confirm?token_hash=${token}&type=${type}`;
        }
      } catch {
        // If URL parsing fails, use the raw action link
      }
    }

    // Send our own branded email via Resend
    if (inviteLink) {
      const emailResult = await sendEmailViaResend(
        email,
        `You're invited to Blueprint Pro`,
        buildInviteEmail(name, inviteLink),
      );
      if (!emailResult.ok) {
        console.error('[Invite] Email send failed:', emailResult.error);
        // Don't fail the whole invite — the link is still available as backup
      }
    }

    const { data: merchantSettings } = await supabaseAdmin
      .from('merchant_settings')
      .select('id')
      .eq('supabase_user_id', authData.user.id)
      .maybeSingle();

    const stylistRow = {
      supabase_user_id: authData.user.id,
      merchant_id: merchantSettings?.id ?? null,
      square_team_member_id: stylistId,
      name,
      email,
      role: 'Stylist',
      status: 'active',
      raw: { source: 'invite', level_id: levelId, permissions: DEFAULT_PERMISSIONS },
      updated_at: new Date().toISOString(),
    };

    const { error: stylistError } = await supabaseAdmin
      .from('square_team_members')
      .upsert([stylistRow], { onConflict: 'square_team_member_id' });

    if (stylistError) {
      return res.status(500).json({ message: stylistError.message });
    }

    return res.status(200).json({
      stylist: {
        id: stylistId,
        name,
        role: 'Stylist',
        email,
        levelId,
        permissions: DEFAULT_PERMISSIONS,
      },
      inviteLink,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to send invite.' });
  }
}
