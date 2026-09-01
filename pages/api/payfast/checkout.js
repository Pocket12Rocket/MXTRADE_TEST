import { rateLimit } from '../../../lib/apiRateLimit';
import { adminDb } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST is supported' });
  }

  if (!rateLimit(req, res, { name: 'payfast-checkout', limit: 10, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  try {
    const crypto = require('crypto');

    // Required Payfast credentials from env
    const merchant_id = (process.env.PAYFAST_MERCHANT_ID || '').trim();
    const merchant_key = (process.env.PAYFAST_MERCHANT_KEY || '').trim();
    const passphrase = (process.env.PAYFAST_PASSPHRASE || '').trim();
    const configuredSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
    const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
    const forwardedHost = (req.headers['x-forwarded-host'] || '').toString().split(',')[0].trim();
    const host = (req.headers.host || '').toString().trim();

    // Prefer explicit env var, otherwise derive from incoming host in hosted environments.
    const siteUrl = configuredSiteUrl
      || (forwardedHost ? `${forwardedProto || 'https'}://${forwardedHost}` : '')
      || (host ? `${forwardedProto || 'http'}://${host}` : '')
      || 'http://localhost:3000';

    if (!merchant_id || !merchant_key) {
      console.error('[Payfast] Missing credentials — check PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY in .env.local');
      return res.status(500).json({ error: 'Payfast credentials not configured.' });
    }

    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'An order ID is required.' });
    }

    const orderSnapshot = await adminDb.collection('orders').doc(orderId).get();
    if (!orderSnapshot.exists) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderSnapshot.data();
    if (order.status !== 'pending_payment' || order.inventoryReserved !== true) {
      return res.status(409).json({ error: 'This order is not available for payment.' });
    }

    const reservationExpiry = order.reservationExpiresAt;
    const reservationExpiresAt = typeof reservationExpiry?.toMillis === 'function'
      ? reservationExpiry.toMillis()
      : Number(reservationExpiry?.seconds || 0) * 1000;
    if (reservationExpiresAt && reservationExpiresAt <= Date.now()) {
      return res.status(409).json({ error: 'This order reservation has expired. Please create a new order.' });
    }

    const parsedAmount = Number(order.totalAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Order total is invalid.' });
    }

    // Build Payfast payload.
    const pfData = {
      merchant_id,
      merchant_key,
      amount: parsedAmount.toFixed(2),
      item_name: `Order #${orderId}`,
      item_description: (order.items || []).map((item) => item.name).join(', '),
      email_address: order.buyerEmail || '',
      return_url: order.buyerId ? `${siteUrl}/profile/orders` : `${siteUrl}/order/confirmation?orderId=${orderId}`,
      cancel_url: order.buyerId ? `${siteUrl}/profile/orders` : `${siteUrl}/order/confirmation?orderId=${orderId}`,
      notify_url: `${siteUrl}/api/payfast/notify`,
      custom_str1: orderId,
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
