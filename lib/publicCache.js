/**
 * Why: PERF-00's Layer 2 client cache. A tiny, dependency-free IndexedDB key-value store for
 * PUBLIC data only (products, catalogConfig, faqs, about, popular) — never `users`/`orders`/
 * `sellerPrivateProfiles`/`refundRequests`/`adminNotifications` (see AGENTS.md "Firebase data
 * rules for agents"). SSR-safe (every function no-ops server-side) and private-mode-safe (every
 * IndexedDB call is wrapped so a throw/unavailable API degrades to "no cache" instead of
 * crashing the page). An in-memory `Map` layer sits in front of IndexedDB so repeat reads within
 * the same tab/session never wait on an IndexedDB round trip.
 */

// Why: bump this prefix to invalidate every previously-cached entry on a schema change, without
// needing to touch IndexedDB directly (a new prefix means old keys are simply never read again).
const CACHE_KEY_PREFIX = 'public:v1:';
const DB_NAME = 'fastsport-public-cache';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

// Why: only public, cacheable data may be persisted here — see AGENTS.md/PERF-17. Throwing in
// dev on an unlisted name catches a future caller accidentally caching private data at the
// source, instead of silently caching it.
const ALLOWED_NAME_PATTERN = /^(products|faqs|about|popular|catalogConfig:[A-Za-z0-9_-]+)$/;

const memoryCache = new Map();
let dbOpenPromise = null;

function isIndexedDbAvailable() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * Why: Guards the cache allowlist from AGENTS.md/PERF-17 (only `products`, `catalogConfig:<doc>`,
 * `faqs`, `about`, `popular` may ever be persisted client-side). Throws in development so a
 * mistaken call site is caught immediately instead of quietly caching something it shouldn't;
 * in production it just refuses to cache rather than crashing a shopper's page.
 * @param {string} name - The unnamespaced cache key a caller passed in.
 * @returns {boolean} True if `name` is allowed.
 * @throws {Error} In non-production builds, when `name` isn't on the allowlist.
 */
function assertAllowedName(name) {
  if (ALLOWED_NAME_PATTERN.test(String(name || ''))) {
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    throw new Error(`[publicCache] "${name}" is not an allowlisted public cache key.`);
  }

  return false;
}

function openDb() {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null);
  }

  if (!dbOpenPromise) {
    dbOpenPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        // Why: private browsing (Safari/Firefox) and other IndexedDB failures resolve to `null`
        // rather than rejecting, so every caller can treat "no cache" as the failure mode.
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  return dbOpenPromise;
}

/**
 * Why: Reads one cached public entry, checking the in-memory session layer first (sync-fast,
 * avoids a redundant IndexedDB round trip within the same tab) and falling back to IndexedDB.
 * Never throws — any IndexedDB failure (unavailable, private mode, blocked) resolves to `null`
 * so callers can treat it exactly like a cache miss.
 * @param {string} name - Unnamespaced cache key, e.g. `'products'` or `'catalogConfig:faqs'`.
 * @returns {Promise<{value: *, version: number, savedAt: number}|null>} The cached entry, or
 *   `null` on a miss/unavailable cache.
 * @example
 * const cached = await getCached('products');
 * if (cached && cached.version === currentVersion) { use(cached.value); }
 */
export async function getCached(name) {
  if (!assertAllowedName(name)) {
    return null;
  }

  const key = CACHE_KEY_PREFIX + name;
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const database = await openDb();
    if (!database) {
      return null;
    }

    const entry = await new Promise((resolve) => {
      try {
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const getRequest = transaction.objectStore(STORE_NAME).get(key);
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    if (entry) {
      memoryCache.set(key, entry);
    }

    return entry;
  } catch {
    return null;
  }
}

/**
 * Why: Writes one public cache entry to both the in-memory session layer (immediately visible to
 * this tab) and IndexedDB (survives a reload). Best-effort — an IndexedDB write failure (quota,
 * private mode, unavailable) is swallowed rather than surfaced, since the in-memory layer already
 * has the value for this session.
 * @param {string} name - Unnamespaced cache key, e.g. `'products'`.
 * @param {*} value - The structured-clone-able value to cache (plain objects/arrays only).
 * @param {number} version - The `catalogMeta/versions` section version this value was fetched at
 *   (or `0` for TTL-only caches like `'popular'`, which don't track a version).
 * @returns {Promise<void>}
 * @example
 * await setCached('faqs', faqList, versions.faqs);
 */
export async function setCached(name, value, version) {
  if (!assertAllowedName(name)) {
    return;
  }

  const key = CACHE_KEY_PREFIX + name;
  const entry = { value, version, savedAt: Date.now() };
  memoryCache.set(key, entry);

  if (typeof window === 'undefined') {
    return;
  }

  try {
    const database = await openDb();
    if (!database) {
      return;
    }

    await new Promise((resolve) => {
      try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(entry, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Best-effort — the in-memory layer already has it for this session.
  }
}

/**
 * Why: Lets a write path evict specific entries immediately after its own write succeeds (see
 * `bumpCatalogVersionClient` in lib/firestoreHelpers.js), instead of waiting for a version
 * mismatch to be noticed on some later read — which, in the degraded state where
 * `catalogMeta/versions` itself can't be read, would never be noticed at all (see
 * `getCatalogVersions()`'s pure-maxAge-TTL fallback in lib/catalogVersions.js). Removes from both
 * the in-memory session layer and IndexedDB so a same-tab client-side navigation (no reload) sees
 * the change on its very next read.
 * @param {Array<string>|string} names - One or more unnamespaced cache keys to drop, e.g.
 *   `['products', 'popular']`. Names not on the allowlist are silently skipped (dev still throws,
 *   via `assertAllowedName`, so a bad name here is caught at the call site).
 * @returns {Promise<void>}
 * @example
 * await invalidateCached(['products', 'popular']);
 */
export async function invalidateCached(names) {
  const requestedNames = Array.isArray(names) ? names : [names];
  const validNames = requestedNames.filter((name) => assertAllowedName(name));
  if (validNames.length === 0) {
    return;
  }

  validNames.forEach((name) => {
    memoryCache.delete(CACHE_KEY_PREFIX + name);
  });

  if (typeof window === 'undefined') {
    return;
  }

  try {
    const database = await openDb();
    if (!database) {
      return;
    }

    await new Promise((resolve) => {
      try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        validNames.forEach((name) => store.delete(CACHE_KEY_PREFIX + name));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Best-effort — the in-memory layer above is already evicted for this session.
  }
}

/**
 * Why: Clears the public cache. Per the owner decision (AGENTS.md), the public IndexedDB cache
 * may survive logout since it never holds private data — this is exposed for completeness (e.g.
 * a manual "clear cache" action or a schema-version bump helper), not called from the logout path.
 * @returns {Promise<void>}
 * @example
 * await clearPublicCache();
 */
export async function clearPublicCache() {
  memoryCache.clear();

  if (typeof window === 'undefined') {
    return;
  }

  try {
    const database = await openDb();
    if (!database) {
      return;
    }

    await new Promise((resolve) => {
      try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Best-effort.
  }
}
