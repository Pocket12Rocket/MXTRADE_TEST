import { rateLimit } from '../../../lib/apiRateLimit';

export default function handler(req, res) {
  if (!rateLimit(req, res, { name: 'admin-approve', limit: 30, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({ message: 'Approve submission placeholder. Add Firestore update + product creation logic.' });
}
