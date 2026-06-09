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

  // Build Payfast payload with deterministic field order.
  const pfData = {
    merchant_id,
    merchant_key,
    amount: Number(amount).toFixed(2),
    item_name: item_name || 'Order',
    item_description: item_description || '',
    email_address,
    return_url: return_url || `${siteUrl}/profile/orders`,
    cancel_url: cancel_url || `${siteUrl}/profile/orders`,
    notify_url: notify_url || `${siteUrl}/api/payfast/notify`,
    custom_str1: custom_str1 || '',
  };

  // Payfast uses urlencode semantics where spaces are encoded as +.
  const encodeForPayfast = (value) => encodeURIComponent(String(value).trim()).replace(/%20/g, '+');

  // Build signature string from the exact payload being submitted (excluding signature).
  let pfString = Object.entries(pfData)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeForPayfast(v)}`)
    .join('&');
  if (passphrase) pfString += `&passphrase=${encodeForPayfast(passphrase)}`;

  // Calculate signature (MD5)
  const crypto = require('crypto');
  const signature = crypto.createHash('md5').update(pfString).digest('hex');

  // Build redirect URL from the same field set used for signing.
  const payfastUrl = process.env.PAYFAST_SANDBOX === 'true'
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process';
  const redirectUrl = `${payfastUrl}?${Object.entries({ ...pfData, signature })
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeForPayfast(v)}`)
    .join('&')}`;

  // Keep logs server-side for troubleshooting; do not return sensitive values to the browser.
  console.log('Payfast payload string (without passphrase):', pfString.replace(/&passphrase=.*$/, '&passphrase=***'));
  console.log('Payfast signature:', signature);
  console.log('Payfast redirectUrl:', redirectUrl);

  return res.status(200).json({
    success: true,
    redirectUrl,
  });
}
