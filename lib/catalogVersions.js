/**
 * Why: PERF-00's version-doc cache invalidator. `catalogMeta/versions` holds one numeric counter
 * per cacheable section (`products`, `catalogConfig`, `faqs`, `about`), bumped server/admin-side
 * whenever that section's underlying data changes. Reading it once per page session — instead of
 * once per cached read — is what makes the whole Layer-2 cache in lib/publicCache.js cost at most
 * one extra `getDoc` per page load, regardless of how many cached sections that page uses.
 */

import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const DEFAULT_VERSIONS = { products: 0, catalogConfig: 0, faqs: 0, about: 0 };

// Why: memoized at module scope so every call within the same page session (until a full reload,
// or an explicit invalidateCatalogVersions() call after a write — see lib/firestoreHelpers.js's
// bumpCatalogVersionClient) reuses the same in-flight/resolved promise instead of issuing another
// getDoc.
let versionsPromise = null;

function normalizeVersions(data) {
  return {
    products: Number(data?.products) || 0,
    catalogConfig: Number(data?.catalogConfig) || 0,
    faqs: Number(data?.faqs) || 0,
    about: Number(data?.about) || 0,
  };
}

/**
 * Why: The single read of `catalogMeta/versions` a page session is allowed (memoized promise —
 * every caller within the same page load shares this one `getDoc`). On a missing doc it resolves
 * to genuinely-correct all-zero versions (nothing has ever bumped them) with `isUnavailable:
 * false` — that's real data, not a fallback. On an actual read error (permission-denied while the
 * server agent's rules aren't deployed yet, offline, etc.) it also resolves to all-zero versions,
 * but with `isUnavailable: true`, since in that case the zeros are *not* known to be correct.
 * **Important:** despite the name "default", a value fetched while `isUnavailable` is true still
 * gets cached in lib/publicCache.js — under version `0` — by `withVersionedCache()`; it does not
 * skip caching. What `withVersionedCache()` does instead is skip the *version comparison* when
 * `isUnavailable` is true (an existing cache entry keeps being served purely on `maxAgeMs`, since
 * a version mismatch against an unreliable `0` can't be trusted), so this failure mode degrades
 * to plain TTL caching rather than either poisoning the cache with a wrong version or forcing an
 * unnecessary refetch on every read.
 * @returns {Promise<{products: number, catalogConfig: number, faqs: number, about: number, isUnavailable: boolean}>}
 *   Current section versions (`isUnavailable: false`), or all-zero versions of unknown accuracy
 *   (`isUnavailable: true`) if `catalogMeta/versions` couldn't be read at all.
 * @example
 * const versions = await getCatalogVersions();
 * if (!versions.isUnavailable && cached.version === versions.products) { ... }
 */
export function getCatalogVersions() {
  if (!versionsPromise) {
    versionsPromise = getDoc(doc(db, 'catalogMeta', 'versions'))
      .then((snapshot) => ({
        ...(snapshot.exists() ? normalizeVersions(snapshot.data()) : { ...DEFAULT_VERSIONS }),
        isUnavailable: false,
      }))
      .catch((err) => {
        console.error('[catalogVersions] failed to read catalogMeta/versions', err?.code || err?.message || err);
        return { ...DEFAULT_VERSIONS, isUnavailable: true };
      });
  }

  return versionsPromise;
}

/**
 * Why: Lets a client-side write path (`bumpCatalogVersionClient` in lib/firestoreHelpers.js)
 * force the *next* `getCatalogVersions()` call in this tab to do a fresh `getDoc` instead of
 * reusing the memoized pre-write promise — otherwise the admin who just made the write wouldn't
 * see it reflected in their own tab (which already has the old versions memoized) until a full
 * reload, even though every *other* tab would pick it up correctly once its own cache/maxAge
 * expires.
 * @returns {void}
 * @example
 * await bumpTheWriteThatChangedProducts();
 * invalidateCatalogVersions();
 * const freshVersions = await getCatalogVersions(); // does a new getDoc
 */
export function invalidateCatalogVersions() {
  versionsPromise = null;
}

// Why: at most one onSnapshot listener on catalogMeta/versions per tab, shared by every
// subscribeCatalogVersions() caller, so a long-lived tab (e.g. an admin dashboard) doesn't stack
// up duplicate listeners.
let sharedUnsubscribe = null;
const versionSubscribers = new Set();
let latestVersions = null;

/**
 * Why: Optional long-lived-tab variant of getCatalogVersions() — an admin console or a tab left
 * open for a while can subscribe instead of relying on a single per-load read, so it picks up a
 * version bump without a manual refresh. Cheap by design: exactly one `onSnapshot` listener is
 * ever attached (shared across every caller), regardless of how many components subscribe.
 * @param {(versions: {products: number, catalogConfig: number, faqs: number, about: number, isUnavailable: boolean}) => void} callback
 *   Invoked with the latest versions on every change, including the first snapshot. See
 *   `getCatalogVersions()` for what `isUnavailable` means.
 * @returns {() => void} Unsubscribe function; detaches the shared listener once every subscriber
 *   has unsubscribed.
 * @example
 * const unsubscribe = subscribeCatalogVersions((versions) => setVersions(versions));
 * // later: unsubscribe();
 */
export function subscribeCatalogVersions(callback) {
  versionSubscribers.add(callback);
  if (latestVersions) {
    callback(latestVersions);
  }

  if (!sharedUnsubscribe) {
    sharedUnsubscribe = onSnapshot(
      doc(db, 'catalogMeta', 'versions'),
      (snapshot) => {
        latestVersions = {
          ...(snapshot.exists() ? normalizeVersions(snapshot.data()) : { ...DEFAULT_VERSIONS }),
          isUnavailable: false,
        };
        versionSubscribers.forEach((subscriber) => subscriber(latestVersions));
      },
      (err) => {
        console.error('[catalogVersions] subscribeCatalogVersions listener error', err?.code || err?.message || err);
        latestVersions = { ...DEFAULT_VERSIONS, isUnavailable: true };
        versionSubscribers.forEach((subscriber) => subscriber(latestVersions));
      }
    );
  }

  return () => {
    versionSubscribers.delete(callback);
    if (versionSubscribers.size === 0 && sharedUnsubscribe) {
      sharedUnsubscribe();
      sharedUnsubscribe = null;
      latestVersions = null;
    }
  };
}
