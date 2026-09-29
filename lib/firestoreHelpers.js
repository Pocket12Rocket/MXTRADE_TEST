// Submit a refund request for an order
import { v4 as uuidv4 } from 'uuid';

/**
 * User submits a refund request for an order
 * @param {Object} params
 * @param {string} params.orderId
 * @param {Object} params.user
 * @param {string} params.reason
 * @param {File[]} params.images
 */
export async function submitRefundRequest({ orderId, user, reason, images }) {
  if (!orderId || !user || !reason) throw new Error('Missing required fields.');
  // Upload images to storage if provided
  let imageUrls = [];
  if (images && images.length > 0) {
    imageUrls = await Promise.all(images.map(async (file) => {
      const fileName = `${orderId}/${uuidv4()}-${file.name}`;
      const storageRef = ref(storage, `refunds/${fileName}`);
      await uploadBytes(storageRef, file);
      return getDownloadURL(storageRef);
    }));
  }
  // Write refund request to subcollection
  const refundRef = doc(collection(db, 'orders', orderId, 'refundRequests'));
  await setDoc(refundRef, {
    userId: user.uid || '',
    userEmail: user.email || '',
    reason,
    imageUrls,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  // Update order status
  await updateDoc(doc(db, 'orders', orderId), {
    status: 'refund_pending',
    refundRequestedAt: serverTimestamp(),
  });
}
// Fetch all orders for a user by email (or userId if needed)
// (removed duplicate import)

/**
 * Why: Powers the buyer's "My orders" page (PERF-04). Previously fetched the buyer's entire
 * order history unbounded and discarded hidden-status orders (pending/failed/cancelled) client
 * side after paying for them; now filters `status` server-side with an `in` query against
 * VISIBLE_ORDER_STATUSES and paginates with a `startAfter` cursor instead. Firestore documents
 * are one row per order, but this function still returns one row per order *item* (unchanged
 * shape for callers) — the cursor is taken from the last order *document* in the page, not the
 * last flattened row.
 * @param {string} email - The buyer's account email address (matches `orders.buyerEmail`).
 * @param {Object} [options]
 * @param {import('firebase/firestore').QueryDocumentSnapshot} [options.cursor] - The `lastDoc`
 *   from a previous call's result, to fetch the next page. Omit for the first page.
 * @returns {Promise<{orders: Array<Object>, lastDoc: (import('firebase/firestore').QueryDocumentSnapshot|null), hasMore: boolean}>}
 *   `orders` is the flattened per-item row list (same shape as before this change); `lastDoc` is
 *   the cursor to pass back in for the next page; `hasMore` is true when a full page was
 *   returned (there may be more).
 * @throws {FirebaseError} If the underlying Firestore query fails (e.g. permission-denied,
 *   missing composite index — see firestore.indexes.json for the
 *   buyerEmail+status+createdAt index this query needs).
 * @example
 * const { orders, lastDoc, hasMore } = await fetchUserOrders(user.email);
 * if (hasMore) {
 *   const nextPage = await fetchUserOrders(user.email, { cursor: lastDoc });
 * }
 */
export async function fetchUserOrders(email, options = {}) {
  if (!email) return { orders: [], lastDoc: null, hasMore: false };

  const { cursor = null } = options;
  const constraints = [
    where('buyerEmail', '==', email),
    where('status', 'in', VISIBLE_ORDER_STATUSES),
    orderBy('createdAt', 'desc'),
    limit(ORDERS_PAGE_SIZE),
  ];
  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const ordersQuery = query(collection(db, 'orders'), ...constraints);
  const snapshot = await getDocs(ordersQuery);

  const orderRows = snapshot.docs.flatMap((docSnap) => {
    const order = docSnap.data();
    const orderId = docSnap.id;
    const displayStatus = order.status === 'paid' ? 'purchased' : (order.status || '');

    return (order.items || []).map((item) => ({
      id: orderId,
      productId: item.productId,
      productName: item.name,
      imageUrl: item.primaryImage || '',
      status: displayStatus,
      createdAt: order.createdAt,
      ...item,
    }));
  });

  return {
    orders: orderRows,
    lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    hasMore: snapshot.docs.length === ORDERS_PAGE_SIZE,
  };
}
// Fetch a single order by ID with full product details per item
export async function fetchOrderById(orderId) {
  if (!orderId) throw new Error('Missing orderId');
  const orderSnap = await getDoc(doc(db, 'orders', orderId));
  if (!orderSnap.exists()) throw new Error('Order not found');
  const order = { id: orderSnap.id, ...orderSnap.data() };

  const itemsWithProducts = await Promise.all((order.items || []).map(async (item) => {
    let product = null;
    if (item.productId) {
      try {
        const productSnap = await getDoc(doc(db, 'products', item.productId));
        if (productSnap.exists()) {
          product = { id: productSnap.id, ...productSnap.data() };
        }
      } catch {
        // Product lookup is best-effort — fall back gracefully.
      }
    }
    return { ...item, product };
  }));

  return { ...order, items: itemsWithProducts };
}

import { collection, doc, getDoc, getDocs, query, where, orderBy, updateDoc, serverTimestamp, setDoc, limit, startAfter } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

// All order.status values used anywhere in the app (see AGENTS.md domain glossary). Includes both
// 'cancelled' (legacy/generic) and 'payment_cancelled' (the value pages/api/orders/cancel.js:64
// actually writes today) — live data was found to contain 'payment_cancelled', not 'cancelled'.
export const ALL_ORDER_STATUSES = ['pending_payment', 'payment_failed', 'failed', 'cancelled', 'payment_cancelled', 'paid', 'shipped', 'delivered', 'refund_pending', 'refunded'];
/**
 * Why: Single source of truth for which order statuses are "not worth showing" to admins (sales
 * board) or buyers (My orders) — previously duplicated as separate local constants in
 * pages/admin/sales.js and lib/firestoreHelpers.js's own fetchUserOrders, which had drifted out of
 * sync (the sales.js copy was missing 'payment_cancelled', so cancelled orders leaked into the
 * admin board). Both pages now import this instead of declaring their own copy.
 */
export const HIDDEN_ORDER_STATUSES = new Set(['pending_payment', 'payment_failed', 'failed', 'cancelled', 'payment_cancelled']);
export const VISIBLE_ORDER_STATUSES = ALL_ORDER_STATUSES.filter((status) => !HIDDEN_ORDER_STATUSES.has(status));
// Page size for the admin sales board and buyer "My orders" list (PERF-04) — both paginate with
// a startAfter cursor instead of downloading full order history on every visit.
const ORDERS_PAGE_SIZE = 50;
