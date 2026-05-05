import { resolveUserId, resolveSquareAccessToken } from '../_lib/auth-helpers';

const env = (process.env.VITE_SQUARE_ENV || 'production').toLowerCase();
const squareBase = env === 'sandbox'
  ? 'https://connect.squareupsandbox.com'
  : 'https://connect.squareup.com';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const squareAccessToken = await resolveSquareAccessToken(userId);
    if (!squareAccessToken) {
      return res.status(401).json({ message: 'Square access token not available' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const squareResp = await fetch(`${squareBase}/v2/bookings/availability/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${squareAccessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2025-10-16',
      },
      body: JSON.stringify(body),
    });

    const data = await squareResp.json();
    return res.status(squareResp.status).json(data);
  } catch (e: any) {
    console.error('[BOOKINGS:AVAILABILITY] Error:', e);
    return res.status(500).json({ message: e?.message || 'Booking availability search failed' });
  }
}
