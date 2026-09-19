import { adminDb } from '../../../lib/firebaseAdmin';
import admin from '../../../lib/firebaseAdmin';
import { rateLimit } from '../../../lib/apiRateLimit';
import { bumpCatalogVersion } from '../../../lib/server/catalogVersion';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST is supported' });
  }

  if (!rateLimit(req, res, { name: 'order-cancel', limit: 10, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const orderId = String(req.body?.orderId || '').trim();
  const cancellationToken = String(req.body?.cancelToken || '').trim();
  if (!orderId || !cancellationToken) {
    return res.status(400).json({ error: 'An order ID and cancellation token are required.' });
  }

  try {
    const orderRef = adminDb.collection('orders').doc(orderId);
    await adminDb.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) {
        return;
      }

      const order = orderSnapshot.data() || {};
      if (order.cancellationToken !== cancellationToken || order.status !== 'pending_payment' || order.inventoryReserved !== true) {
        return;
      }

      const productRefs = (order.items || [])
        .filter((item) => item.productId)
        .map((item) => adminDb.collection('products').doc(item.productId));
      const productSnapshots = await Promise.all(productRefs.map((productRef) => transaction.get(productRef)));

      let productDataChanged = false;
      productSnapshots.forEach((productSnapshot) => {
        if (!productSnapshot.exists) {
          return;
        }

        const product = productSnapshot.data() || {};
        const reservations = product.inventoryReservations && typeof product.inventoryReservations === 'object'
          ? { ...product.inventoryReservations }
          : {};
        const reservation = reservations[orderId];
        if (!reservation) {
          return;
        }

        delete reservations[orderId];
        const quantity = Number(product.quantity || 0) + Number(reservation.quantity || 0);
        transaction.update(productSnapshot.ref, {
          quantity,
          marketSold: false,
          status: 'listed',
          inventoryReservations: reservations,
          statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        productDataChanged = true;
      });

      // Why: only bump the public catalog version when a reservation was actually released back
      // onto a product's stock — a no-op cancel attempt (stale token, already-cancelled order)
      // must not churn PERF-00's cache-invalidation counter for nothing.
      if (productDataChanged) {
        bumpCatalogVersion(['products'], { transaction });
      }

      transaction.update(orderRef, {
        status: 'payment_cancelled',
        inventoryReserved: false,
        paymentCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Orders API] Cancel order failed:', error);
    return res.status(500).json({ error: 'Could not release the order reservation.' });
  }
}