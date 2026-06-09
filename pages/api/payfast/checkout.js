export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST is supported' });
  }

  try {
    const crypto = require('crypto');

    // Required Payfast credentials from env
    const merchant_id = (process.env.PAYFAST_MERCHANT_ID || '').trim();
    const merchant_key = (process.env.PAYFAST_MERCHANT_KEY || '').trim();
    const passphrase = (process.env.PAYFAST_PASSPHRASE || '').trim();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (!merchant_id || !merchant_key) {
      console.error('[Payfast] Missing credentials — check PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY in .env.local');
      return res.status(500).json({ error: 'Payfast credentials not configured.' });
    }

    const { amount, item_name, item_description, email_address, return_url, cancel_url, notify_url, custom_str1 } = req.body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || isNaN(parsedAmount)) {
      return res.status(400).json({ error: `Invalid amount: ${amount}` });
    }

    // Build Payfast payload.
    const pfData = {
      merchant_id,
      merchant_key,
      amount: parsedAmount.toFixed(2),
      item_name: item_name || 'Order',
      item_description: item_description || '',
      email_address,
      return_url: return_url || `${siteUrl}/profile/orders`,
      cancel_url: cancel_url || `${siteUrl}/profile/orders`,
      notify_url: notify_url || `${siteUrl}/api/payfast/notify`,
      custom_str1: custom_str1 || '',
    };

    // Payfast signature uses PHP urlencode semantics where spaces become '+'.
    const encodeForPayfast = (value) => encodeURIComponent(String(value)).replace(/%20/g, '+');

    // Build payload in Payfast's expected field order.
    const payfastKeyOrder = [
      'merchant_id',
      'merchant_key',
      'return_url',
      'cancel_url',
      'notify_url',
      'name_first',
      'name_last',
      'email_address',
      'cell_number',
      'm_payment_id',
      'amount',
      'item_name',
      'item_description',
      'custom_int1',
      'custom_int2',
      'custom_int3',
      'custom_int4',
      'custom_int5',
      'custom_str1',
      'custom_str2',
      'custom_str3',
      'custom_str4',
      'custom_str5',
      'email_confirmation',
      'confirmation_address',
      'payment_method',
    ];

    const nonEmptyKeys = Object.keys(pfData).filter(
      (k) => pfData[k] !== undefined && pfData[k] !== null && String(pfData[k]) !== ''
    );
    const orderedKeys = [
      ...payfastKeyOrder.filter((k) => nonEmptyKeys.includes(k)),
      ...nonEmptyKeys.filter((k) => !payfastKeyOrder.includes(k)),
    ];

    const payloadString = orderedKeys
      .map((k) => `${k}=${encodeForPayfast(pfData[k])}`)
      .join('&');

    // Append passphrase only for signature generation.
    const pfString = passphrase
      ? `${payloadString}&passphrase=${encodeForPayfast(passphrase)}`
      : payloadString;

    const signature = crypto.createHash('md5').update(pfString).digest('hex');

    const payfastUrl = process.env.PAYFAST_SANDBOX === 'true'
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';

    const redirectUrl = `${payfastUrl}?${payloadString}&signature=${signature}`;

    console.log('[Payfast] Payload string:', pfString.replace(/&passphrase=.*$/, '&passphrase=***'));
    console.log('[Payfast] Signature:', signature);
    console.log('[Payfast] Redirect URL:', redirectUrl);

    return res.status(200).json({ success: true, redirectUrl });
  } catch (err) {
    console.error('[Payfast] Checkout error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
