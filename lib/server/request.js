/**
 * Why: Shared low-level request helpers for `pages/api/**` routes. Before this module existed,
 * `getBearerToken` and `escapeHtml` were each copy-pasted independently across several API
 * routes (see ARCH-06 in docs/TECH_DEBT.md) — bug-fixing token parsing or HTML escaping meant
 * fixing it N times and risked already-diverging behaviour. Every server-side route that needs
 * either should import from here instead of redefining it.
 */

/**
 * Why: Extracts the bearer ID token from an `Authorization` header the same way in every API
 * route, so auth-token parsing behaves identically everywhere instead of drifting between
 * copy-pasted implementations (ARCH-06).
 * @param {import('next').NextApiRequest} req - The incoming API request; reads the
 *   `Authorization: Bearer <token>` header.
 * @returns {string} The raw token string, or `''` if no bearer token was present.
 * @example
 * const token = getBearerToken(req);
 * if (token) { const decoded = await admin.auth().verifyIdToken(token); }
 */
export function getBearerToken(req) {
  const authorization = String(req.headers.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

/**
 * Why: Escapes user-supplied values before they're interpolated into server-built HTML (emails,
 * admin-facing pages) so a seller/buyer-controlled string (product name, address, rejection
 * reason, etc.) can't inject markup — required by AGENTS.md's "escape/sanitize user input before
 * putting it into an email" rule. Previously duplicated independently in three files (ARCH-06).
 * @param {*} value - The value to escape. Coerced to a string; `null`/`undefined` become `''`.
 * @returns {string} The value with `& < > " '` replaced by their HTML entities.
 * @example
 * const safeName = escapeHtml(order.buyerEmail);
 */
export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
