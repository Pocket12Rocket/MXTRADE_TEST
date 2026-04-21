export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST is supported' });
  }

  // Build the PayFast request payload here.
  // Use server-side secrets for merchant_id, merchant_key, and passphrase.
  return res.status(200).json({
    success: true,
    message: 'PayFast checkout placeholder. Implement gateway signing and redirect URL generation.',
    payload: req.body,
  });
}
