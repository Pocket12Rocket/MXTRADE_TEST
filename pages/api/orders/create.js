import { adminDb } from '../../../lib/firebaseAdmin';
import admin from '../../../lib/firebaseAdmin';
import { rateLimit } from '../../../lib/apiRateLimit';
import crypto from 'crypto';
import { UserFacingError } from '../../../lib/userMessage';
import { getBearerToken } from '../../../lib/server/request';
import { bumpCatalogVersion } from '../../../lib/server/catalogVersion';

// Why: DOS-06 quick win — an unbounded items array or per-item quantity lets a single request
// force the order-create transaction to read/write an arbitrarily large number of product docs.
// These caps are generous for any real cart while bounding the worst case.
const MAX_ORDER_ITEMS = 20;
const MIN_ITEM_QUANTITY = 1;
const MAX_ITEM_QUANTITY = 10;

/**
 * Why: Distinguishes a "the world changed under you" situation (stock/availability shifted
 * between when the buyer loaded the page and when they checked out) from an actual server fault,
 * so the client gets a 409 Conflict it can retry/refresh on instead of a 500 that looks like a
 * bug. Only the two `UserFacingError`s thrown for stock/availability inside the transaction
 * below should map here — everything else stays a 500 with a generic message (ARCH-14).
 * @param {string} message - The `UserFacingError` message thrown by the stock/availability check.
 * @returns {boolean} True when the message describes a stock/availability conflict.
 */
function isStockConflictMessage(message) {
  return /no longer available|insufficient stock/i.test(String(message || ''));
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

    if (items.length > MAX_ORDER_ITEMS) {
      return res.status(400).json({ error: `An order can contain at most ${MAX_ORDER_ITEMS} items.` });
    }

    if (!buyerEmail) {
      return res.status(400).json({ error: 'An email address is required to place an order.' });
    }

    const requestedItems = items.map((item) => ({
      productId: String(item?.id || item?.productId || '').trim(),
      quantity: Number(item?.quantity),
    }));
    if (requestedItems.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity < MIN_ITEM_QUANTITY || item.quantity > MAX_ITEM_QUANTITY)) {
      return res.status(400).json({ error: `Each order item needs a valid product ID and a quantity between ${MIN_ITEM_QUANTITY} and ${MAX_ITEM_QUANTITY}.` });
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
    const cancellationToken = crypto.randomBytes(32).toString('hex');

    await adminDb.runTransaction(async (transaction) => {
      const productRefs = requestedItems.map((item) => adminDb.collection('products').doc(item.productId));
      const productSnapshots = await Promise.all(productRefs.map((productRef) => transaction.get(productRef)));
      const sanitizedItems = [];
      const sellerIds = new Set();

      productSnapshots.forEach((productSnapshot, index) => {
        if (!productSnapshot.exists) {
          throw new UserFacingError('One or more products are no longer available.');
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
          throw new UserFacingError('One or more products are no longer available.');
        }

        if (!Number.isInteger(availableQuantity) || availableQuantity < requestedItem.quantity) {
          throw new UserFacingError(`Insufficient stock for ${product.name || 'a product'}.`);
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

      // Why: this transaction always reaches here having updated stock/reservations on every
      // requested product (any unavailable/insufficient-stock product throws above instead), so
      // the 'products' catalog version always needs bumping when we get this far (PERF-00).
      bumpCatalogVersion(['products'], { transaction });

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
        cancellationToken,
        reservationExpiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return res.status(200).json({ success: true, orderId: orderRef.id });
  } catch (error) {
    // Why: never forward a raw Firestore/system error message to the buyer — only the specific,
    // deliberate stock/availability messages thrown above are safe to show as-is (ARCH-14). Those
    // specific messages also get 409 Conflict (the cart went stale under the buyer, not a server
    // fault) instead of 500, so the client can distinguish "retry/refresh" from "something broke".
    console.error('[orders/create] failed', error?.code || error?.message || error);
    if (error instanceof UserFacingError && isStockConflictMessage(error.message)) {
      return res.status(409).json({ error: error.message });
    }

    const message = error instanceof UserFacingError
      ? error.message
      : 'We could not create your order right now. Please try again.';
    return res.status(500).json({ error: message });
  }
}
