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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = undefined; }
    }

    const pin = body?.pin?.trim();
    const email = body?.email?.trim();
    const password = body?.password?.trim();

    if (!pin || !email || !password) {
      return res.status(400).json({ message: 'PIN, email, and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ message: 'Server configuration error.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Find the team member with this PIN
    const { data: members, error: fetchError } = await supabaseAdmin
      .from('square_team_members')
      .select('*')
      .not('raw', 'is', null);

    if (fetchError) {
      return res.status(500).json({ message: 'Failed to look up PIN.' });
    }

    // Search through members for matching PIN
    const match = (members || []).find((m: any) => m.raw?.join_pin === pin);

    if (!match) {
      return res.status(400).json({ message: 'Invalid PIN. Please check with your admin.' });
    }

    // Check if PIN is expired (24 hours)
    const pinCreatedAt = match.raw?.pin_created_at;
    if (pinCreatedAt) {
      const age = Date.now() - new Date(pinCreatedAt).getTime();
      if (age > 24 * 60 * 60 * 1000) {
        return res.status(400).json({ message: 'This PIN has expired. Ask your admin to generate a new one.' });
      }
    }

    const stylistName = match.name || 'Stylist';
    const stylistId = match.square_team_member_id;
    const merchantId = match.merchant_id;
    const levelId = match.raw?.level_id || 'lvl_1';

    // Create the Supabase auth user with stylist role
    const { data: signUpData, error: signUpError } = await (supabaseAdmin.auth as any).admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'stylist',
        stylist_id: stylistId,
        stylist_name: stylistName,
        level_id: levelId,
        permissions: DEFAULT_PERMISSIONS,
      },
    });

    if (signUpError) {
      // If user already exists, try to update their password instead
      if (signUpError.message?.includes('already') || signUpError.message?.includes('exists')) {
        // Look up existing user by email
        const { data: existingUsers } = await (supabaseAdmin.auth as any).admin.listUsers();
        const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
        
        if (existingUser) {
          const { error: updateErr } = await (supabaseAdmin.auth as any).admin.updateUserById(existingUser.id, {
            password,
            user_metadata: {
              role: 'stylist',
              stylist_id: stylistId,
              stylist_name: stylistName,
              level_id: levelId,
              permissions: DEFAULT_PERMISSIONS,
            },
          });
          if (updateErr) {
            return res.status(400).json({ message: updateErr.message });
          }
        } else {
          return res.status(400).json({ message: signUpError.message });
        }
      } else {
        return res.status(400).json({ message: signUpError.message });
      }
    }

    // Update the square_team_members row: link supabase user, clear PIN
    const updatedRaw = { ...match.raw };
    delete updatedRaw.join_pin;
    delete updatedRaw.pin_created_at;
    updatedRaw.joined_at = new Date().toISOString();

    await supabaseAdmin
      .from('square_team_members')
      .update({
        email,
        raw: updatedRaw,
        updated_at: new Date().toISOString(),
      })
      .eq('square_team_member_id', stylistId);

    // Sign the user in to get a session
    const { data: signInData, error: signInError } = await (supabaseAdmin.auth as any).signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // User was created but sign-in failed — they can log in manually
      return res.status(200).json({
        message: 'Account created! You can now log in with your email and password.',
        needsManualLogin: true,
        stylistName,
      });
    }

    return res.status(200).json({
      message: 'Welcome to Blueprint Pro!',
      session: signInData.session,
      stylistName,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to join.' });
  }
}
