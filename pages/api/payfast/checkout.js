import qs from 'querystring';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST is supported' });
  }

  // Required Payfast credentials from env
  const merchant_id = process.env.PAYFAST_MERCHANT_ID;
  const merchant_key = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  if (!merchant_id || !merchant_key) {
    return res.status(500).json({ error: 'Payfast credentials not configured.' });
  }

  const { amount, item_name, item_description, email_address, return_url, cancel_url, notify_url, custom_str1 } = req.body;

  // Build Payfast payload (only include fields Payfast expects)
  // Only include Payfast-documented fields (no merchant_key, no passphrase)
  // Data for signature (no merchant_key)
  const pfData = {
    merchant_id,
    amount: Number(amount).toFixed(2),
    item_name: item_name || 'Order',
    item_description: item_description || '',
    email_address,
    return_url: return_url || `${siteUrl}/profile/orders`,
    cancel_url: cancel_url || `${siteUrl}/profile/orders`,
    notify_url: notify_url || `${siteUrl}/api/payfast/notify`,
    custom_str1: custom_str1 || '',
  };

  // Data for redirect (include merchant_key as required by this Payfast account)
  const pfDataWithKey = {
    ...pfData,
    merchant_key,
  };

  // Build signature string (Payfast: key=value&key2=value2... with encodeURIComponent, no + for spaces)
  let pfString = Object.entries(pfData)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  if (passphrase) pfString += `&passphrase=${encodeURIComponent(passphrase)}`;

  // Calculate signature (MD5)
  const crypto = require('crypto');
  const signature = crypto.createHash('md5').update(pfString).digest('hex');

  // Build redirect URL (use encodeURIComponent for values, not +)
  const payfastUrl = process.env.PAYFAST_SANDBOX === 'true'
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process';
  const redirectUrl = `${payfastUrl}?${Object.entries({ ...pfDataWithKey, signature })
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')}`;

  // Log signature string and signature to the server console for debugging
  console.log('Payfast pfString:', pfString);
  console.log('Payfast signature:', signature);
  // Log the full redirect URL for debugging
  console.log('Payfast redirectUrl:', redirectUrl);
  return res.status(200).json({
    success: true,
    redirectUrl,
    pfString, // The string used to generate the signature
    signature, // The generated signature
  });
}
