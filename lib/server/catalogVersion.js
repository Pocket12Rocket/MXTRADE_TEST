import admin, { adminDb } from '../firebaseAdmin';

const VALID_SECTIONS = new Set(['products', 'catalogConfig', 'faqs', 'about']);

/**
 * Why: Single write path for the `catalogMeta/versions` doc (PERF-00's caching design) — every
 * server-side write that changes public product/catalog/faq/about data must bump the relevant
 * section's counter here so clients can detect staleness with one cheap read instead of
 * re-fetching whole collections. Centralising this (rather than letting each API route write its
 * own increment) keeps the document shape consistent with the client agent's read contract
 * (`{ products, catalogConfig, faqs, about, updatedAt }`) and makes it easy to call atomically
 * from inside an existing Firestore transaction.
 * @param {Array<'products'|'catalogConfig'|'faqs'|'about'>} sections - Which section counters to
 *   increment by 1. Unknown values are ignored (not thrown) so a typo can't crash an otherwise
 *   successful order/payment transaction; callers should still pass only valid section names.
 * @param {Object} [options]
 * @param {import('firebase-admin/firestore').Transaction} [options.transaction] - When provided,
 *   the bump is written via `transaction.set(...)` so it commits atomically with the rest of the
 *   caller's transaction (e.g. the same transaction that reserves stock). When omitted, the bump
 *   is written directly via the Admin SDK.
 * @returns {Promise<void>|void} A promise when writing outside a transaction; nothing when a
 *   transaction was supplied (the caller's `runTransaction` call awaits the whole transaction).
 * @throws {Error} If Firestore rejects the write (e.g. permission/network failure at the Admin
 *   SDK level — this should not normally happen since the Admin SDK bypasses security rules).
 * @example
 * // Inside an existing transaction, after reserving stock:
 * await bumpCatalogVersion(['products'], { transaction });
 * @example
 * // Standalone, outside any transaction:
 * await bumpCatalogVersion(['faqs']);
 */
export function bumpCatalogVersion(sections, { transaction } = {}) {
  const uniqueSections = Array.from(new Set(sections || [])).filter((section) => VALID_SECTIONS.has(section));
  if (uniqueSections.length === 0) {
    return transaction ? undefined : Promise.resolve();
  }

  const versionsRef = adminDb.collection('catalogMeta').doc('versions');
  const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  uniqueSections.forEach((section) => {
    update[section] = admin.firestore.FieldValue.increment(1);
  });

  if (transaction) {
    transaction.set(versionsRef, update, { merge: true });
    return undefined;
  }

  return versionsRef.set(update, { merge: true });
}
