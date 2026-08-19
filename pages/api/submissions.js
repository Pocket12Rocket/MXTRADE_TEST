import { rateLimit } from '../../lib/apiRateLimit';

export default function handler(req, res) {
  if (!rateLimit(req, res, { name: 'submissions', limit: 30, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  if (req.method === 'POST') {
    return res.status(201).json({ message: 'Submission endpoint placeholder. Implement Firestore write logic here.' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ submissions: [], message: 'List pending submissions from Firestore.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
