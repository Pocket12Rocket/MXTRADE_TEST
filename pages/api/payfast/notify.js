import { adminDb } from '../../../lib/firebaseAdmin';
import admin from '../../../lib/firebaseAdmin';
import qs from 'querystring';

// PayFast sends the ITN as application/x-www-form-urlencoded — disable Next.js body parsing
export const config = { api: { bodyParser: false } };

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Parse raw urlencoded body manually
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk.toString(); });
    req.on('end', () => {
      const parsed = qs.parse(raw);
      const params = Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
      );
      resolve({ raw, params });
    });
    req.on('error', reject);
  });
}

// Validate the ITN came from PayFast by re-requesting their validation endpoint
async function validateItn(rawPayload, isSandbox) {
  const validationUrl = isSandbox
    ? 'https://sandbox.payfast.co.za/eng/query/validate'
    : 'https://www.payfast.co.za/eng/query/validate';

  const response = await fetch(validationUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // Send original raw payload exactly as received from Payfast.
    body: rawPayload,
  });

  const text = await response.text();
  return text.trim().toUpperCase() === 'VALID';
}

async function sendAdminEmail({ order, products, sellerMap }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || 'Fast Sports <onboarding@resend.dev>';
  const adminEmailsCsv = process.env.CONTACT_ADMIN_EMAILS || process.env.ADMIN_NOTIFICATION_EMAILS || '';
  const singleAdmin = process.env.CONTACT_ADMIN_EMAIL || '';
  const parsed = adminEmailsCsv.split(',').map((e) => e.trim()).filter(Boolean);
  const toEmails = parsed.length ? parsed : singleAdmin ? [singleAdmin] : [];

  if (!resendApiKey || !toEmails.length) return; // Silently skip — do not block the ITN

  const shipping = order.shippingAddress || {};
  const shippingLine = [
    shipping.streetAddress,
    shipping.suburb,
    shipping.city,
    shipping.province,
    shipping.postalCode,
  ].filter(Boolean).join(', ');

  const itemRows = (order.items || []).map((item) => {
    const seller = sellerMap[item.sellerId] || {};
    return `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 8px">${escapeHtml(item.name)}</td>
        <td style="padding:10px 8px">R${Number(item.price).toFixed(2)}</td>
        <td style="padding:10px 8px">${Number(item.quantity)}</td>
        <td style="padding:10px 8px">R${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
        <td style="padding:10px 8px">${escapeHtml(seller.displayName || seller.email || item.sellerId || '—')}</td>
      </tr>`;
  }).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:680px;margin:0 auto;color:#1e293b">
      <h2 style="color:#00CED1;margin-bottom:4px">New Order — Payment Confirmed</h2>
      <p style="color:#64748b;font-size:13px">Order ID: <code>${escapeHtml(order.id)}</code></p>

      <h3 style="margin-top:24px">Buyer details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 8px;color:#64748b;width:140px">Name</td><td style="padding:6px 8px">${escapeHtml(`${shipping.firstName || ''} ${shipping.lastName || ''}`.trim() || '—')}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b">Email</td><td style="padding:6px 8px">${escapeHtml(order.buyerEmail || '—')}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b">Phone</td><td style="padding:6px 8px">${escapeHtml(shipping.phone || '—')}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b">Shipping</td><td style="padding:6px 8px">${escapeHtml(shippingLine || '—')}</td></tr>
      </table>

      <h3 style="margin-top:24px">Items ordered</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f1f5f9;text-align:left">
            <th style="padding:8px">Product</th>
            <th style="padding:8px">Price</th>
            <th style="padding:8px">Qty</th>
            <th style="padding:8px">Subtotal</th>
            <th style="padding:8px">Seller</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <p style="margin-top:16px;font-size:16px;font-weight:600">
        Total paid: R${Number(order.totalAmount).toFixed(2)}
      </p>

      <p style="margin-top:24px;font-size:12px;color:#94a3b8">
        This email was sent automatically by the Fast Sports platform.
      </p>
    </div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmails,
      subject: `New Order Confirmed — R${Number(order.totalAmount).toFixed(2)} (${escapeHtml(order.id)})`,
      html,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  let itnData;
  let rawPayload;
  try {
    const parsed = await parseBody(req);
    rawPayload = parsed.raw;
    itnData = parsed.params;
  } catch {
    return res.status(400).send('Bad Request');
  }

  const isSandbox = process.env.PAYFAST_SANDBOX === 'true';

  // In sandbox, default to skipping validation unless explicitly forced on.
  const forceSandboxValidation = process.env.PAYFAST_FORCE_SANDBOX_VALIDATION === 'true';
  const skipValidation = process.env.PAYFAST_SKIP_VALIDATION === 'true' || (isSandbox && !forceSandboxValidation);
  if (!skipValidation) {
    try {
      const isValid = await validateItn(rawPayload, isSandbox);
      if (!isValid) {
        console.error('[PayFast ITN] Validation failed — ignoring request');
        return res.status(200).send('OK'); // Always 200 to PayFast
      }
    } catch (err) {
      console.error('[PayFast ITN] Validation error:', err.message);
      return res.status(200).send('OK');
    }
  }

  const paymentStatus = (itnData.payment_status || '').toUpperCase();
  const orderId = itnData.custom_str1; // We'll pass orderId as custom_str1 when building the payment form
  console.log(`[PayFast ITN] Received payment_status=${paymentStatus} orderId=${orderId || 'N/A'} sandbox=${isSandbox}`);

  if (paymentStatus !== 'COMPLETE') {
    console.log(`[PayFast ITN] Non-complete status "${paymentStatus}" for order ${orderId} — ignoring`);
    return res.status(200).send('OK');
  }

  if (!orderId) {
    console.error('[PayFast ITN] No orderId (custom_str1) in ITN payload');
    return res.status(200).send('OK');
  }

  try {
    const orderRef = adminDb.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      console.error(`[PayFast ITN] Order ${orderId} not found`);
      return res.status(200).send('OK');
    }

    const order = { id: orderId, ...orderSnap.data() };

    // Idempotency — skip if already processed
    if (order.status === 'paid') {
      return res.status(200).send('OK');
    }

    const batch = adminDb.batch();

    // 1. Mark order as paid
    batch.update(orderRef, {
      status: 'paid',
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      payfastPaymentId: itnData.pf_payment_id || '',
      payfastData: {
        paymentStatus: itnData.payment_status,
        amountGross: itnData.amount_gross,
        amountFee: itnData.amount_fee,
        amountNet: itnData.amount_net,
      },
    });

    // 2. Mark each product as sold (removes from store, stays visible as sold)
    const sellerIds = new Set();
    for (const item of order.items || []) {
      if (item.productId) {
        const productRef = adminDb.collection('products').doc(item.productId);
        batch.update(productRef, {
          marketSold: true,
          soldAt: admin.firestore.FieldValue.serverTimestamp(),
          soldOrderId: orderId,
        });
        if (item.sellerId) sellerIds.add(item.sellerId);
      }
    }

    await batch.commit();

    // 3. Fetch seller display info for the email (best-effort)
    const sellerMap = {};
    await Promise.allSettled(
      Array.from(sellerIds).map(async (sellerId) => {
        const snap = await adminDb.collection('users').doc(sellerId).get();
        if (snap.exists) sellerMap[sellerId] = snap.data();
      })
    );

    // 4. Send admin notification email
    await sendAdminEmail({ order, products: order.items || [], sellerMap });

    console.log(`[PayFast ITN] Order ${orderId} marked as paid successfully`);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('[PayFast ITN] Processing error:', err.message);
    // Still return 200 — PayFast will retry on non-200 responses
    return res.status(200).send('OK');
  }
}
