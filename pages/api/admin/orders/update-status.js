import { adminDb } from '../../../../lib/firebaseAdmin';
import admin from '../../../../lib/firebaseAdmin';
import { requireAdminFromRequest } from '../../../../lib/adminAuth';
import { dispatchEmail, buildStatusChangeEmail } from '../../../../lib/emails';
import { rateLimit } from '../../../../lib/apiRateLimit';
import { UserFacingError } from '../../../../lib/userMessage';

const ALLOWED_STATUSES = ['paid', 'shipped', 'delivered'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST is supported' });
  }

  if (!rateLimit(req, res, { name: 'admin-order-status', limit: 60, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  try {
    await requireAdminFromRequest(req);
  } catch (err) {
    // Why: only forward the deliberate UserFacingError sentences from requireAdminFromRequest —
    // never a raw Firebase Admin SDK token-verification error (ARCH-14).
    console.error('[admin/orders/update-status] auth failed', err?.code || err?.message || err);
    const message = err instanceof UserFacingError ? err.message : 'Not authorized.';
    return res.status(403).json({ error: message });
  }

  const orderId = String(req.body?.orderId || '').trim();
  const newStatus = String(req.body?.newStatus || '').trim();
  if (!orderId || !ALLOWED_STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: 'A valid orderId and newStatus are required.' });
  }

  try {
    const orderRef = adminDb.collection('orders').doc(orderId);
    const previousStatus = await adminDb.runTransaction(async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) {
        throw new UserFacingError('Order not found.');
      }

      const order = orderSnap.data();
      const prevStatus = order.status;
      if (!ALLOWED_STATUSES.includes(String(prevStatus))) {
        throw new UserFacingError(`Order cannot be moved from its current status (${prevStatus}).`);
      }

      const updates = {
        status: newStatus,
        statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (newStatus === 'shipped' && !order.shippedAt) {
        updates.shippedAt = admin.firestore.FieldValue.serverTimestamp();
      }
      if (newStatus === 'delivered' && !order.deliveredAt) {
        updates.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
      }

      transaction.update(orderRef, updates);
      return prevStatus;
    });

    if (previousStatus !== newStatus) {
      const orderSnap = await orderRef.get();
      const order = { id: orderId, ...orderSnap.data() };
      await dispatchEmail(buildStatusChangeEmail({ order, previousStatus, newStatus }));
    }

    return res.status(200).json({ success: true, status: newStatus });
  } catch (error) {
    console.error('[admin/orders/update-status] failed', error?.code || error?.message || error);
    const message = error instanceof UserFacingError
      ? error.message
      : 'Failed to update order status. Please try again.';
    return res.status(400).json({ error: message });
  }
}
