import { adminDb } from '../../../lib/firebaseAdmin';
import admin from '../../../lib/firebaseAdmin';
import qs from 'querystring';
import { dispatchEmail, buildAdminNewOrderEmail, buildBuyerReceiptEmail, buildSellerNewOrderEmail } from '../../../lib/emails';
import { bumpCatalogVersion } from '../../../lib/server/catalogVersion';

// PayFast sends the ITN as application/x-www-form-urlencoded — disable Next.js body parsing
export const config = { api: { bodyParser: false } };

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

async function releaseInventoryReservation(orderId, paymentStatus) {
  const orderRef = adminDb.collection('orders').doc(orderId);

  await adminDb.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      return;
    }

    const order = orderSnap.data();
      console.log(`[PayFast ITN] releaseInventoryReservation called for order ${orderId} with status ${paymentStatus}. Order status: ${order.status}, inventoryReserved: ${order.inventoryReserved}`);
    if (order.status !== 'pending_payment' || order.inventoryReserved !== true) {
        console.log(`[PayFast ITN] Skipping release: order status check failed`);
      return;
    }

    console.log(`[PayFast ITN] Proceeding with inventory release for ${(order.items || []).length} items`);
    const productRefs = (order.items || [])
      .filter((item) => item.productId)
      .map((item) => adminDb.collection('products').doc(item.productId));
    const productSnapshots = await Promise.all(productRefs.map((productRef) => transaction.get(productRef)));

    let productDataChanged = false;
    productSnapshots.forEach((productSnap, idx) => {
      if (!productSnap.exists) {
        return;
      }

      const product = productSnap.data() || {};
      const reservations = product.inventoryReservations && typeof product.inventoryReservations === 'object'
        ? { ...product.inventoryReservations }
        : {};
      const reservation = reservations[orderId];
      if (!reservation) {
        return;
      }

      delete reservations[orderId];
      console.log(`[PayFast ITN] Releasing inventory for product ${productSnap.id}: quantity before=${Number(product.quantity || 0)}, adding back reservation=${Number(reservation.quantity || 0)}, new quantity=${Number(product.quantity || 0) + Number(reservation.quantity || 0)}`);
      transaction.update(productSnap.ref, {
        quantity: Number(product.quantity || 0) + Number(reservation.quantity || 0),
        marketSold: false,
        status: 'listed',
        inventoryReservations: reservations,
        statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      productDataChanged = true;
    });

    // Why: failed/cancelled ITNs release stock back onto the public product doc — bump the
    // catalog version so clients caching product data (PERF-00) know to refetch; skip it when
    // nothing actually changed (stale/duplicate ITN for an order already past pending_payment).
    if (productDataChanged) {
      bumpCatalogVersion(['products'], { transaction });
    }

    transaction.update(orderRef, {
      status: 'payment_failed',
      inventoryReserved: false,
      paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      payfastPaymentStatus: paymentStatus,
    });
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
  console.log(`[PayFast ITN] Full ITN data:`, JSON.stringify({
    payment_status: itnData.payment_status,
    custom_str1: itnData.custom_str1,
    amount_gross: itnData.amount_gross,
    pf_payment_id: itnData.pf_payment_id,
    m_payment_id: itnData.m_payment_id,
  }, null, 2));

  if (!orderId) {
    console.error('[PayFast ITN] No orderId (custom_str1) in ITN payload');
    return res.status(200).send('OK');
  }

  if (paymentStatus !== 'COMPLETE') {
    if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED') {
      try {
        await releaseInventoryReservation(orderId, paymentStatus);
      } catch (err) {
        console.error('[PayFast ITN] Failed to release inventory reservation:', err.message);
        return res.status(500).send('Unable to release inventory reservation');
      }
    }

    console.log(`[PayFast ITN] Non-complete status "${paymentStatus}" for order ${orderId} — ignoring`);
    return res.status(200).send('OK');
  }

  
  // Only proceed with finalization if status is COMPLETE
  try {
    console.log(`[PayFast ITN] Processing COMPLETE payment for order ${orderId}`);
    const orderRef = adminDb.collection('orders').doc(orderId);
    const fulfillment = await adminDb.runTransaction(async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error(`Order ${orderId} not found`);
      }

      const order = { id: orderId, ...orderSnap.data() };
      console.log(`[PayFast ITN] Order current status: ${order.status}, inventoryReserved: ${order.inventoryReserved}`);
      
      if (order.status === 'paid') {
        console.log(`[PayFast ITN] Order ${orderId} already processed as paid — returning idempotently`);
        return { alreadyProcessed: true, order };
      }

      if (order.status !== 'pending_payment' || order.inventoryReserved !== true) {
        throw new Error(`Order ${orderId} is not awaiting payment (current status: ${order.status}, inventoryReserved: ${order.inventoryReserved})`);
      }

      const expectedCents = Math.round(Number(order.totalAmount || 0) * 100);
      const receivedCents = Math.round(Number(itnData.amount_gross || 0) * 100);
      if (!expectedCents || expectedCents !== receivedCents) {
        throw new Error(`Payment amount mismatch for order ${orderId}`);
      }

      const productRefs = (order.items || [])
        .filter((item) => item.productId)
        .map((item) => adminDb.collection('products').doc(item.productId));
      const productSnapshots = await Promise.all(productRefs.map((productRef) => transaction.get(productRef)));

      productSnapshots.forEach((productSnap, index) => {
        if (!productSnap.exists) {
          throw new Error(`Product ${productRefs[index].id} no longer exists.`);
        }

        const product = productSnap.data() || {};
        const reservations = product.inventoryReservations && typeof product.inventoryReservations === 'object'
          ? { ...product.inventoryReservations }
          : {};
        const reservation = reservations[orderId];
        if (!reservation) {
          throw new Error(`Inventory reservation is missing for order ${orderId}.`);
        }

        delete reservations[orderId];
        const remainingQuantity = Number(product.quantity || 0);
        console.log(`[PayFast ITN] Finalizing product ${productSnap.id}: quantity=${remainingQuantity}, reservation was ${reservation.quantity}, keeping quantity unchanged`);
        transaction.update(productSnap.ref, {
          inventoryReservations: reservations,
          marketSold: remainingQuantity === 0,
          status: remainingQuantity === 0 ? 'purchased' : 'listed',
          soldAt: remainingQuantity === 0 ? admin.firestore.FieldValue.serverTimestamp() : product.soldAt || null,
          soldOrderId: remainingQuantity === 0 ? orderId : product.soldOrderId || null,
          statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Why: reaching this point means every product in the order was just updated (quantity
      // finalized, possibly marketSold/status flipped to 'purchased') — always bump the catalog
      // version here (this whole block is skipped by the `alreadyProcessed` early-return above
      // for a duplicate/idempotent ITN, so it can't double-bump for the same payment).
      bumpCatalogVersion(['products'], { transaction });

      transaction.update(orderRef, {
        status: 'paid',
        inventoryReserved: false,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        payfastPaymentId: itnData.pf_payment_id || '',
        payfastData: {
          paymentStatus: itnData.payment_status,
          amountGross: itnData.amount_gross,
          amountFee: itnData.amount_fee,
          amountNet: itnData.amount_net,
        },
      });

      return { alreadyProcessed: false, order };
    });

    if (fulfillment.alreadyProcessed) {
      return res.status(200).send('OK');
    }

    const order = fulfillment.order;
    const sellerIds = new Set();
    for (const item of order.items || []) {
      if (item.sellerId) sellerIds.add(item.sellerId);
    }

    // 3. Fetch seller display info for the email (best-effort), falling back to Firebase Auth
    // if the Firestore user doc is missing an email field.
    const sellerMap = {};
    await Promise.allSettled(
      Array.from(sellerIds).map(async (sellerId) => {
        const snap = await adminDb.collection('users').doc(sellerId).get();
        sellerMap[sellerId] = snap.exists ? snap.data() : {};
        if (!sellerMap[sellerId].email) {
          try {
            const authUser = await admin.auth().getUser(sellerId);
            if (authUser.email) {
              sellerMap[sellerId].email = authUser.email;
            }
          } catch (err) {
            console.warn(`[PayFast ITN] Could not resolve auth email for seller ${sellerId}:`, err.message);
          }
        }
      })
    );

    // 4. Send admin/support notification email + buyer receipt email
    await Promise.allSettled([
      dispatchEmail(buildAdminNewOrderEmail({ order, sellerMap })),
      dispatchEmail(buildBuyerReceiptEmail({ order, itnData })),
    ]);

    // 4b. Notify each seller of the item(s) they just sold
    const itemsBySeller = new Map();
    for (const item of order.items || []) {
      const sellerKey = item.sellerId || item.sellerEmail;
      if (!sellerKey) {
        console.warn(`[PayFast ITN] Order ${orderId}: item "${item.name}" has no sellerId/sellerEmail — skipping seller notification`);
        continue;
      }
      const current = itemsBySeller.get(sellerKey) || [];
      current.push(item);
      itemsBySeller.set(sellerKey, current);
    }
    await Promise.allSettled(
      Array.from(itemsBySeller.entries()).map(([sellerKey, sellerItems]) => {
        const seller = sellerMap[sellerKey] || {};
        const sellerEmail = sellerItems[0]?.sellerEmail || seller.email || '';
        console.log(`[PayFast ITN] Order ${orderId}: resolved seller ${sellerKey} email="${sellerEmail || '(none)'}"`);
        if (!sellerEmail) {
          console.warn(`[PayFast ITN] Order ${orderId}: no email found for seller ${sellerKey} — seller notification skipped`);
          return Promise.resolve();
        }
        return dispatchEmail(buildSellerNewOrderEmail({ order, sellerEmail, sellerItems }));
      })
    );

    // 5. Create admin in-app notification for the dashboard
    await adminDb.collection('adminNotifications').add({
      type: 'sale',
      title: 'New paid order',
      message: `Order ${orderId} was paid successfully.`,
      orderId,
      buyerEmail: order.buyerEmail || '',
      totalAmount: Number(order.totalAmount || 0),
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[PayFast ITN] Order ${orderId} marked as paid successfully`);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('[PayFast ITN] Processing error:', err.message);
    const permanentFailure = /not found|amount mismatch|not awaiting payment|reservation is missing/i.test(err.message || '');
    if (permanentFailure) {
      return res.status(200).send('OK');
    }

    return res.status(500).send('Unable to process payment notification');
  }
}
