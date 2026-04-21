export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({ message: 'Approve submission placeholder. Add Firestore update + product creation logic.' });
}
