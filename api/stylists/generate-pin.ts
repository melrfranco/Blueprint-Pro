import { createClient } from '@supabase/supabase-js';

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

    const squareTeamMemberId = body?.squareTeamMemberId?.trim();
    const name = body?.name?.trim() || '';
    const email = body?.email?.trim() || '';
    if (!squareTeamMemberId) {
      return res.status(400).json({ message: 'squareTeamMemberId is required.' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ message: 'Supabase credentials not configured on server.' });
    }

    const authHeader = req.headers['authorization'];
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7) : null;
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
      return res.status(403).json({ message: 'Only admins can generate PINs.' });
    }

    // Generate a 4-digit PIN
    const pin = String(Math.floor(1000 + Math.random() * 9000));

    // Store the PIN in the square_team_members row's raw column
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('square_team_members')
      .select('*')
      .eq('square_team_member_id', squareTeamMemberId)
      .maybeSingle();

    const currentRaw = existing?.raw || {};
    const updatedRaw = {
      ...currentRaw,
      join_pin: pin,
      pin_created_at: new Date().toISOString(),
    };

    if (existing) {
      // Row exists — update it (also ensure name/email are set)
      const updateFields: any = { raw: updatedRaw, updated_at: new Date().toISOString() };
      if (name) updateFields.name = name;
      if (email) updateFields.email = email;
      const { error: updateError } = await supabaseAdmin
        .from('square_team_members')
        .update(updateFields)
        .eq('square_team_member_id', squareTeamMemberId);

      if (updateError) {
        return res.status(500).json({ message: updateError.message });
      }
    } else {
      // Row doesn't exist — insert it
      const { error: insertError } = await supabaseAdmin
        .from('square_team_members')
        .insert({
          square_team_member_id: squareTeamMemberId,
          merchant_id: authData.user.user_metadata?.merchant_id || null,
          name: name || null,
          email: email || null,
          raw: updatedRaw,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        return res.status(500).json({ message: insertError.message });
      }
    }

    return res.status(200).json({ pin, debug: { rowExisted: !!existing, squareTeamMemberId } });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to generate PIN.' });
  }
}
