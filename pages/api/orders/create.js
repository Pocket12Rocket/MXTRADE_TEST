import { adminDb } from '../../../lib/firebaseAdmin';
import admin from '../../../lib/firebaseAdmin';
import { rateLimit } from '../../../lib/apiRateLimit';

function getBearerToken(req) {
  const authorization = String(req.headers.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST is supported' });
  }

  if (!rateLimit(req, res, { name: 'order-create', limit: 10, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  try {
    const { buyerEmail, items, shippingAddress } = req.body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cannot create an order with no items.' });
    }

    if (!buyerEmail) {
      return res.status(400).json({ error: 'An email address is required to place an order.' });
    }

    const requestedItems = items.map((item) => ({
      productId: String(item?.id || item?.productId || '').trim(),
      quantity: Number(item?.quantity),
    }));
    if (requestedItems.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return res.status(400).json({ error: 'Each order item needs a valid product ID and quantity.' });
    }

    const duplicateProductIds = new Set();
    if (requestedItems.some((item) => duplicateProductIds.has(item.productId) || !duplicateProductIds.add(item.productId))) {
      return res.status(400).json({ error: 'Each product may only appear once in an order.' });
    }

    const token = getBearerToken(req);
    let authenticatedBuyer = null;
    if (token) {
      authenticatedBuyer = await admin.auth().verifyIdToken(token);
    }

    const orderRef = adminDb.collection('orders').doc();
    const reservationExpiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 60 * 1000);

    await adminDb.runTransaction(async (transaction) => {
      const productRefs = requestedItems.map((item) => adminDb.collection('products').doc(item.productId));
      const productSnapshots = await Promise.all(productRefs.map((productRef) => transaction.get(productRef)));
      const sanitizedItems = [];
      const sellerIds = new Set();

      productSnapshots.forEach((productSnapshot, index) => {
        if (!productSnapshot.exists) {
          throw new Error('One or more products are no longer available.');
        }

        const product = productSnapshot.data();
        const requestedItem = requestedItems[index];
        const reservations = product.inventoryReservations && typeof product.inventoryReservations === 'object'
          ? { ...product.inventoryReservations }
          : {};
        let availableQuantity = Number(product.quantity || 1);

        Object.entries(reservations).forEach(([reservedOrderId, reservation]) => {
          const expiresAt = reservation?.expiresAt;
          const expirationTime = typeof expiresAt?.toMillis === 'function'
            ? expiresAt.toMillis()
            : Number(expiresAt?.seconds || 0) * 1000;
          if (expirationTime && expirationTime <= Date.now()) {
            availableQuantity += Number(reservation?.quantity || 0);
            delete reservations[reservedOrderId];
          }
        });

        const productStatus = String(product.status || 'listed').toLowerCase();
        const availableStatus = productStatus === 'reserved' && availableQuantity > 0 ? 'listed' : productStatus;
        if ((product.marketSold === true && availableStatus !== 'listed') || !['listed', 'active'].includes(availableStatus)) {
          throw new Error('One or more products are no longer available.');
        }

        if (!Number.isInteger(availableQuantity) || availableQuantity < requestedItem.quantity) {
          throw new Error(`Insufficient stock for ${product.name || 'a product'}.`);
        }

        const remainingQuantity = availableQuantity - requestedItem.quantity;
        transaction.update(productSnapshot.ref, {
          quantity: remainingQuantity,
          marketSold: false,
          status: availableStatus,
          inventoryReservations: {
            ...reservations,
            [orderRef.id]: { quantity: requestedItem.quantity, expiresAt: reservationExpiresAt },
          },
          statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        sanitizedItems.push({
          productId: productSnapshot.id,
          name: product.name || 'Untitled product',
          price: Number(product.price || 0),
          quantity: requestedItem.quantity,
          primaryImage: product.primaryImage || null,
          sellerId: product.sellerId || '',
          sellerEmail: product.sellerEmail || '',
        });
        if (product.sellerId || product.sellerEmail) {
          sellerIds.add(product.sellerId || product.sellerEmail);
        }
      });

      const deliveryFee = sellerIds.size * 150;
      const itemTotal = sanitizedItems.reduce((total, item) => total + item.price * item.quantity, 0);
      transaction.set(orderRef, {
        buyerId: authenticatedBuyer?.uid || null,
        buyerEmail: String(authenticatedBuyer?.email || buyerEmail).trim().toLowerCase(),
        items: sanitizedItems,
        totalAmount: itemTotal + deliveryFee,
        deliveryFee,
        shippingSellerCount: sellerIds.size,
        shippingAddress: shippingAddress || {},
        status: 'pending_payment',
        inventoryReserved: true,
        reservationExpiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return res.status(200).json({ success: true, orderId: orderRef.id });
  } catch (error) {
    console.error('[Orders API] Create order failed:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
