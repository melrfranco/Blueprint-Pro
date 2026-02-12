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

    const pin = body?.pin?.trim();
    if (!pin || pin.length !== 4) {
      return res.status(400).json({ message: 'A valid 4-digit PIN is required.' });
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

    const match = (members || []).find((m: any) => m.raw?.join_pin === pin);

    if (!match) {
      const existingPins = (members || []).map((m: any) => ({
        id: m.square_team_member_id,
        pin: m.raw?.join_pin || null,
      }));
      return res.status(400).json({
        message: 'Invalid PIN. Please check with your admin.',
        debug: { searchedPin: pin, rowCount: (members || []).length, existingPins },
      });
    }

    // Check if PIN is expired (24 hours)
    const pinCreatedAt = match.raw?.pin_created_at;
    if (pinCreatedAt) {
      const age = Date.now() - new Date(pinCreatedAt).getTime();
      if (age > 24 * 60 * 60 * 1000) {
        return res.status(400).json({ message: 'This PIN has expired. Ask your admin to generate a new one.' });
      }
    }

    return res.status(200).json({
      name: match.name || '',
      email: match.email || '',
      squareTeamMemberId: match.square_team_member_id,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to verify PIN.' });
  }
}
