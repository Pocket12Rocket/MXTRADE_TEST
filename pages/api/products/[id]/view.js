import admin, { adminDb } from '../../../../lib/firebaseAdmin';
import { rateLimit } from '../../../../lib/apiRateLimit';

// Why: Firestore auto-generated document IDs use this charset; a caller could also pass a
// custom/legacy ID, so this is deliberately permissive (letters, digits, `-`, `_`) rather than
// exactly matching the auto-id generator, while still rejecting anything that could be a path
// traversal attempt, an injection attempt, or an absurdly long value (DOS-03).
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 7;

/**
 * Why: `productStats/{id}.dailyClicks` is keyed by UTC calendar day so the 7-day window and its
 * pruning are unambiguous regardless of server/deploy timezone.
 * @param {number} timestampMs - A point in time in epoch milliseconds.
 * @returns {string} The UTC calendar date as `YYYY-MM-DD`.
 */
function utcDateKey(timestampMs) {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

/**
 * Why: Owner-confirmed narrower visibility check than `firestore.rules`' `publicProductVisible()`
 * — live data has zero products with the legacy `'active'` status, and the client's own catalog
 * query only matches `status == 'listed'`, so `'listed'` is the only status this endpoint should
 * ever need to accept. Kept intentionally strict (exact `'listed'`, not `'active'`/`''`/missing)
 * so a view can't be recorded for a product the storefront wouldn't actually be showing.
 * @param {Object} product - Raw Firestore `products/{id}` document data.
 * @returns {boolean} True when this product is publicly visible on the storefront.
 */
function isPubliclyVisible(product) {
  return product?.status === 'listed' && product?.marketSold !== true;
}

/**
 * Why: Replaces the anonymous per-view `clickCount` write on the public `products` doc
 * (PERF-05/DOS-03/SEC-10/BUG-08) with a server-side, rate-limited counter on a separate
 * Admin-SDK-only `productStats/{productId}` doc, so a product view costs one bounded write on a
 * document nothing else contends with at checkout, instead of an unbounded, client-writable field
 * on the same document `orders/create` and `payfast/notify` also write to.
 * @param {import('next').NextApiRequest} req - Expects `POST` with a `[id]` route param and no
 *   body.
 * @param {import('next').NextApiResponse} res - Responds `204` on success with no body.
 * @returns {Promise<void>}
 * @example
 * fetch(`/api/products/${productId}/view`, { method: 'POST' });
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Only POST is supported.' });
  }

  const productId = String(req.query.id || '').trim();
  if (!PRODUCT_ID_PATTERN.test(productId)) {
    return res.status(400).json({ error: 'Invalid product ID.' });
  }

  // Why: still XFF-spoofable (DOS-19, tracked separately, out of scope here) but bounds the
  // common case of a single client hammering the endpoint.
  if (!rateLimit(req, res, { name: 'product-view', limit: 30, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  try {
    const productRef = adminDb.collection('products').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists || !isPubliclyVisible(productSnap.data())) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const statsRef = adminDb.collection('productStats').doc(productId);
    const now = Date.now();
    const todayKey = utcDateKey(now);
    const validKeys = new Set();
    for (let offset = 0; offset < RETENTION_DAYS; offset += 1) {
      validKeys.add(utcDateKey(now - offset * DAY_MS));
    }

    await adminDb.runTransaction(async (transaction) => {
      const statsSnap = await transaction.get(statsRef);
      const existingDailyClicks = statsSnap.exists && statsSnap.data()?.dailyClicks && typeof statsSnap.data().dailyClicks === 'object'
        ? statsSnap.data().dailyClicks
        : {};

      // Why: `dailyClicks` must stay a genuinely nested map field (not a literal
      // "dailyClicks.2026-09-19"-named top-level field) — building the whole nested object here,
      // with FieldValue.delete() sentinels for pruned keys, and passing it as one `dailyClicks`
      // value under `{ merge: true }` gets Firestore's recursive map-merge to add/overwrite/delete
      // exactly the day keys named below and leave everything else on the doc untouched.
      const dailyClicksUpdate = {};
      Object.keys(existingDailyClicks).forEach((key) => {
        if (!validKeys.has(key)) {
          // Why: prune buckets older than the 7-day window in the same write, per the shared
          // data contract, instead of letting the map grow forever.
          dailyClicksUpdate[key] = admin.firestore.FieldValue.delete();
        }
      });

      let clicks7d = 0;
      validKeys.forEach((key) => {
        const existingCount = Number(existingDailyClicks[key] || 0);
        const newCount = key === todayKey ? existingCount + 1 : existingCount;
        if (newCount > 0) {
          dailyClicksUpdate[key] = newCount;
        }
        clicks7d += newCount;
      });

      const update = {
        productId,
        dailyClicks: dailyClicksUpdate,
        clicks7d,
        lastClickAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      transaction.set(statsRef, update, { merge: true });
    });

    return res.status(204).end();
  } catch (error) {
    // Why: never log request bodies/headers (there is no body on this route) and never forward
    // raw Firestore/system error detail to the client (ARCH-14) — this endpoint is anonymous and
    // high-volume, so a verbose error would be a free information leak.
    console.error('[products/view] failed', error?.code || error?.message || error);
    return res.status(500).json({ error: 'Could not record this view.' });
  }
}
