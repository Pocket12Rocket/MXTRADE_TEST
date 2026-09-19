import { adminDb } from '../../../../lib/firebaseAdmin';
import { requireAdminFromRequest } from '../../../../lib/adminAuth';
import { dispatchEmail, buildStatusChangeEmail } from '../../../../lib/emails';
import { rateLimit } from '../../../../lib/apiRateLimit';
import { UserFacingError } from '../../../../lib/userMessage';

// Sends the support status-change email without writing to Firestore — used when the
// order status write already happened elsewhere (e.g. client-side refund processing).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST is supported' });
  }

  if (!rateLimit(req, res, { name: 'admin-order-notify', limit: 60, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  try {
    await requireAdminFromRequest(req);
  } catch (err) {
    console.error('[admin/orders/notify-status] auth failed', err?.code || err?.message || err);
    const message = err instanceof UserFacingError ? err.message : 'Not authorized.';
    return res.status(403).json({ error: message });
  }

  const orderId = String(req.body?.orderId || '').trim();
  const previousStatus = String(req.body?.previousStatus || '').trim();
  const newStatus = String(req.body?.newStatus || '').trim();
  if (!orderId || !newStatus) {
    return res.status(400).json({ error: 'orderId and newStatus are required.' });
  }

  try {
    const orderSnap = await adminDb.collection('orders').doc(orderId).get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = { id: orderId, ...orderSnap.data() };
    await dispatchEmail(buildStatusChangeEmail({ order, previousStatus, newStatus }));
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Admin Orders] Failed to send status notification:', error);
    return res.status(500).json({ error: 'Failed to send notification email.' });
  }
}
