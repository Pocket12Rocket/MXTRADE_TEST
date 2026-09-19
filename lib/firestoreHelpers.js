/**
 * Why: Powers the home page's "New this week" category carousels. Accepts an
 * optional pre-fetched `products` array (PERF-01) so pages/index.js can fetch
 * the live-product list once and derive all four home carousels from it,
 * instead of this function re-running fetchLiveProducts() on every call.
 * @param {string} category - Category name to match, case-insensitively
 *   (e.g. 'Gear', 'Parts', 'Accessories').
 * @param {number} [resultLimit=6] - Maximum number of products to return.
 * @param {Array<Object>} [products] - Pre-fetched, normalized product list
 *   (as returned by fetchLiveProducts()). When omitted, this function calls
 *   fetchLiveProducts() itself so existing callers keep working unchanged.
 * @returns {Promise<Array<Object>>} Up to `resultLimit` normalized product
 *   records created in the last 7 days, in the order the source list was in.
 * @throws {FirebaseError} If fetchLiveProducts() has to run and its
 *   underlying Firestore reads fail (e.g. permission-denied, unavailable).
 * @example
 * const newGearThisWeek = await fetchThisWeeksNewProductsByCategory('Gear', 6);
 * // or, reusing an already-fetched list:
 * const newPartsThisWeek = await fetchThisWeeksNewProductsByCategory('Parts', 6, allProducts);
 */
export async function fetchThisWeeksNewProductsByCategory(category, resultLimit = 6, products) {
  const sourceProducts = products || (await fetchLiveProducts());
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return sourceProducts
    .filter((product) => {
      if (product.marketSold === true) return false;
      if (!product.category || product.category.toLowerCase() !== category.toLowerCase()) return false;
      const createdAtDate = resolveCreatedAtDate(product.createdAt);
      return createdAtDate ? createdAtDate >= sevenDaysAgo : false;
    })
    .slice(0, resultLimit);
}
// Fetch all orders with refund_pending status
export async function fetchRefundPendingOrders() {
  const ordersQuery = query(
    collection(db, 'orders'),
    where('status', '==', 'refund_pending'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(ordersQuery);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

// Fetch the latest refund request for an order
export async function fetchRefundRequestForOrder(orderId) {
  if (!orderId) throw new Error('Missing orderId');
  const refundQuery = query(collection(db, 'orders', orderId, 'refundRequests'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(refundQuery);
  if (snapshot.empty) throw new Error('No refund request found');
  const docSnap = snapshot.docs[0];
  return { orderId, ...docSnap.data() };
}

// Admin processes refund request (accept/deny)
export async function processRefundRequest({ orderId, action, adminResponse }) {
  if (!orderId || !action) throw new Error('Missing required fields');
  const refundQuery = query(collection(db, 'orders', orderId, 'refundRequests'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(refundQuery);
  if (snapshot.empty) throw new Error('No refund request found');
  const refundDoc = snapshot.docs[0];
  const orderRef = doc(db, 'orders', orderId);
  let previousStatus = '';
  let newStatus = '';

  await runTransaction(db, async (transaction) => {
    const [currentRefund, orderSnapshot] = await Promise.all([
      transaction.get(refundDoc.ref),
      transaction.get(orderRef),
    ]);
    if (!currentRefund.exists() || !orderSnapshot.exists()) {
      throw new UserFacingError('Refund request or order not found.');
    }
    if (currentRefund.data().status !== 'pending') {
      throw new UserFacingError('This refund request has already been processed.');
    }

    const order = orderSnapshot.data();
    previousStatus = order.status || '';
    const refundAccepted = action === 'accept';
    const orderItems = (order.items || []).filter((item) => item.productId);
    const productRefs = refundAccepted
      ? orderItems.map((item) => doc(db, 'products', item.productId))
      : [];
    const productSnapshots = await Promise.all(productRefs.map((productRef) => transaction.get(productRef)));

    if (refundAccepted) {
      productSnapshots.forEach((productSnapshot, index) => {
        if (!productSnapshot.exists()) {
          throw new UserFacingError('A product from this order could not be restocked.');
        }
        const item = orderItems[index];
        const product = productSnapshot.data();
        transaction.update(productSnapshot.ref, {
          quantity: Number(product.quantity || 0) + Number(item.quantity || 1),
          marketSold: false,
          status: 'listed',
          soldAt: null,
          soldOrderId: null,
          statusUpdatedAt: serverTimestamp(),
        });
      });
    }

    newStatus = refundAccepted ? 'refunded' : 'delivered';
    transaction.update(refundDoc.ref, {
      status: refundAccepted ? 'accepted' : 'denied',
      adminResponse: adminResponse || '',
      processedAt: serverTimestamp(),
      inventoryRestoredAt: refundAccepted ? serverTimestamp() : null,
    });
    transaction.update(orderRef, {
      status: newStatus,
      refundProcessedAt: serverTimestamp(),
    });
  });

  await notifyOrderStatusChange({ orderId, previousStatus, newStatus });
}
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

/**
 * Why: Powers the admin sales/fulfilment board (PERF-04). Previously downloaded the entire
 * `orders` history unbounded and discarded hidden-status orders (pending/failed/cancelled)
 * client-side after paying for them; now filters `status` server-side with an `in` query against
 * VISIBLE_ORDER_STATUSES and paginates with a `startAfter` cursor instead.
 * @param {Object} [options]
 * @param {import('firebase/firestore').QueryDocumentSnapshot} [options.cursor] - The `lastDoc`
 *   from a previous call's result, to fetch the next page. Omit for the first page.
 * @returns {Promise<{orders: Array<Object>, lastDoc: (import('firebase/firestore').QueryDocumentSnapshot|null), hasMore: boolean}>}
 *   `orders` is one row per order document; `lastDoc` is the cursor to pass back in for the next
 *   page; `hasMore` is true when a full page was returned (there may be more).
 * @throws {FirebaseError} If the underlying Firestore query fails (e.g. permission-denied,
 *   missing composite index — see firestore.indexes.json for the status+createdAt index this
 *   query needs).
 * @example
 * const { orders, lastDoc, hasMore } = await fetchAllOrdersForAdmin();
 * if (hasMore) {
 *   const nextPage = await fetchAllOrdersForAdmin({ cursor: lastDoc });
 * }
 */
export async function fetchAllOrdersForAdmin(options = {}) {
  const { cursor = null } = options;
  const constraints = [
    where('status', 'in', VISIBLE_ORDER_STATUSES),
    orderBy('createdAt', 'desc'),
    limit(ORDERS_PAGE_SIZE),
  ];
  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const snapshot = await getDocs(query(collection(db, 'orders'), ...constraints));
  return {
    orders: snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    hasMore: snapshot.docs.length === ORDERS_PAGE_SIZE,
  };
}

// FAQ CRUD HELPERS
/**
 * Why: Public FAQ page read (PERF-00/PERF-16). Previously re-downloaded the whole `faqs`
 * collection on every visit with no caching layer; now goes through the shared
 * `withVersionedCache` wrapper, keyed on `catalogMeta/versions.faqs` so an edit via
 * `addFaq`/`updateFaq`/`deleteFaq` invalidates it for every other tab/visitor.
 * @returns {Promise<Array<Object>>} Every FAQ document (`{id, question, answer}`), unordered.
 * @throws {FirebaseError} If the underlying Firestore read fails (e.g. permission-denied).
 * @example
 * const faqs = await fetchFaqs();
 */
export async function fetchFaqs() {
  return withVersionedCache('faqs', 'faqs', FAQ_CACHE_MAX_AGE_MS, async () => {
    const snapshot = await getDocs(collection(db, 'faqs'));
    return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
  });
}

/**
 * Why: Admin FAQ CMS write. Bumps `catalogMeta/versions.faqs` (PERF-00) after the write succeeds
 * so `fetchFaqs()`'s cache invalidates for every other tab/visitor instead of staying stale for
 * up to FAQ_CACHE_MAX_AGE_MS.
 * @param {Object} params
 * @param {string} params.question - The FAQ question text.
 * @param {string} params.answer - The FAQ answer text.
 * @returns {Promise<string>} The new FAQ document's id.
 * @throws {UserFacingError} If `question` or `answer` is empty.
 * @example
 * const id = await addFaq({ question: 'How do refunds work?', answer: '...' });
 */
export async function addFaq({ question, answer }) {
  if (!question || !answer) throw new UserFacingError('Question and answer are required.');
  const docRef = await addDoc(collection(db, 'faqs'), { question, answer });
  bumpCatalogVersionClient(['faqs']);
  return docRef.id;
}

/**
 * Why: Admin FAQ CMS write. Bumps `catalogMeta/versions.faqs` (PERF-00) after the write succeeds
 * so `fetchFaqs()`'s cache invalidates for every other tab/visitor.
 * @param {string} id - The FAQ document id to update.
 * @param {Object} params
 * @param {string} params.question - The updated question text.
 * @param {string} params.answer - The updated answer text.
 * @returns {Promise<void>}
 * @throws {UserFacingError} If `id`, `question`, or `answer` is missing.
 * @example
 * await updateFaq('abc123', { question: 'Updated?', answer: 'Yes.' });
 */
export async function updateFaq(id, { question, answer }) {
  if (!id || !question || !answer) throw new UserFacingError('Question and answer are required.');
  await updateDoc(doc(db, 'faqs', id), { question, answer });
  bumpCatalogVersionClient(['faqs']);
}

/**
 * Why: Admin FAQ CMS write. Bumps `catalogMeta/versions.faqs` (PERF-00) after the write succeeds
 * so `fetchFaqs()`'s cache invalidates for every other tab/visitor.
 * @param {string} id - The FAQ document id to delete.
 * @returns {Promise<void>}
 * @throws {Error} If `id` is missing.
 * @example
 * await deleteFaq('abc123');
 */
export async function deleteFaq(id) {
  if (!id) throw new Error('ID is required');
  await deleteDoc(doc(db, 'faqs', id));
  bumpCatalogVersionClient(['faqs']);
}

const DEFAULT_ABOUT_CONTENT = {
  aboutUsBody: [
    'Fast Sport is built for riders who want a trusted marketplace and sellers who want a fair place to list quality products.',
    'Every seller listing goes through a moderation workflow so buyers can browse with confidence while sellers keep full control over their inventory.',
  ].join('\n\n'),
  howItWorksBody: [
    'Sellers create accounts and submit listings with images, descriptions, and pricing details for review.',
    'Admins moderate each submission. Approved listings are published to the marketplace and become available in shop filters.',
    'As the platform grows, our focus remains simple: safer transactions, clearer listings, and a better experience for the riding community.',
  ].join('\n\n'),
};

/**
 * Why: Public About page read (PERF-00/PERF-16). Previously re-read `siteContent/about` on every
 * visit with no caching layer; now goes through `withVersionedCache`, keyed on
 * `catalogMeta/versions.about` so an admin edit via `updateAboutContent` invalidates it for every
 * other tab/visitor.
 * @returns {Promise<Object>} `{aboutUsBody, howItWorksBody, updatedAt, updatedBy}` — falls back
 *   to `DEFAULT_ABOUT_CONTENT` text for any field the doc doesn't have set.
 * @throws {FirebaseError} If the underlying Firestore read fails (e.g. permission-denied).
 * @example
 * const about = await fetchAboutContent();
 */
export async function fetchAboutContent() {
  return withVersionedCache('about', 'about', ABOUT_CACHE_MAX_AGE_MS, async () => {
    const aboutRef = doc(db, 'siteContent', 'about');
    const snapshot = await getDoc(aboutRef);

    if (!snapshot.exists()) {
      return { ...DEFAULT_ABOUT_CONTENT };
    }

    const data = snapshot.data() || {};
    const legacyBody = String(data.body || '').trim();
    const aboutUsBody = String(data.aboutUsBody || '').trim() || legacyBody || DEFAULT_ABOUT_CONTENT.aboutUsBody;
    const howItWorksBody = String(data.howItWorksBody || '').trim() || DEFAULT_ABOUT_CONTENT.howItWorksBody;

    return {
      aboutUsBody,
      howItWorksBody,
      updatedAt: data.updatedAt || null,
      updatedBy: String(data.updatedBy || '').trim(),
    };
  });
}

/**
 * Why: Admin About-page CMS write. Bumps `catalogMeta/versions.about` (PERF-00) after the write
 * succeeds so `fetchAboutContent()`'s cache invalidates for every other tab/visitor instead of
 * staying stale for up to ABOUT_CACHE_MAX_AGE_MS.
 * @param {Object} content - `{aboutUsBody, howItWorksBody}`, both required non-empty strings.
 * @param {string} [adminId='admin'] - The admin's uid, stored as `updatedBy`.
 * @returns {Promise<void>}
 * @throws {UserFacingError} If either body is empty after trimming.
 * @example
 * await updateAboutContent({ aboutUsBody: '...', howItWorksBody: '...' }, adminUid);
 */
export async function updateAboutContent(content, adminId = 'admin') {
  const aboutUsBody = String(content?.aboutUsBody || '').trim();
  const howItWorksBody = String(content?.howItWorksBody || '').trim();

  if (!aboutUsBody || !howItWorksBody) {
    throw new UserFacingError('About us content and How it works content are required.');
  }

  await setDoc(doc(db, 'siteContent', 'about'), {
    aboutUsBody,
    howItWorksBody,
    updatedAt: serverTimestamp(),
    updatedBy: adminId,
  }, { merge: true });
  bumpCatalogVersionClient(['about']);
}
// Update product status as admin
export async function updateProductStatusAsAdmin(productId, newStatus) {
  if (!productId || !newStatus) throw new Error('Missing productId or newStatus');
  await updateDoc(doc(db, 'products', productId), {
    status: newStatus,
    statusUpdatedAt: serverTimestamp(),
  });
}
// Fetch all sellers (users with canSell true)
export async function fetchAllSellers() {
  const usersQuery = query(collection(db, 'users'), where('canSell', '==', true));
  const snapshot = await getDocs(usersQuery);
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

// Move an order through the fulfillment pipeline (paid -> shipped -> delivered) as admin.
export async function updateOrderStatusAsAdmin(orderId, newStatus) {
  if (!orderId || !newStatus) throw new Error('Missing orderId or newStatus');
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('You must be signed in as an admin.');

  const response = await fetch('/api/admin/orders/update-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ orderId, newStatus }),
  });
  const data = await response.json().catch(() => ({}));
  // Why: the API route only ever returns a friendly message here (its own catch maps raw
  // Firebase/system errors to one) or a deliberate validation sentence, so it's safe to show
  // verbatim — mark it UserFacingError so toUserMessage() at the call site doesn't discard it.
  if (!response.ok) throw new UserFacingError(data.error || 'Failed to update order status.');
  return data;
}

// Sends a support notification email for an order status transition already written elsewhere (e.g. refunds).
export async function notifyOrderStatusChange({ orderId, previousStatus, newStatus }) {
  if (!orderId || !newStatus) return;
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) return;

  try {
    await fetch('/api/admin/orders/notify-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ orderId, previousStatus, newStatus }),
    });
  } catch {
    // Best-effort notification; failures here shouldn't block the caller's own flow.
  }
}

import { collection, addDoc, doc, getDoc, getDocs, query, where, orderBy, updateDoc, deleteDoc, serverTimestamp, setDoc, increment, runTransaction, onSnapshot, writeBatch, limit, startAfter } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { UserFacingError, reportError } from './userMessage';
import { getCached, setCached, invalidateCached } from './publicCache';
import { getCatalogVersions, invalidateCatalogVersions } from './catalogVersions';

const TERMS_VERSION = '2026-08-05';

// PERF-00 caching layer (see docs/TECH_DEBT.md "Caching layers"): how stale a cached PUBLIC read
// is allowed to be before it's refetched even if its version hasn't changed. The version check
// (withVersionedCache below) is the real invalidator — these are just a safety net in case a
// write path forgets to bump its section's version.
const PRODUCTS_CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const CATALOG_CONFIG_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FAQ_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ABOUT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// 'popular' is a TTL-only cache (no catalogMeta version tracks it) — see fetchMostClickedProducts.
const POPULAR_CACHE_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Why: Single generic cache wrapper (PERF-00) so every PUBLIC read helper below shares one
 * cache-read/compare/refetch/store implementation instead of duplicating this logic per
 * function. Only ever called with `name`s on lib/publicCache.js's allowlist, and only from
 * public (non-admin, non-price/quantity-sensitive) read paths — see AGENTS.md's staleness budget
 * and PERF-17's "never cache private data" rule.
 *
 * A cache hit is used when it's within `maxAgeMs` **and** either its stored version matches the
 * current section version, or `getCatalogVersions()` reports `isUnavailable: true` (it couldn't
 * read `catalogMeta/versions` at all — see lib/catalogVersions.js). In that second case the
 * version comparison itself is unreliable (both sides could be a meaningless `0`), so this
 * deliberately skips it and keeps serving the existing entry on `maxAgeMs` alone, rather than
 * forcing a refetch on every single read just because the version doc is temporarily unreadable.
 * On an actual cache miss, the freshly loaded value **is** stored — including while
 * `isUnavailable` is true, under version `0` — so a miss in that degraded state still leaves a
 * usable, TTL-governed cache entry behind for the next call.
 * @param {string} name - Unnamespaced public cache key (see lib/publicCache.js's allowlist).
 * @param {'products'|'catalogConfig'|'faqs'|'about'} section - Which `catalogMeta/versions`
 *   counter invalidates this cache entry.
 * @param {number} maxAgeMs - Max age a cache hit may be. The real invalidator is the version
 *   check above; this is the safety net (a write path that forgot to bump its version) *and* the
 *   sole invalidator whenever `catalogMeta/versions` can't be read (see above).
 * @param {() => Promise<*>} loader - Runs the real Firestore read on a cache miss/stale/expired
 *   entry. Its rejection propagates to the caller unchanged (never swallowed here).
 * @returns {Promise<*>} The cached value (fresh cache hit) or the freshly loaded value.
 * @throws {FirebaseError} Whatever `loader()` throws, on a cache miss.
 * Also dedupes concurrent callers: if two components (or, in dev, React StrictMode's
 * double-effect-invoke) both ask for the same `name` before the first call has finished, the
 * second reuses the first's in-flight promise instead of racing it into a second cache-miss
 * read.
 * @example
 * const products = await withVersionedCache('products', 'products', PRODUCTS_CACHE_MAX_AGE_MS, loadProducts);
 */
const inFlightCacheLoads = new Map();

async function withVersionedCache(name, section, maxAgeMs, loader) {
  if (inFlightCacheLoads.has(name)) {
    return inFlightCacheLoads.get(name);
  }

  const loadPromise = (async () => {
    const [cached, versions] = await Promise.all([getCached(name), getCatalogVersions()]);

    if (cached && Date.now() - cached.savedAt < maxAgeMs) {
      const versionIsTrustworthy = !versions.isUnavailable;
      if (!versionIsTrustworthy || cached.version === versions[section]) {
        return cached.value;
      }
    }

    const value = await loader();
    setCached(name, value, versions[section]).catch((err) => reportError('public-cache-write', err));
    return value;
  })();

  inFlightCacheLoads.set(name, loadPromise);
  try {
    return await loadPromise;
  } finally {
    inFlightCacheLoads.delete(name);
  }
}

// Why: single source of truth mapping each catalogMeta/versions section to the public cache
// entries it governs — used by bumpCatalogVersionClient (below) to know which lib/publicCache.js
// entries to evict immediately after a client-side write, instead of duplicating this list at
// every call site. 'popular' rides along with 'products' since a product write can change which
// products are even eligible to appear in the "Popular this week" list.
const SECTION_CACHE_NAMES = {
  products: ['products', 'popular'],
  catalogConfig: ['catalogConfig:gearBrands', 'catalogConfig:bikeModels', 'catalogConfig:subcategories'],
  faqs: ['faqs'],
  about: ['about'],
};

/**
 * Why: PERF-00's admin-side version bump — until admin writes move fully server-side, every
 * client write from an admin path that changes a cacheable public section must bump that
 * section's counter in `catalogMeta/versions`, or every other tab/visitor's cache would never
 * invalidate. The remote bump itself is best-effort and non-blocking (a failure here — e.g. the
 * rules for this doc aren't deployed yet — must never fail the write that already succeeded, so
 * it only logs), but the *local* cache eviction below always runs regardless of whether the
 * remote bump succeeded: the write this is bumping for has already been committed by the caller
 * either way, so this tab must stop serving what it had cached before that write even if
 * `catalogMeta/versions` itself couldn't be updated. Without this, the admin who just made the
 * change wouldn't see it reflected on their own home/catalog page (in the same tab, via
 * client-side navigation) until `maxAgeMs` expired — up to 24h for catalogConfig/faqs/about, 30
 * min for products.
 * @param {Array<'products'|'catalogConfig'|'faqs'|'about'>} sections - Section counters to bump
 *   by 1 (deduplicated; a no-op if empty).
 * @returns {Promise<void>} Resolves whether the remote bump succeeded or failed — never rejects.
 * @example
 * await bumpCatalogVersionClient(['products']);
 */
async function bumpCatalogVersionClient(sections) {
  const uniqueSections = Array.from(new Set((sections || []).filter(Boolean)));
  if (uniqueSections.length === 0) {
    return;
  }

  try {
    const updates = { updatedAt: serverTimestamp() };
    uniqueSections.forEach((section) => {
      updates[section] = increment(1);
    });
    await setDoc(doc(db, 'catalogMeta', 'versions'), updates, { merge: true });
  } catch (err) {
    reportError('catalog-version-bump', err);
  }

  invalidateCatalogVersions();
  const affectedCacheNames = uniqueSections.flatMap((section) => SECTION_CACHE_NAMES[section] || []);
  if (affectedCacheNames.length > 0) {
    invalidateCached(affectedCacheNames).catch((err) => reportError('public-cache-invalidate', err));
  }
}

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

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function sendSubmissionEmailNotification(payload) {
  try {
    const currentUser = auth.currentUser;
    const payloadToken = typeof payload?.idToken === 'string' ? payload.idToken.trim() : '';
    const currentUserToken = currentUser ? await currentUser.getIdToken() : '';
    const idToken = payloadToken || currentUserToken;
    const { idToken: _omitToken, ...notificationPayload } = payload || {};

    const response = await fetch('/api/submissions/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(notificationPayload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.warn('[Submission Notifications] Email API failed', {
        status: response.status,
        body: responseText,
        eventType: payload?.eventType,
      });
    }
  } catch (error) {
    console.warn('[Submission Notifications] Email API request failed', {
      eventType: payload?.eventType,
      message: error?.message,
    });
  }
}

export async function createUserProfile(user, role = 'customer', profileData = {}) {
  const firstName = (profileData.firstName || '').trim();
  const lastName = (profileData.lastName || '').trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const phone = (profileData.phone || '').trim();
  const countryCode = (profileData.countryCode || '+27').trim();
  const includeTermsAcceptance = Boolean(profileData.hasAcceptedTerms);

  const userDoc = doc(db, 'users', user.uid);
  await setDoc(userDoc, {
    uid: user.uid,
    email: user.email,
    role,
    createdAt: serverTimestamp(),
    displayName: fullName || user.displayName || '',
    firstName,
    lastName,
    phone,
    countryCode,
    canSell: false,
    sellerProfileComplete: false,
    ...(includeTermsAcceptance
      ? {
        termsAcceptedAt: serverTimestamp(),
        termsAcceptedVersion: TERMS_VERSION,
      }
      : {}),
  });
}

export async function acceptTermsAndConditions(user) {
  if (!user?.uid) {
    throw new Error('User must be logged in to accept terms and conditions.');
  }

  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    termsAcceptedAt: serverTimestamp(),
    termsAcceptedVersion: TERMS_VERSION,
  }, { merge: true });
}

export async function acceptSellerTermsAndConditions(user) {
  if (!user?.uid) {
    throw new Error('User must be logged in to accept seller terms and conditions.');
  }

  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, {
    sellerTermsAcceptedAt: serverTimestamp(),
    sellerTermsAcceptedVersion: '2026-07-01',
    uid: user.uid,
  }).catch(async (error) => {
    if (error?.code === 'not-found') {
      await setDoc(userRef, {
        uid: user.uid,
        sellerTermsAcceptedAt: serverTimestamp(),
        sellerTermsAcceptedVersion: '2026-07-01',
      }, { merge: true });
      return;
    }

    throw error;
  });
}

export async function submitProductRequest({ user, name, price, category, subcategory, description, specifications, quantity = 1, files, customFields = {} }) {
  try {
    const MAX_LISTING_DESCRIPTION_LENGTH = 75;
    const normalizedName = String(name || '').trim();
    const normalizedCategory = String(category || '').trim();
    const normalizedSubcategory = String(subcategory || '').trim();
    const normalizedDescription = String(description || '').trim();
    const normalizedPrice = Number(price);
    const normalizedSpecifications = String(specifications || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!normalizedName || !normalizedCategory || !normalizedSubcategory || !Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      throw new UserFacingError('Please complete all required fields before submitting.');
    }

    if (normalizedDescription.length > MAX_LISTING_DESCRIPTION_LENGTH) {
      throw new UserFacingError(`Description must be ${MAX_LISTING_DESCRIPTION_LENGTH} characters or fewer.`);
    }

    if (!files || files.length === 0) {
      throw new UserFacingError('Please upload product images before submitting for review.');
    }

    const submissionRef = doc(collection(db, 'productSubmissions'));

    const uploadPromises = Array.from(files)
      .slice(0, 5)
      .map(async (file) => {
        const storageRef = ref(storage, `sellerSubmissions/${user.uid}/${submissionRef.id}/${file.name}`);
        await withTimeout(
          uploadBytes(storageRef, file),
          120000,
          'Image upload timed out. Check your connection, file size, and Firebase Storage setup, then try again.'
        );
        return getDownloadURL(storageRef);
      });

    const imageUrls = await Promise.all(uploadPromises);

    await withTimeout(
      setDoc(submissionRef, {
        sellerId: user.uid,
        sellerEmail: user.email,
        name: normalizedName,
        price: normalizedPrice,
        category: normalizedCategory,
        subcategory: normalizedSubcategory,
        description: normalizedDescription,
        specifications: normalizedSpecifications,
        quantity: Math.max(1, Number(quantity) || 1),
        status: 'pending',
        marketSold: false,
        createdAt: serverTimestamp(),
        primaryImage: imageUrls[0] || null,
        images: imageUrls,
        ...customFields,
      }),
      30000,
      'Submission timed out while creating the product request. Please try again.'
    );

    await sendSubmissionEmailNotification({
      eventType: 'submission_created',
      submissionId: submissionRef.id,
      sellerId: user.uid,
      idToken: typeof user?.getIdToken === 'function' ? await user.getIdToken() : '',
    });

    return submissionRef.id;
  } catch (error) {
    if (error?.code === 'storage/unauthorized') {
      throw new Error('Image upload blocked by Firebase Storage Rules. Make sure you are signed in and the latest storage.rules have been deployed.');
    }

    if (error?.code === 'storage/bucket-not-found') {
      throw new Error('Firebase Storage bucket not found. Verify NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env.local and create Storage in Firebase Console.');
    }

    if (error?.code === 'storage/unknown') {
      throw new Error('Image upload failed due to a Firebase Storage error. Check Storage is enabled and your bucket configuration is correct.');
    }

    throw error;
  }
}


/**
 * Why: The shared storefront product-listing read (home carousels, shop catalog). Two owner
 * decisions folded in here: (1) PERF-02 — no more per-product `sellerPublicProfiles` read; seller
 * suburb/city/badge/trust are read straight off the product document (copied at approval time,
 * normalizeProductRecord fills in a graceful fallback for older docs). (2) `'listed'` is now the
 * only live status queried server-side — `'active'` was a legacy alias; run
 * `scripts/migrate-active-to-listed.js` to backfill any remaining `'active'` docs, since this
 * query will no longer find them.
 * PERF-00: the default (public) call is cached client-side (IndexedDB + in-memory), keyed on
 * `catalogMeta/versions.products`, with a 30-minute safety-net max age — general catalog content
 * may be minutes stale per the owner's staleness budget (AGENTS.md), while price/quantity re-
 * validate fresh on the product page (`fetchProductById`) and at checkout regardless. The
 * `includeAllStatuses` admin path is never cached (admins always need the true live state).
 * @param {Object} [options]
 * @param {boolean} [options.includeAllStatuses=false] - When true (admin dashboard use only),
 *   returns every product regardless of status/marketSold, ordered by createdAt descending. Not
 *   cached.
 * @returns {Promise<Array<Object>>} Normalized product records. When `includeAllStatuses` is
 *   false: only `status=='listed'` && `marketSold==false`, newest first.
 * @throws {FirebaseError} If the underlying Firestore query fails (e.g. permission-denied,
 *   unavailable).
 * @example
 * const liveProducts = await fetchLiveProducts();
 * const everyProduct = await fetchLiveProducts({ includeAllStatuses: true });
 */
export async function fetchLiveProducts(options = {}) {
  const { includeAllStatuses = false } = options;

  if (includeAllStatuses) {
    const productsQuery = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(productsQuery);
    return snapshot.docs.map((docItem) => normalizeProductRecord({ id: docItem.id, ...docItem.data() }));
  }

  return withVersionedCache('products', 'products', PRODUCTS_CACHE_MAX_AGE_MS, async () => {
    const listedSnapshot = await getDocs(query(
      collection(db, 'products'),
      where('status', '==', 'listed'),
      where('marketSold', '==', false)
    ));

    return listedSnapshot.docs
      .map((docItem) => normalizeProductRecord({ id: docItem.id, ...docItem.data() }))
      .sort((a, b) => {
        const aDate = resolveCreatedAtDate(a.createdAt);
        const bDate = resolveCreatedAtDate(b.createdAt);
        return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
      });
  });
}

function normalizeProductImages(productData) {
  const normalized = [];

  if (typeof productData.primaryImage === 'string' && productData.primaryImage.trim()) {
    normalized.push(productData.primaryImage.trim());
  }

  if (Array.isArray(productData.images) && productData.images.length > 0) {
    productData.images.forEach((item) => {
      if (typeof item === 'string' && item.trim()) {
        normalized.push(item.trim());
      } else if (item && typeof item === 'object') {
        const objectUrl = item.url || item.src || item.downloadURL;
        if (typeof objectUrl === 'string' && objectUrl.trim()) {
          normalized.push(objectUrl.trim());
        }
      }
    });
  }

  if (Array.isArray(productData.imageUrls) && productData.imageUrls.length > 0) {
    productData.imageUrls.forEach((url) => {
      if (typeof url === 'string' && url.trim()) {
        normalized.push(url.trim());
      }
    });
  }

  if (typeof productData.imageUrl === 'string' && productData.imageUrl.trim()) {
    normalized.push(productData.imageUrl.trim());
  }

  return Array.from(new Set(normalized));
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function parseDateLike(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === 'string') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
}

function resolveProductPricing(record, now = new Date()) {
  const basePrice = Math.max(0, toFiniteNumber(record.basePrice, toFiniteNumber(record.price, 0)));
  const specialEnabled = Boolean(record.specialEnabled);
  const specialType = ['percent', 'amount', 'fixed'].includes(record.specialType) ? record.specialType : 'percent';
  const specialValue = Math.max(0, toFiniteNumber(record.specialValue, 0));
  const specialStartDate = parseDateLike(record.specialStartAt);
  const specialEndDate = parseDateLike(record.specialEndAt);

  const withinStartWindow = !specialStartDate || now >= specialStartDate;
  const withinEndWindow = !specialEndDate || now <= specialEndDate;
  const isScheduledActive = withinStartWindow && withinEndWindow;

  let discountedPrice = basePrice;
  if (specialEnabled && isScheduledActive) {
    if (specialType === 'percent') {
      discountedPrice = basePrice * (1 - specialValue / 100);
    } else if (specialType === 'amount') {
      discountedPrice = basePrice - specialValue;
    } else if (specialType === 'fixed') {
      discountedPrice = specialValue;
    }
  }

  const normalizedDiscountedPrice = Math.max(0, Math.round(discountedPrice * 100) / 100);
  const isSpecialActive = specialEnabled && isScheduledActive && normalizedDiscountedPrice < basePrice;

  return {
    basePrice,
    currentPrice: isSpecialActive ? normalizedDiscountedPrice : basePrice,
    isSpecialActive,
    specialLabel: (record.specialLabel || '').trim(),
    specialType,
    specialValue,
    specialStartAt: record.specialStartAt || '',
    specialEndAt: record.specialEndAt || '',
  };
}

/**
 * Why: Shared shape-normalizer for every product document read from Firestore. Also the single
 * place that fills in `sellerSuburb`/`sellerCity`/`sellerBadge`/`sellerTrustScore` defaults
 * (PERF-02) — these fields are copied onto the product document at approval time
 * (`approveSubmission`), so no per-product `sellerPublicProfiles` read is needed here; this just
 * guards against older product docs written before that copy existed, per the owner decision to
 * drop the N+1 seller-profile lookup and rely on a graceful fallback for legacy docs instead.
 * @param {Object} record - Raw Firestore product data plus its `id`.
 * @returns {Object} The normalized product record with resolved images, pricing, status, and
 *   seller display fields (empty string/null when absent, never undefined).
 */
function normalizeProductRecord(record) {
  const images = normalizeProductImages(record);
  const pricing = resolveProductPricing(record);
  const rawStatus = String(record.status || '').toLowerCase();
  const normalizedStatus = rawStatus === 'paid'
    ? 'purchased'
    : (rawStatus === 'active' ? 'listed' : (record.status || (record.marketSold ? 'purchased' : 'listed')));

  return {
    ...record,
    status: normalizedStatus,
    images,
    primaryImage: images[0] || null,
    basePrice: pricing.basePrice,
    price: pricing.currentPrice,
    originalPrice: pricing.isSpecialActive ? pricing.basePrice : null,
    isSpecialActive: pricing.isSpecialActive,
    specialLabel: pricing.isSpecialActive ? (pricing.specialLabel || 'Special') : '',
    specialType: pricing.specialType,
    specialValue: pricing.specialValue,
    specialStartAt: pricing.specialStartAt,
    specialEndAt: pricing.specialEndAt,
    // Copied onto the product at approval time; fall back gracefully for older docs that predate
    // the copy (see PERF-02 — no per-product sellerPublicProfiles read happens here or anywhere
    // in the live-product/product-detail read paths any more).
    sellerSuburb: record.sellerSuburb || '',
    sellerCity: record.sellerCity || '',
    sellerBadge: record.sellerBadge || '',
    sellerTrustScore: record.sellerTrustScore ?? null,
  };
}

function resolveCreatedAtDate(createdAt) {
  if (!createdAt) {
    return null;
  }

  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate();
  }

  if (typeof createdAt.seconds === 'number') {
    return new Date(createdAt.seconds * 1000);
  }

  return null;
}

export async function updateUserProfile(user, profileData = {}) {
  const firstName = (profileData.firstName || '').trim();
  const lastName = (profileData.lastName || '').trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const phone = (profileData.phone || '').trim();
  const countryCode = (profileData.countryCode || '+27').trim();

  await updateDoc(doc(db, 'users', user.uid), {
    firstName,
    lastName,
    displayName: fullName,
    phone,
    countryCode,
  });
}

/**
 * Why: Admin pricing/special edit. Bumps `catalogMeta/versions.products` (PERF-00) after the
 * write succeeds so `fetchLiveProducts()`'s cache invalidates for every other tab/visitor —
 * price/quantity themselves stay seconds-fresh regardless via `fetchProductById` and checkout's
 * server-side re-validation, this only affects how quickly the *catalog list* view picks up a
 * new price.
 * @param {string} productId - The `products/{id}` document id to reprice.
 * @param {Object} [pricingData] - `{basePrice, specialEnabled, specialType, specialValue,
 *   specialLabel, specialStartAt, specialEndAt}`.
 * @param {string} [adminId='admin'] - The admin's uid, stored as `pricingUpdatedBy`.
 * @returns {Promise<void>}
 * @throws {UserFacingError} If `basePrice` or the special configuration is invalid.
 * @example
 * await updateProductPricingAsAdmin('prod123', { basePrice: 199.99 }, adminUid);
 */
export async function updateProductPricingAsAdmin(productId, pricingData = {}, adminId = 'admin') {
  const basePrice = toFiniteNumber(pricingData.basePrice, NaN);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    throw new UserFacingError('Base price must be greater than 0.');
  }

  const specialEnabled = Boolean(pricingData.specialEnabled);
  const specialType = ['percent', 'amount', 'fixed'].includes(pricingData.specialType) ? pricingData.specialType : 'percent';
  const specialValue = Math.max(0, toFiniteNumber(pricingData.specialValue, 0));
  const specialLabel = (pricingData.specialLabel || '').trim();
  const specialStartAt = (pricingData.specialStartAt || '').trim();
  const specialEndAt = (pricingData.specialEndAt || '').trim();

  const startDate = parseDateLike(specialStartAt);
  const endDate = parseDateLike(specialEndAt);
  if (startDate && endDate && endDate < startDate) {
    throw new UserFacingError('Special end date must be after start date.');
  }

  if (specialEnabled) {
    if (specialType === 'percent' && (specialValue <= 0 || specialValue > 100)) {
      throw new UserFacingError('Percent special must be between 0 and 100.');
    }

    if (specialType === 'amount' && specialValue <= 0) {
      throw new UserFacingError('Amount discount must be greater than 0.');
    }

    if (specialType === 'fixed' && specialValue < 0) {
      throw new UserFacingError('Fixed special price cannot be negative.');
    }
  }

  await updateDoc(doc(db, 'products', productId), {
    basePrice,
    // Keep legacy price field aligned with base price for backwards compatibility.
    price: basePrice,
    specialEnabled,
    specialType,
    specialValue: specialEnabled ? specialValue : 0,
    specialLabel,
    specialStartAt,
    specialEndAt,
    pricingUpdatedAt: serverTimestamp(),
    pricingUpdatedBy: adminId,
  });
  bumpCatalogVersionClient(['products']);
}

export async function uploadProfilePicture(user, file) {
  const storageRef = ref(storage, `profilePictures/${user.uid}`);
  await withTimeout(
    uploadBytes(storageRef, file),
    60000,
    'Profile picture upload timed out. Please try again.'
  );
  const photoURL = await getDownloadURL(storageRef);
  await updateDoc(doc(db, 'users', user.uid), { photoURL });
  return photoURL;
}

/**
 * Why: Feeds a "new this week" listing (not currently rendered by pages/index.js — see the
 * PERF-01 refactor which uses fetchThisWeeksNewProductsByCategory instead — kept for any other
 * caller that wants an un-categorized "new this week" list). Renamed its `limit` parameter to
 * `resultLimit` so it no longer shadows the `limit()` Firestore query helper imported into this
 * module for PERF-04's pagination.
 * @param {number} [resultLimit=6] - Maximum number of products to return.
 * @returns {Promise<Array<Object>>} Up to `resultLimit` normalized products created in the last
 *   7 days, most-recent first.
 * @throws {FirebaseError} If the underlying fetchLiveProducts() read fails.
 * @example
 * const newThisWeek = await fetchThisWeeksNewProducts(6);
 */
export async function fetchThisWeeksNewProducts(resultLimit = 6) {
  const products = await fetchLiveProducts();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return products
    .filter((product) => {
      if (product.marketSold === true) {
        return false;
      }

      const createdAtDate = resolveCreatedAtDate(product.createdAt);
      return createdAtDate ? createdAtDate >= sevenDaysAgo : false;
    })
    .slice(0, resultLimit);
}

/**
 * Why: Sums a `productStats/{id}.dailyClicks` map (`{'YYYY-MM-DD': n}`) over the trailing 7 days
 * (today inclusive), computed client-side at read time. The stored `clicks7d` counter on the doc
 * can be stale for a product with no clicks *today* specifically (nothing has re-summed it since
 * yesterday rolled off the window), so "Popular this week" recomputes the true sum from the raw
 * per-day map instead of trusting the counter.
 * @param {Object<string, number>} dailyClicks - Per-day click counts keyed by `YYYY-MM-DD`.
 * @returns {number} Total clicks in the trailing 7-day window (today inclusive).
 */
function sumTrailingSevenDayClicks(dailyClicks) {
  if (!dailyClicks || typeof dailyClicks !== 'object') {
    return 0;
  }

  let total = 0;
  for (let daysAgo = 0; daysAgo < 7; daysAgo += 1) {
    const day = new Date();
    day.setDate(day.getDate() - daysAgo);
    const dayKey = day.toISOString().slice(0, 10);
    total += Number(dailyClicks[dayKey]) || 0;
  }

  return total;
}

/**
 * Why: The raw `productStats` read behind fetchMostClickedProducts(), split out so it can be
 * cached independently as a TTL-only entry (PERF-00's 'popular' cache has no catalogMeta version
 * of its own — clicks change continuously, so a version counter would defeat the point; a 1-hour
 * TTL is the only invalidator). Single-field `orderBy('clicks7d', 'desc')` query — no composite
 * index needed.
 * @returns {Promise<Array<Object>>} Up to 20 `productStats` docs (`{id, productId, dailyClicks,
 *   clicks7d, lastClickAt}`), ordered by the (possibly stale) `clicks7d` counter descending.
 * @throws {FirebaseError} If the underlying Firestore query fails (e.g. permission-denied while
 *   `productStats`'s rules aren't deployed yet — callers treat this as "no stats available").
 */
async function fetchPopularProductStats() {
  const cached = await getCached('popular');
  if (cached && Date.now() - cached.savedAt < POPULAR_CACHE_MAX_AGE_MS) {
    return cached.value;
  }

  const statsSnapshot = await getDocs(query(
    collection(db, 'productStats'),
    orderBy('clicks7d', 'desc'),
    limit(20)
  ));
  const stats = statsSnapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
  // Why: version is 0 — this is a TTL-only cache, not tracked by catalogMeta/versions.
  setCached('popular', stats, 0).catch((err) => reportError('public-cache-write', err));
  return stats;
}

/**
 * Why: Powers the home page's "Popular this week" carousel. Replaces the old `clickCount`-on-
 * product-doc ranking (BUG-08/SEC-10 — anyone could write that field) with the `productStats`
 * collection (PERF-05), which only an API route can write. Ranks by a client-recomputed trailing
 * 7-day sum (see sumTrailingSevenDayClicks — the stored `clicks7d` counter can be stale), filtered
 * down to products actually present in the caller's live-product list (so a stat for a since-
 * removed/sold product can't show up), then falls back to newest-first when there's no usable
 * click data yet (e.g. `productStats` hasn't been backfilled, or is temporarily unreadable).
 * @param {number} [resultLimit=6] - Maximum number of products to return.
 * @param {Array<Object>} [products] - Pre-fetched, normalized product list (as returned by
 *   fetchLiveProducts()). When omitted, this function calls fetchLiveProducts() itself so
 *   existing callers keep working unchanged.
 * @returns {Promise<Array<Object>>} Up to `resultLimit` normalized products.
 * @throws {FirebaseError} If fetchLiveProducts() has to run and its underlying Firestore reads
 *   fail (e.g. permission-denied, unavailable). A `productStats` read failure is caught
 *   internally and treated as "no stats" rather than propagated.
 * @example
 * const popular = await fetchMostClickedProducts(6, allProducts);
 */
export async function fetchMostClickedProducts(resultLimit = 6, products) {
  const sourceProducts = products || (await fetchLiveProducts());
  const eligibleProducts = sourceProducts.filter((product) => {
    if (product.marketSold === true) {
      return false;
    }

    // Exclude seeded demo catalog items so this reflects real user listings.
    return product.sellerId && product.sellerId !== 'demo-seed';
  });

  const sortByNewest = (list) => list
    .slice()
    .sort((a, b) => {
      const aDate = resolveCreatedAtDate(a.createdAt);
      const bDate = resolveCreatedAtDate(b.createdAt);
      return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
    })
    .slice(0, resultLimit);

  let stats = [];
  try {
    stats = await fetchPopularProductStats();
  } catch (err) {
    reportError('popular-product-stats', err);
    stats = [];
  }

  if (stats.length === 0) {
    return sortByNewest(eligibleProducts);
  }

  const eligibleProductsById = new Map(eligibleProducts.map((product) => [product.id, product]));
  const ranked = stats
    .map((stat) => ({
      product: eligibleProductsById.get(stat.productId || stat.id),
      clicks7d: sumTrailingSevenDayClicks(stat.dailyClicks),
    }))
    .filter((entry) => Boolean(entry.product))
    .sort((a, b) => b.clicks7d - a.clicks7d)
    .slice(0, resultLimit)
    .map((entry) => entry.product);

  return ranked.length > 0 ? ranked : sortByNewest(eligibleProducts);
}

/**
 * Why: Admin product removal. Bumps `catalogMeta/versions.products` (PERF-00) after the delete
 * succeeds so `fetchLiveProducts()`'s cache invalidates for every other tab/visitor instead of
 * showing a removed product for up to PRODUCTS_CACHE_MAX_AGE_MS.
 * @param {string} productId - The `products/{id}` document id to delete.
 * @returns {Promise<void>}
 * @throws {FirebaseError} If the underlying delete fails (e.g. permission-denied).
 * @example
 * await removeProductAsAdmin('prod123');
 */
export async function removeProductAsAdmin(productId) {
  await deleteDoc(doc(db, 'products', productId));
  bumpCatalogVersionClient(['products']);
}


/**
 * Why: Powers the product detail page. Per the PERF-02 owner decision, no longer issues a
 * `sellerPublicProfiles` read for this product's seller — suburb/city/badge/trust are read
 * straight off the product document (copied at approval time; normalizeProductRecord fills in a
 * graceful fallback for older docs that predate the copy).
 * @param {string} productId - The `products/{id}` document id.
 * @returns {Promise<Object|null>} The normalized product record, or null if it doesn't exist.
 * @throws {FirebaseError} If the underlying Firestore read fails (e.g. permission-denied).
 * @example
 * const product = await fetchProductById('abc123');
 */
export async function fetchProductById(productId) {
  const productDoc = await getDoc(doc(db, 'products', productId));
  if (!productDoc.exists()) {
    return null;
  }
  return normalizeProductRecord({ id: productDoc.id, ...productDoc.data() });
}

export async function fetchUserProfileById(userId) {
  if (!userId) {
    return null;
  }

  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
}

export async function fetchSellerPrivateProfile(userId) {
  if (!userId) {
    return null;
  }

  const sellerDoc = await getDoc(doc(db, 'sellerPrivateProfiles', userId));
  return sellerDoc.exists() ? { id: sellerDoc.id, ...sellerDoc.data() } : null;
}

export async function fetchSellerPublicProfile(userId) {
  if (!userId) {
    return null;
  }

  const sellerDoc = await getDoc(doc(db, 'sellerPublicProfiles', userId));
  return sellerDoc.exists() ? { id: sellerDoc.id, ...sellerDoc.data() } : null;
}


/**
 * Why: Saves a seller's private (bank/ID) and public (suburb/city) profile records and flips
 * `canSell`/`sellerProfileComplete` on their user doc, so `/seller/submit` unlocks. Errors are
 * intentionally left unwrapped (no per-step "insufficient permissions while saving X" text) —
 * the caller maps any Firebase error code (e.g. `permission-denied`) to a friendly sentence via
 * the shared `toUserMessage()` helper (ARCH-14) instead of this function hand-rolling its own
 * code-to-message mapping.
 * @param {Object} user - The signed-in Firebase Auth user (needs `uid`).
 * @param {Object} [sellerData] - Raw form values; every field is trimmed to a string.
 * @returns {Promise<void>} Resolves once all four writes (private profile, public profile,
 *   user doc) have completed.
 * @throws {Error} If `user` is missing a `uid`, or if any of the underlying Firestore writes
 *   fail (e.g. permission-denied).
 * @example
 * await upsertSellerPrivateProfile(user, { idNumber: '123', bankName: 'FNB', ... });
 */
export async function upsertSellerPrivateProfile(user, sellerData = {}) {
  if (!user?.uid) {
    throw new Error('User must be logged in to update seller profile.');
  }

  const normalized = {
    idNumber: (sellerData.idNumber || '').trim(),
    streetAddress: (sellerData.streetAddress || '').trim(),
    suburb: (sellerData.suburb || '').trim(),
    city: (sellerData.city || '').trim(),
    postCode: (sellerData.postCode || '').trim(),
    bankName: (sellerData.bankName || '').trim(),
    accountType: (sellerData.accountType || '').trim(),
    branchName: (sellerData.branchName || '').trim(),
    branchCode: (sellerData.branchCode || '').trim(),
    accountNumber: (sellerData.accountNumber || '').trim(),
  };

  const privateProfileRef = doc(db, 'sellerPrivateProfiles', user.uid);
  const privateProfileSnapshot = await getDoc(privateProfileRef);

  if (privateProfileSnapshot.exists()) {
    await updateDoc(privateProfileRef, {
      ...normalized,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(privateProfileRef, {
      uid: user.uid,
      ...normalized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const publicProfileRef = doc(db, 'sellerPublicProfiles', user.uid);
  const publicProfileSnapshot = await getDoc(publicProfileRef);

  if (publicProfileSnapshot.exists()) {
    await updateDoc(publicProfileRef, {
      suburb: normalized.suburb,
      city: normalized.city,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(publicProfileRef, {
      uid: user.uid,
      suburb: normalized.suburb,
      city: normalized.city,
      updatedAt: serverTimestamp(),
    });
  }

  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    sellerProfileComplete: true,
    canSell: true,
  }, { merge: true });
}

// Helper to determine badge from trust score
export function getSellerBadgeFromScore(score) {
  if (typeof score !== 'number' || score < 5) return '';
  if (score >= 10) return 'platinum';
  if (score >= 5) return 'gold';
  return '';
}

// Update trust score and badge (call on sale/refund)
export async function updateSellerTrustScore(sellerId, delta) {
  if (!sellerId || typeof delta !== 'number') return;
  const sellerRef = doc(db, 'sellerPrivateProfiles', sellerId);
  const sellerSnap = await getDoc(sellerRef);
  let currentScore = 0;
  if (sellerSnap.exists()) {
    currentScore = sellerSnap.data().sellerTrustScore || 0;
  }
  let newScore = currentScore + delta;
  if (newScore < 0) newScore = 0;
  const badge = getSellerBadgeFromScore(newScore);
  await updateDoc(sellerRef, {
    sellerTrustScore: newScore,
    sellerBadge: badge,
  });

  await setDoc(doc(db, 'sellerPublicProfiles', sellerId), {
    uid: sellerId,
    sellerTrustScore: newScore,
    sellerBadge: badge,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return { sellerTrustScore: newScore, sellerBadge: badge };
}

export async function fetchSellerSubmissions(userId) {
  const submissionsQuery = query(
    collection(db, 'productSubmissions'),
    where('sellerId', '==', userId)
  );

  const snapshot = await getDocs(submissionsQuery);
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

export async function fetchSellerLiveProducts(userId) {
  const productsQuery = query(
    collection(db, 'products'),
    where('sellerId', '==', userId)
  );

  const snapshot = await getDocs(productsQuery);
  return snapshot.docs.map((docItem) => normalizeProductRecord({ id: docItem.id, ...docItem.data() }));
}

export async function removeSellerSubmission(submissionId) {
  await deleteDoc(doc(db, 'productSubmissions', submissionId));
}

/**
 * Why: Seller-initiated deletion of their own live listing. Bumps
 * `catalogMeta/versions.products` (PERF-00) after the delete succeeds — same reasoning as
 * `removeProductAsAdmin`, just from the seller-side delete path, so a removed listing doesn't
 * keep showing up out of other visitors' cached product lists.
 * @param {string} productId - The `products/{id}` document id to delete.
 * @returns {Promise<void>}
 * @throws {FirebaseError} If the underlying delete fails (e.g. permission-denied).
 * @example
 * await removeSellerProduct('prod123');
 */
export async function removeSellerProduct(productId) {
  await deleteDoc(doc(db, 'products', productId));
  bumpCatalogVersionClient(['products']);
}

export async function updateSellerSubmission(submissionId, updates) {
  const MAX_LISTING_DESCRIPTION_LENGTH = 75;
  const normalizedUpdates = {
    ...updates,
  };

  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'description')) {
    normalizedUpdates.description = String(normalizedUpdates.description || '').trim();
    if (normalizedUpdates.description.length > MAX_LISTING_DESCRIPTION_LENGTH) {
      throw new UserFacingError(`Description must be ${MAX_LISTING_DESCRIPTION_LENGTH} characters or fewer.`);
    }
  }

  await updateDoc(doc(db, 'productSubmissions', submissionId), {
    ...normalizedUpdates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Why: Seller-initiated edit of their own live listing (not currently called anywhere in the
 * app — see docs/TECH_DEBT.md ARCH-15; kept working and version-bumped in case/when a caller is
 * wired up, since it does write directly to the public `products` doc). Bumps
 * `catalogMeta/versions.products` (PERF-00) after the write succeeds.
 * @param {string} productId - The `products/{id}` document id to update.
 * @param {Object} updates - Fields to merge onto the product doc.
 * @returns {Promise<void>}
 * @throws {UserFacingError} If `updates.description` exceeds the listing description limit.
 * @throws {FirebaseError} If the underlying write fails (e.g. permission-denied).
 * @example
 * await updateSellerProduct('prod123', { description: 'Updated description.' });
 */
export async function updateSellerProduct(productId, updates) {
  const MAX_LISTING_DESCRIPTION_LENGTH = 75;
  const normalizedUpdates = {
    ...updates,
  };

  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'description')) {
    normalizedUpdates.description = String(normalizedUpdates.description || '').trim();
    if (normalizedUpdates.description.length > MAX_LISTING_DESCRIPTION_LENGTH) {
      throw new UserFacingError(`Description must be ${MAX_LISTING_DESCRIPTION_LENGTH} characters or fewer.`);
    }
  }

  await updateDoc(doc(db, 'products', productId), {
    ...normalizedUpdates,
    updatedAt: serverTimestamp(),
  });
  bumpCatalogVersionClient(['products']);
}

/**
 * Why: Seller edits a live listing enough that it needs re-approval — creates a new pending
 * submission and flips the existing public product doc's status to `'pending'` (pulling it out
 * of the live catalog while it's re-reviewed). Bumps `catalogMeta/versions.products` (PERF-00)
 * after that status change so it disappears from other visitors' cached product lists promptly
 * instead of after up to PRODUCTS_CACHE_MAX_AGE_MS.
 * @param {Object} params
 * @param {Object} params.product - The seller's existing live product record (needs `id`).
 * @param {Object} [params.updates] - Fields to overlay onto the new submission.
 * @returns {Promise<string>} The new `productSubmissions/{id}` document id.
 * @throws {Error} If `product.id` is missing or no user is signed in.
 * @example
 * await resubmitSellerProductForApproval({ product, updates: { description: 'New copy.' } });
 */
export async function resubmitSellerProductForApproval({ product, updates }) {
  if (!product?.id || !auth.currentUser) {
    throw new Error('Missing seller context for product resubmission.');
  }

  const submissionRef = doc(collection(db, 'productSubmissions'));
  const submissionData = {
    ...product,
    ...updates,
    sellerId: product.sellerId || auth.currentUser.uid,
    sellerEmail: product.sellerEmail || auth.currentUser.email || '',
    status: 'pending',
    marketSold: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    approvedAt: null,
    approvedBy: null,
    productId: null,
    originalProductId: product.id,
  };

  delete submissionData.id;

  await setDoc(submissionRef, submissionData);
  await updateDoc(doc(db, 'products', product.id), {
    status: 'pending',
    updatedAt: serverTimestamp(),
  });
  bumpCatalogVersionClient(['products']);

  await sendSubmissionEmailNotification({
    eventType: 'submission_created',
    submissionId: submissionRef.id,
    sellerId: submissionData.sellerId,
    idToken: typeof auth.currentUser.getIdToken === 'function' ? await auth.currentUser.getIdToken() : '',
  });

  return submissionRef.id;
}

export async function updateSellerSubmissionImages({
  userId,
  submissionId,
  existingImageUrls = [],
  retainedImageUrls = [],
  newFiles = [],
}) {
  if (!userId || !submissionId) {
    throw new Error('Missing seller context for image updates.');
  }

  const normalizedRetained = Array.from(
    new Set(
      retainedImageUrls
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter(Boolean)
    )
  );

  const uploadedUrls = await Promise.all(
    newFiles.map(async (file, index) => {
      const safeFileName = `${Date.now()}-${index}-${file.name}`;
      const storageRef = ref(storage, `sellerSubmissions/${userId}/${submissionId}/${safeFileName}`);
      await withTimeout(
        uploadBytes(storageRef, file),
        120000,
        'Image upload timed out. Check your connection and try again.'
      );
      return getDownloadURL(storageRef);
    })
  );

  const mergedUrls = [...normalizedRetained, ...uploadedUrls];

  const removedUrls = existingImageUrls.filter((url) => !normalizedRetained.includes(url));
  await Promise.all(
    removedUrls.map(async (url) => {
      try {
        await deleteObject(ref(storage, url));
      } catch {
        // Ignore cleanup failures to avoid blocking successful edit updates.
      }
    })
  );

  return {
    images: mergedUrls,
    primaryImage: mergedUrls[0] || null,
  };
}

export async function fetchPendingSubmissions() {
  const pendingQuery = query(
    collection(db, 'productSubmissions'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(pendingQuery);
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

export async function fetchUnreadAdminNotificationCount() {
  const notificationsQuery = query(
    collection(db, 'adminNotifications'),
    where('read', '==', false)
  );

  const snapshot = await getDocs(notificationsQuery);
  return snapshot.size;
}

/**
 * Why: PERF-07 — previously issued one `updateDoc` per unread notification (N round trips, N
 * billed writes). Now writes every notification in a single `writeBatch` (up to Firestore's
 * 500-write batch limit, which this admin-notification volume is nowhere near).
 * @returns {Promise<void>} Resolves once the batch commits; resolves immediately if there was
 *   nothing unread.
 * @throws {FirebaseError} If the batch commit fails (e.g. permission-denied).
 * @example
 * await markAdminNotificationsRead();
 */
export async function markAdminNotificationsRead() {
  const notificationsQuery = query(
    collection(db, 'adminNotifications'),
    where('read', '==', false)
  );

  const snapshot = await getDocs(notificationsQuery);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((docItem) => {
    batch.update(docItem.ref, {
      read: true,
      readAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/**
 * Why: PERF-03 — replaces the admin header's 30s polling loop (which downloaded full pending
 * submission + unread notification result sets on a timer, even in background tabs) with two
 * realtime `onSnapshot` listeners that only push an update when the underlying documents actually
 * change, and are billed on change rather than on a fixed interval. Caller is responsible for
 * only subscribing while the signed-in user is an admin, and for calling the returned unsubscribe
 * function on sign-out/unmount (Header.js does both).
 * @param {(total: number) => void} callback - Invoked with the combined pending-submission count
 *   + unread-notification count whenever either listener reports a change (including on first
 *   attach). Invoked with 0 if either listener errors (e.g. the user's admin role hasn't loaded
 *   yet and the listener is denied by security rules).
 * @returns {() => void} Unsubscribe function that detaches both listeners.
 * @example
 * const unsubscribe = subscribeAdminBadgeCounts((count) => setPendingApprovalCount(count));
 * // later, on sign-out/unmount:
 * unsubscribe();
 */
export function subscribeAdminBadgeCounts(callback) {
  let pendingSubmissionCount = 0;
  let unreadNotificationCount = 0;

  const emitTotal = () => callback(pendingSubmissionCount + unreadNotificationCount);

  const unsubscribePending = onSnapshot(
    query(collection(db, 'productSubmissions'), where('status', '==', 'pending')),
    (snapshot) => {
      pendingSubmissionCount = snapshot.size;
      emitTotal();
    },
    () => {
      pendingSubmissionCount = 0;
      emitTotal();
    }
  );

  const unsubscribeUnread = onSnapshot(
    query(collection(db, 'adminNotifications'), where('read', '==', false)),
    (snapshot) => {
      unreadNotificationCount = snapshot.size;
      emitTotal();
    },
    () => {
      unreadNotificationCount = 0;
      emitTotal();
    }
  );

  return () => {
    unsubscribePending();
    unsubscribeUnread();
  };
}

/**
 * Why: Near-static seller-form config read (PERF-00/PERF-08). Cached client-side keyed on
 * `catalogMeta/versions.catalogConfig` so it's read once per version instead of on every seller
 * submission/edit form mount.
 * @returns {Promise<Array<string>>} Admin-approved gear brand names.
 * @throws {FirebaseError} If the underlying Firestore read fails (e.g. permission-denied).
 * @example
 * const brands = await fetchGearBrandOptions();
 */
export async function fetchGearBrandOptions() {
  return withVersionedCache('catalogConfig:gearBrands', 'catalogConfig', CATALOG_CONFIG_CACHE_MAX_AGE_MS, async () => {
    const gearBrandsDoc = await getDoc(doc(db, 'catalogConfig', 'gearBrands'));
    if (!gearBrandsDoc.exists()) {
      return [];
    }

    const brands = Array.isArray(gearBrandsDoc.data()?.brands) ? gearBrandsDoc.data().brands : [];
    return brands
      .map((brand) => (typeof brand === 'string' ? brand.trim() : ''))
      .filter(Boolean);
  });
}

export async function addApprovedGearBrand(brandName, adminId = '') {
  const normalizedBrand = (brandName || '').trim();
  if (!normalizedBrand) {
    return;
  }

  const gearBrandsRef = doc(db, 'catalogConfig', 'gearBrands');
  const currentSnapshot = await getDoc(gearBrandsRef);
  const existingBrands = currentSnapshot.exists() && Array.isArray(currentSnapshot.data()?.brands)
    ? currentSnapshot.data().brands
      .map((brand) => (typeof brand === 'string' ? brand.trim() : ''))
      .filter(Boolean)
    : [];

  const brandExists = existingBrands.some((brand) => brand.toLowerCase() === normalizedBrand.toLowerCase());
  if (brandExists) {
    return;
  }

  await setDoc(
    gearBrandsRef,
    {
      brands: [...existingBrands, normalizedBrand],
      updatedAt: serverTimestamp(),
      updatedBy: adminId || 'admin',
    },
    { merge: true }
  );
}

/**
 * Why: Near-static seller-form config read (PERF-00/PERF-08). Cached client-side keyed on
 * `catalogMeta/versions.catalogConfig` so it's read once per version instead of on every seller
 * submission/edit form mount.
 * @returns {Promise<Object<string, Array<string>>>} Map of manufacturer name to its sorted,
 *   de-duplicated admin-approved model list.
 * @throws {FirebaseError} If the underlying Firestore read fails (e.g. permission-denied).
 * @example
 * const modelsByManufacturer = await fetchBikeModelOptions();
 */
export async function fetchBikeModelOptions() {
  return withVersionedCache('catalogConfig:bikeModels', 'catalogConfig', CATALOG_CONFIG_CACHE_MAX_AGE_MS, async () => {
    const bikeModelsDoc = await getDoc(doc(db, 'catalogConfig', 'bikeModels'));
    if (!bikeModelsDoc.exists()) {
      return {};
    }

    const source = bikeModelsDoc.data()?.modelsByManufacturer;
    if (!source || typeof source !== 'object') {
      return {};
    }

    const normalized = {};
    Object.entries(source).forEach(([manufacturer, models]) => {
      const manufacturerKey = String(manufacturer || '').trim();
      if (!manufacturerKey || !Array.isArray(models)) {
        return;
      }

      const cleanedModels = Array.from(new Set(
        models
          .map((model) => String(model || '').trim())
          .filter(Boolean)
      )).sort((a, b) => a.localeCompare(b));

      if (cleanedModels.length > 0) {
        normalized[manufacturerKey] = cleanedModels;
      }
    });

    return normalized;
  });
}

export async function addApprovedBikeModels(manufacturerName, modelNames = [], adminId = '') {
  const normalizedManufacturer = String(manufacturerName || '').trim();
  if (!normalizedManufacturer || normalizedManufacturer.toLowerCase() === 'universal') {
    return;
  }

  const normalizedModels = Array.from(new Set(
    (Array.isArray(modelNames) ? modelNames : [modelNames])
      .map((model) => String(model || '').trim())
      .filter(Boolean)
  ));

  if (normalizedModels.length === 0) {
    return;
  }

  const bikeModelsRef = doc(db, 'catalogConfig', 'bikeModels');
  const currentSnapshot = await getDoc(bikeModelsRef);
  const existingModelsByManufacturer = currentSnapshot.exists() && typeof currentSnapshot.data()?.modelsByManufacturer === 'object'
    ? currentSnapshot.data().modelsByManufacturer
    : {};

  const existingModels = Array.isArray(existingModelsByManufacturer[normalizedManufacturer])
    ? existingModelsByManufacturer[normalizedManufacturer]
      .map((model) => String(model || '').trim())
      .filter(Boolean)
    : [];

  const mergedModels = Array.from(new Set([...existingModels, ...normalizedModels]))
    .sort((a, b) => a.localeCompare(b));

  await setDoc(
    bikeModelsRef,
    {
      modelsByManufacturer: {
        ...existingModelsByManufacturer,
        [normalizedManufacturer]: mergedModels,
      },
      updatedAt: serverTimestamp(),
      updatedBy: adminId || 'admin',
    },
    { merge: true }
  );
}

/**
 * Why: Looks up admin-approved subcategory options for a single category. Kept for any caller
 * that only needs one category; when a caller needs more than one (e.g. seller submission forms
 * that show both Accessories and Parts subcategories), prefer
 * fetchSubcategoryOptionsForCategories() so `catalogConfig/subcategories` is only read once
 * (PERF-08) instead of once per category.
 * @param {string} categoryName - Category key to look up (e.g. 'Accessories', 'Parts').
 * @returns {Promise<Array<string>>} Sorted, de-duplicated subcategory names for that category
 *   (empty array if the category or doc doesn't exist).
 * @throws {FirebaseError} If the underlying Firestore read fails (e.g. permission-denied).
 * @example
 * const accessorySubcategories = await fetchSubcategoryOptions('Accessories');
 */
export async function fetchSubcategoryOptions(categoryName) {
  const normalizedCategory = String(categoryName || '').trim();
  if (!normalizedCategory) {
    return [];
  }

  const optionsByCategory = await fetchSubcategoryOptionsForCategories([normalizedCategory]);
  return optionsByCategory[normalizedCategory] || [];
}

/**
 * Why: PERF-08 — the seller submission form and submissions page each need approved subcategory
 * options for both 'Accessories' and 'Parts', but the previous code called
 * fetchSubcategoryOptions() once per category, reading the single `catalogConfig/subcategories`
 * document twice on every mount. This reads it once and returns options for every requested
 * category.
 * @param {Array<string>} categoryNames - Category keys to look up (e.g. ['Accessories', 'Parts']).
 * @returns {Promise<Object<string, Array<string>>>} Map of category name to its sorted,
 *   de-duplicated subcategory list (empty array for a category with no approved subcategories).
 * @throws {FirebaseError} If the underlying Firestore read fails (e.g. permission-denied).
 * @example
 * const byCategory = await fetchSubcategoryOptionsForCategories(['Accessories', 'Parts']);
 * // byCategory.Accessories, byCategory.Parts
 */
export async function fetchSubcategoryOptionsForCategories(categoryNames) {
  const normalizedCategories = Array.from(new Set(
    (categoryNames || [])
      .map((name) => String(name || '').trim())
      .filter(Boolean)
  ));

  const result = {};
  normalizedCategories.forEach((name) => {
    result[name] = [];
  });

  if (normalizedCategories.length === 0) {
    return result;
  }

  // Why: cache the whole (unfiltered) byCategory map under one key (PERF-00), keyed on
  // catalogMeta/versions.catalogConfig, then slice it down to the requested categories below —
  // this keeps one cache entry regardless of which category combination a caller asks for.
  const byCategory = await withVersionedCache('catalogConfig:subcategories', 'catalogConfig', CATALOG_CONFIG_CACHE_MAX_AGE_MS, async () => {
    const subcategoryDoc = await getDoc(doc(db, 'catalogConfig', 'subcategories'));
    if (!subcategoryDoc.exists()) {
      return {};
    }

    const source = subcategoryDoc.data()?.byCategory;
    return (source && typeof source === 'object') ? source : {};
  });

  normalizedCategories.forEach((name) => {
    const values = Array.isArray(byCategory[name]) ? byCategory[name] : [];
    result[name] = Array.from(new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
  });

  return result;
}

export async function addApprovedSubcategory(categoryName, subcategoryName, adminId = '') {
  const normalizedCategory = String(categoryName || '').trim();
  const normalizedSubcategory = String(subcategoryName || '').trim();

  if (!['Accessories', 'Parts'].includes(normalizedCategory) || !normalizedSubcategory) {
    return;
  }

  const subcategoryRef = doc(db, 'catalogConfig', 'subcategories');
  const currentSnapshot = await getDoc(subcategoryRef);
  const existingByCategory = currentSnapshot.exists() && typeof currentSnapshot.data()?.byCategory === 'object'
    ? currentSnapshot.data().byCategory
    : {};

  const existingValues = Array.isArray(existingByCategory[normalizedCategory])
    ? existingByCategory[normalizedCategory]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
    : [];

  const alreadyExists = existingValues.some((value) => value.toLowerCase() === normalizedSubcategory.toLowerCase());
  if (alreadyExists) {
    return;
  }

  const merged = [...existingValues, normalizedSubcategory].sort((a, b) => a.localeCompare(b));

  await setDoc(
    subcategoryRef,
    {
      byCategory: {
        ...existingByCategory,
        [normalizedCategory]: merged,
      },
      updatedAt: serverTimestamp(),
      updatedBy: adminId || 'admin',
    },
    { merge: true }
  );
}

/**
 * Why: Admin approval write path — creates the live product doc, marks the submission approved,
 * and folds any newly-approved brand/model/subcategory values into `catalogConfig`. Bumps both
 * `catalogMeta/versions.products` (a new product just became publicly listed) and `.catalogConfig`
 * (PERF-00) exactly once at the end, regardless of how many of the `addApprovedGearBrand`/
 * `addApprovedBikeModels`/`addApprovedSubcategory` calls above actually ran — those helpers don't
 * bump the version themselves so a submission with several new brands doesn't bump it several
 * times.
 * @param {string} submissionId - The `productSubmissions/{id}` document id to approve.
 * @param {string} adminId - The approving admin's uid, stamped onto the new product/submission.
 * @returns {Promise<void>}
 * @throws {Error} If the submission doesn't exist.
 * @example
 * await approveSubmission('sub123', adminUser.uid);
 */
export async function approveSubmission(submissionId, adminId) {
  const submissionDoc = doc(db, 'productSubmissions', submissionId);
  const snapshot = await getDoc(submissionDoc);
  if (!snapshot.exists()) {
    throw new Error('Submission not found');
  }

  const submission = snapshot.data();
  const basePrice = Number(submission.price) || 0;
  const sellerPublicProfile = await fetchSellerPublicProfile(submission.sellerId);
  const productRef = await addDoc(collection(db, 'products'), {
    ...submission,
    price: basePrice,
    basePrice,
    quantity: Math.max(1, Number(submission.quantity) || 1),
    specialEnabled: false,
    specialType: 'percent',
    specialValue: 0,
    specialLabel: '',
    specialStartAt: '',
    specialEndAt: '',
    status: 'listed',
    marketSold: submission.marketSold ?? false,
    clickCount: Number(submission.clickCount) || 0,
    primaryImage: submission.primaryImage || submission.images?.[0] || null,
    sellerSuburb: sellerPublicProfile?.suburb || '',
    sellerCity: sellerPublicProfile?.city || '',
    sellerBadge: sellerPublicProfile?.sellerBadge || '',
    sellerTrustScore: sellerPublicProfile?.sellerTrustScore ?? null,
    approvedAt: serverTimestamp(),
    approvedBy: adminId,
    createdAt: submission.createdAt,
  });

  await updateDoc(submissionDoc, {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedBy: adminId,
    productId: productRef.id,
  });

  if (submission.originalProductId) {
    await deleteDoc(doc(db, 'products', submission.originalProductId));
  }

  const approvedCustomBrands = Array.from(
    new Set([
      (submission.customGearBrand || '').trim(),
      (submission.customAccessoriesBrand || '').trim(),
      (submission.customPartsBrand || '').trim(),
      ((submission.manufacturer || '').trim() === 'Other' ? (submission.otherManufacturer || '').trim() : ''),
    ].filter(Boolean))
  );

  if (approvedCustomBrands.length > 0) {
    await Promise.all(approvedCustomBrands.map((brand) => addApprovedGearBrand(brand, adminId)));
  }

  const approvedManufacturer = ((submission.manufacturer || '').trim() === 'Other'
    ? (submission.otherManufacturer || '').trim()
    : (submission.manufacturer || '').trim());

  const approvedModels = Array.isArray(submission.model)
    ? submission.model.map((item) => String(item || '').trim()).filter(Boolean)
    : (typeof submission.model === 'string' && submission.model.trim() ? [submission.model.trim()] : []);

  if (approvedManufacturer && approvedManufacturer.toLowerCase() !== 'universal' && approvedModels.length > 0) {
    await addApprovedBikeModels(approvedManufacturer, approvedModels, adminId);
  }

  await addApprovedSubcategory(submission.category, submission.subcategory, adminId);

  bumpCatalogVersionClient(['products', 'catalogConfig']);

  await sendSubmissionEmailNotification({
    eventType: 'submission_approved',
    submissionId,
    productId: productRef.id,
  });
}

export async function createOrder({ buyerId, buyerEmail, items, totalAmount, shippingAddress, deliveryFee = 0, shippingSellerCount = 0 }) {
  if (!items || items.length === 0) throw new Error('Cannot create an order with no items.');
  if (!buyerId && !buyerEmail) throw new Error('An email address is required to place an order.');

  const sanitizedItems = items.map((item) => ({
    productId: item.id,
    name: item.name,
    price: Number(item.price),
    quantity: Number(item.quantity),
    primaryImage: item.primaryImage || null,
    sellerId: item.sellerId || '',
    sellerEmail: item.sellerEmail || '',
  }));

  const orderRef = await addDoc(collection(db, 'orders'), {
    buyerId,
    buyerEmail: buyerEmail || '',
    items: sanitizedItems,
    totalAmount: Number(totalAmount),
    deliveryFee: Number(deliveryFee || 0),
    shippingSellerCount: Number(shippingSellerCount || 0),
    shippingAddress,
    status: 'pending_payment',
    createdAt: serverTimestamp(),
  });

  return orderRef.id;
}

export async function rejectSubmission(submissionId, adminId, reason) {
  const submissionDoc = doc(db, 'productSubmissions', submissionId);
  const snapshot = await getDoc(submissionDoc);
  if (!snapshot.exists()) {
    throw new Error('Submission not found');
  }

  const rejectionReason = reason || 'Rejected by admin at this time.';

  await updateDoc(submissionDoc, {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
    rejectedBy: adminId,
    rejectionReason,
  });

  await sendSubmissionEmailNotification({
    eventType: 'submission_rejected',
    submissionId,
    rejectionReason,
  });
}

export async function seedDemoProducts(adminUser) {
  const demoProducts = [
    {
      name: 'Workshop Tool Roll',
      category: 'Accessories',
      subcategory: 'Tools and Maintenance',
      price: 29.99,
      description: 'Compact dirt-bike tool roll for quick pit and trail fixes.',
      specifications: ['Water-resistant outer shell', 'Multiple tool sleeves', 'Roll-up strap closure'],
      images: ['https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1000&q=80'],
    },
    {
      name: 'TrailMaster Helmet',
      category: 'Gear',
      subcategory: 'Helmets',
      price: 89.99,
      description: 'Lightweight safety helmet for daily rides and long trips.',
      specifications: ['Impact-resistant shell', 'Ventilation channels', 'Adjustable fit dial'],
      images: ['https://images.unsplash.com/photo-1613214150388-70f7ebf9f2ea?auto=format&fit=crop&w=1000&q=80'],
    },
    {
      name: 'All-Weather Riding Gloves',
      category: 'Gear',
      subcategory: 'Gloves',
      price: 34.5,
      description: 'Water-resistant gloves with reinforced palm grip.',
      specifications: ['Touchscreen compatible', 'Thermal lining', 'Breathable fabric'],
      images: ['https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1000&q=80'],
    },
    {
      name: 'Performance Brake Pad Kit',
      category: 'Parts',
      subcategory: 'Brakes',
      price: 49.99,
      description: 'Durable replacement pads for reliable stopping power.',
      specifications: ['Heat-resistant compound', 'Low noise design', 'Front axle fitment'],
      images: ['https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=1000&q=80'],
    },
    {
      name: 'Heavy Duty Chain Set',
      category: 'Parts',
      subcategory: 'Chain and Sprockets',
      price: 74.99,
      description: 'High-tensile chain set designed for longevity and smooth transfer.',
      specifications: ['Corrosion resistant', 'Pre-lubricated links', 'Fits standard sprockets'],
      images: ['https://images.unsplash.com/photo-1486754735734-325b5831c3ad?auto=format&fit=crop&w=1000&q=80'],
    },
  ];

  const writeOps = demoProducts.map((product) =>
    addDoc(collection(db, 'products'), {
      ...product,
      // 'listed' is the live status; 'active' is a legacy alias (see the single-status query
      // decision in fetchLiveProducts and scripts/migrate-active-to-listed.js).
      status: 'listed',
      marketSold: false,
      clickCount: 0,
      primaryImage: product.images?.[0] || null,
      sellerEmail: 'demo@mxtrade.local',
      sellerId: 'demo-seed',
      approvedBy: adminUser?.uid || 'manual-seed',
      approvedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    })
  );

  await Promise.all(writeOps);
  return demoProducts.length;
}

export async function removeDemoProducts() {
  const demoProductsQuery = query(
    collection(db, 'products'),
    where('sellerId', '==', 'demo-seed')
  );

  const snapshot = await getDocs(demoProductsQuery);
  if (snapshot.empty) {
    return 0;
  }

  const deleteOps = snapshot.docs.map((docItem) => deleteDoc(doc(db, 'products', docItem.id)));
  await Promise.all(deleteOps);
  return snapshot.size;
}
