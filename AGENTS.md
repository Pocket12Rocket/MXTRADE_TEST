# AGENTS.md — Fast Sport / MXTrade

This is the canonical guidance for any AI coding agent or human contributor working in this
repository. `CLAUDE.md` is a short pointer to this file — if you're an AI agent, read this
whole document before making changes.

## Current state: pre-launch, testing

This app is **not live**. It is in active development/testing:

- PayFast runs in **sandbox mode intentionally** (`PAYFAST_SANDBOX=true` in `apphosting.yaml`,
  backend `fastsportprod`). No real payments happen. ITN (payment notification) signature/IP
  validation is currently skipped in sandbox — that is expected during testing, not a bug to
  silently "fix", but it **is** a launch blocker (see below).
- Test data (products, orders, submissions) may be reset at any time (see
  `scripts/reset-test-data.js`). Do not assume anything you read in Firestore is real production
  data, a real order, or a real payment.
- Before this app can go live, see **docs/TECH_DEBT.md → "Sandbox → production launch
  checklist"** (that file is the tech-debt register maintained alongside this one; if it does not
  exist yet in your checkout, treat launch-readiness items in this file as still open and ask the
  repo owner before assuming otherwise).

## Project summary

- **Framework:** Next.js `15.2.9`, Pages Router (no `app/` directory, no `getStaticProps`/
  `getServerSideProps`/`next/head` in use anywhere today — everything is client-rendered).
- **UI:** React `18.3.1` function components, Tailwind CSS `3.4.4` utility classes.
- **Backend/data:** Firebase — Auth, Firestore (database `(default)`, region **`africa-south1`**,
  see `firebase.json`), Storage. Client SDK `firebase ^12.13.0`; API routes use
  `firebase-admin ^13.10.0` (`lib/firebaseAdmin.js`).
- **Payments:** PayFast (South African gateway), currently sandbox credentials only.
- **Email:** `nodemailer ^8.0.7` (SMTP) with a Resend API fallback/alternative — see
  `lib/emails.js`.
- **Hosting:** Firebase App Hosting, backend id `fastsportprod` (`apphosting.yaml`,
  `firebase.json`). Secrets (PayFast keys, SMTP/Resend creds) live in Cloud Secret Manager, wired
  in via `secret:` entries in `apphosting.yaml`.
- **Node:** 22.x (verified locally: `node --version` → `v22.12.0`). No `engines` field in
  `package.json` and no `.nvmrc` — if you add one, keep it at 22.

## Repo structure

```
pages/                     Next.js Pages Router — every file here is a route (client-rendered)
  _app.js, _document.js    App shell / HTML document
  index.js                 Home page — 4 near-identical product carousels (ARCH debt, see TECH_DEBT)
  shop.js, shop/           Shop landing + catalog.js (main browse/search/filter), gear.js /
                           parts.js / accessories.js (thin client-side redirects to catalog.js)
  product/[id].js          Product detail page (client-side fetch, no SSR/SEO)
  checkout.js              Cart → order creation → PayFast redirect; has its own delivery-fee logic
  order/confirmation.js    Post-checkout confirmation page
  profile.js               Buyer/seller profile, incl. seller private profile (bank/ID) editing
  profile/orders.js        Buyer's order list
  profile/orders/[orderId]/index.js, return.js   Order detail + return/refund request UI
  seller/dashboard.js      Seller landing
  seller/submit.js         New listing submission form (large, 1300+ lines)
  seller/submissions.js    Seller's own submissions: list/edit/resubmit (large, near-duplicate of
                           submit.js in places, see TECH_DEBT ARCH item)
  admin/dashboard.js       Admin console: submissions, refunds, pricing/specials, trust, FAQ/About
                           CMS (large, many responsibilities in one file)
  admin/sales.js           Admin order/fulfilment board (paid → shipped → delivered, refunds)
  admin/seed.js            Demo product seeding — reachable in production, not gated (TECH_DEBT)
  login.js                 Auth (email/password + Google sign-in)
  about.js, contact.js, faq.js   Static-ish content pages, data from Firestore (siteContent, faqs)
  api/                     API routes (server-side, run with firebase-admin — this is where
                           anything privileged/money/role-related MUST live)
    orders/create.js       Creates an order + reserves stock (server-authoritative pricing/stock)
    orders/cancel.js       Cancels a pending order, releases reservation
    payfast/checkout.js    Builds the PayFast redirect (signs the request)
    payfast/notify.js      PayFast ITN webhook — marks orders paid/failed (sandbox-mode caveats
                           above; read this file before touching payment status logic)
    admin/orders/update-status.js    Admin-only order status transitions (paid/shipped/delivered)
    admin/orders/notify-status.js    Order status change email trigger
    admin/approve.js       PLACEHOLDER — not implemented, returns a stub message. Dead route.
    submissions.js         PLACEHOLDER — not implemented, returns a stub message. Dead route.
    submissions/notifications.js     Admin email notifications for new/updated submissions
    auth/password-reset.js Password reset email flow
    contact.js              Contact form → email
components/
  Header.js                Main nav, mega-menu, cart button, admin badge polling (30s interval)
  Layout.js                Page chrome wrapper (header/footer), mounted for the whole app
  CartDrawer.js             Slide-out cart UI
  ProductCard.js            Shared product tile (NOT used by index.js carousels — see TECH_DEBT)
  RefundReviewModal.js      Admin refund review UI — imported nowhere it's rendered (see TECH_DEBT,
                           this is a shipped crash in admin/dashboard.js)
  TermsAndConditionsModal.js  T&Cs acceptance modal
  SellerPartsSubmissionForm.js   DEAD CODE — unused, abandoned extraction attempt. Do not build on
                           this without confirming with the repo owner first; see docs/TECH_DEBT.md.
lib/
  firebase.js               Client Firebase SDK init (plain getFirestore — in-memory cache only,
                           no offline persistence configured)
  firebaseAdmin.js          Admin SDK init for API routes (reads FIREBASE_SERVICE_ACCOUNT_JSON)
  firestoreHelpers.js       THE client data-access layer — ~1600 lines, 70+ exported functions.
                           All client Firestore/Storage reads and writes are meant to go through
                           here (see "Firebase data rules" below). Large god-module; also contains
                           some functions that perform privileged admin writes from the browser
                           (e.g. `approveSubmission`) — treat these as tech debt, not a pattern to
                           copy for new privileged logic (new privileged writes belong in `pages/api/`).
  useAuth.js                Auth hook (`onAuthStateChanged` + `users/{uid}` read). Plain hook, not
                           a shared context — each component instance re-fetches the profile.
  cartContext.js            Cart state via React context, persisted to `localStorage` (not Firestore)
  adminAuth.js               `requireAdminFromRequest(req)` — verifies a bearer ID token and checks
                           `role === 'admin'` server-side. THE pattern to copy for admin API routes.
  apiRateLimit.js           In-memory, per-instance rate limiter keyed on `X-Forwarded-For`
                           (spoofable — do not rely on this alone for abuse-sensitive endpoints)
  payfast.js                DEAD CODE — unused stub (`payfastCheckout`), superseded by
                           `pages/api/payfast/checkout.js`. See docs/TECH_DEBT.md.
  emails.js                 `dispatchEmail` + email template builders — the shared email path.
                           Some API routes reimplement email sending instead of using this (debt).
  compressImage.js          Client-side image compression before upload
  dirtBikeCategories.js     Category/brand/model constant data (`DIRT_BIKE_CATEGORIES` uses
                           `Gear`/`Parts`/`Accessories`, capitalized — see casing note in the
                           glossary below; other parts of the app use lowercase 'gear' etc.)
scripts/                    One-off/maintenance Node scripts run with `node scripts/<file>.js`
  migrate-approved-brands.js          Backfills `catalogConfig/gearBrands` from live data
  migrate-seller-public-profiles.js   Backfills `sellerPublicProfiles` from `sellerPrivateProfiles`
  reset-test-data.js                  Wipes orders/products/Storage test data — NO project guard,
                           be careful which Firebase project is active before running this
styles/, public/            Tailwind global CSS; static assets (public/images is ~55 MB, includes
                           several very large source JPGs and a stray .psd — see docs/TECH_DEBT.md)
firestore.rules             Firestore security rules — the actual access-control source of truth
storage.rules                Storage security rules (only `sellerSubmissions/` and
                           `profilePictures/` paths are defined; no `refunds/` path rule exists
                           even though `firestoreHelpers.js` uploads refund images there — a known
                           gap, see docs/TECH_DEBT.md)
firestore.indexes.json      Composite index definitions. Currently only defines one index
                           (`productSubmissions` by `status`+`createdAt`) — several queries used
                           in the app (e.g. `orders` by `buyerEmail`+`createdAt`, `orders` by
                           `status`+`createdAt`) need composite indexes not present here; if you
                           add a new composite query, add the index here in the same change.
firebase.json                Firebase project config: Firestore region/rules/indexes paths,
                           Storage rules path, App Hosting backend id (`fastsportprod`)
apphosting.yaml              App Hosting env vars/secrets for the deployed backend (PayFast
                           sandbox flag, support/admin emails, Resend/SMTP secret bindings)
next.config.js               Minimal — only sets `reactStrictMode: true`
tailwind.config.js           Minimal — content globs over `pages/` and `components/`, empty theme
docs/                        Repo documentation. See docs/TECH_DEBT.md (issue register — read
                           before starting any task) and docs/LEGAL_COMPLIANCE.md (being written).
```

**Oddities worth knowing about:**

- `MXTRADE_TEST/` at the repo root is an **empty directory tracked as a git submodule/gitlink**
  (no `.gitmodules` file). It resolves to nothing useful. Do not put files in it; do not try to
  "fix" it without asking the repo owner — it may be an accidental artifact from repo setup.
- `.agents/` and `skills-lock.json` at the repo root are **Firebase/Genkit AI skill reference
  docs**, not application code. Don't treat anything under `.agents/` as part of the app.
- `.env-check.js` and `.smtp-test.js` at the repo root are ad-hoc scripts (not in `scripts/`) that
  read `.env.local` directly to sanity-check config. Treat them as dev tooling, not app code —
  and never run them in a way that prints their output somewhere it could be logged/shared, since
  they touch env vars.
- `.github/workflows/static.yml` deploys the **entire repository** (`path: '.'`) to GitHub Pages
  on every push to `master`, with no build/lint/test step. This publishes source files, including
  `firestore.rules`, `apphosting.yaml` (which contains real admin email addresses), and
  `.env-check.js`. Do not assume this workflow is safe to leave as-is; it's flagged in
  docs/TECH_DEBT.md as a security item, not something to fix silently.
- **Known dead/unused code** (do not build new features on top of these without confirming
  intent with the repo owner — see docs/TECH_DEBT.md for the full ARCH-xx entries):
  - `lib/payfast.js` — unused stub, superseded by `pages/api/payfast/checkout.js`.
  - `components/SellerPartsSubmissionForm.js` — unused, not imported anywhere.
  - `pages/api/admin/approve.js` — placeholder route, returns a stub JSON message only.
  - `pages/api/submissions.js` — placeholder route, returns a stub JSON message only.

## Commands & setup

From `package.json`:

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Next.js dev server (`next dev`) |
| `npm run build` | Production build (`next build`) |
| `npm run start` | Starts the production server from a build (`next start`) |
| `npm run migrate:brands` | **Dry run** — reports what `scripts/migrate-approved-brands.js` would change, writes nothing |
| `npm run migrate:brands:apply` | Same script with `--apply` — actually writes to Firestore |
| `npm run migrate:seller-public-profiles` | **Dry run** for `scripts/migrate-seller-public-profiles.js` |
| `npm run migrate:seller-public-profiles:apply` | Same script with `--apply` — actually writes |

Always run the dry-run variant first and read its output before running the `:apply` variant.

**Environment:** copy `.env.example` to `.env.local` and fill it in. `.env.example` lists only a
subset of what the app actually reads from `process.env` — the full set of variable **names**
used in the code (verified by grep; no values shown here) is:

- **Firebase client (public, safe to expose):** `NEXT_PUBLIC_FIREBASE_API_KEY`,
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
  `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`,
  `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- **Site URL:** `NEXT_PUBLIC_SITE_URL` (used to build absolute links in emails/PayFast redirects —
  `apphosting.yaml` does not currently set this for the deployed backend, which means it can fall
  back to a request's `Host` header in some code paths; see docs/TECH_DEBT.md)
- **SMTP / Resend / contact:** `RESEND_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
  `SMTP_USER`, `SMTP_PASS`, `CONTACT_FROM_EMAIL`, `CONTACT_REPLY_TO_EMAIL`,
  `CONTACT_ADMIN_EMAIL`, `CONTACT_ADMIN_EMAILS`, `ADMIN_NOTIFICATION_EMAILS`,
  `BUYER_FROM_EMAIL`, `SUPPORT_EMAIL`
- **PayFast:** `PAYFAST_SANDBOX`, `PAYFAST_SKIP_VALIDATION`, `PAYFAST_FORCE_SANDBOX_VALIDATION`,
  `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`
- **Service account / server-side Firebase:** `FIREBASE_SERVICE_ACCOUNT_JSON` (full service
  account JSON as a string — never print or log this), `FIREBASE_PROJECT_ID`,
  `FIREBASE_STORAGE_BUCKET`
- **Optional branding (used in components, not in `.env.example`):** `NEXT_PUBLIC_BRAND_LOGO`,
  `NEXT_PUBLIC_WHATSAPP_NUMBER`

Never open, print, or paste the contents of `.env.local` — if you need to know what a variable is
*named*, use `.env.example` or the list above; if you need to know whether one is *set*, check
`apphosting.yaml` variable names for the deployed backend.

**Node:** this repo runs on Node 22.

**Port 3000 stuck (stale `next dev` process on Windows):**
```
netstat -ano | findstr :3000
taskkill /PID <pid> /F /T
```

**Browser verification:** the Playwright MCP server is configured in `.mcp.json` at the repo
root (`npx @playwright/mcp@latest`). Use it against the running `npm run dev` server to verify UI
changes instead of guessing from source.

## Coding conventions

### JSDoc — mandatory on every function, hook, component and API handler

Every new or modified function, React hook, component, and API route handler must have a full
JSDoc comment directly above it, in this format:

```js
/**
 * Why: <the reason or context this exists — what problem it solves or what
 * behaviour depends on it, NOT a restatement of what the code literally does>
 * @param {Type} paramName - What this parameter means and any constraints.
 * @returns {Type} What is returned and what it represents.
 * @throws {ErrorType} When and why this can throw.
 * @example
 * const result = await someFunction(arg1, arg2);
 */
```

`@throws` is only required where the function can actually throw or reject. `@example` should be
a realistic call, not a placeholder.

**Realistic example**, based on `fetchThisWeeksNewProductsByCategory` in
`lib/firestoreHelpers.js` (today it has only a one-line `// comment`, no JSDoc — this is what it
should look like once touched):

```js
/**
 * Why: Powers the home page's "New this week" category carousels. Reuses the
 * already-fetched live-product list instead of issuing a second Firestore
 * query per category, since fetchLiveProducts() already returns every
 * listed+active product for the storefront.
 * @param {string} category - Category name to match, case-insensitively
 *   (e.g. 'Gear', 'Parts', 'Accessories').
 * @param {number} [limit=6] - Maximum number of products to return.
 * @returns {Promise<Array<Object>>} Up to `limit` normalized product records
 *   created in the last 7 days, in the order fetchLiveProducts() returned
 *   them (createdAt descending).
 * @throws {FirebaseError} If the underlying Firestore reads in
 *   fetchLiveProducts() fail (e.g. permission-denied, unavailable).
 * @example
 * const newGearThisWeek = await fetchThisWeeksNewProductsByCategory('Gear', 6);
 */
export async function fetchThisWeeksNewProductsByCategory(category, limit = 6) {
```

**Existing code:** most functions in `lib/firestoreHelpers.js` today have no JSDoc, or at most a
partial one (`@param`/`@returns` without a `Why:` line or `@example`). This is expected — the
rule is: new or modified code must comply; when you touch an existing function for any reason,
back-fill its JSDoc to the full format at the same time.

### Style — match what's already here

Verified by reading `lib/firestoreHelpers.js`, `components/Header.js`, and `pages/admin/sales.js`:

- Plain JavaScript, no TypeScript (no `.ts`/`.tsx` files, no `tsconfig.json`).
- React function components with hooks; no class components.
- Tailwind utility classes for styling; no CSS Modules or styled-components in use.
- 2-space indentation.
- Single quotes for strings.
- Semicolons at the end of statements.

Follow this exactly for new code — don't introduce double quotes, 4-space indents, or a
different component style in one file.

### Dependencies

Don't add a new npm dependency without saying so explicitly in the PR/commit message. If it's a
workaround for something that should be fixed properly later, log that in docs/TECH_DEBT.md too.

## Firebase data rules for agents

- All client-side Firestore/Storage access goes through `lib/firestoreHelpers.js`. Don't import
  `firebase/firestore` directly in a page or component — the only current exceptions are
  `pages/login.js` and `components/Header.js` (both import `firebase/auth`/`firebase.js`
  directly for auth, not Firestore queries), and those are pre-existing, not a pattern to extend.
- Every query must be bounded: use `limit()` and/or pagination. Several existing queries in
  `lib/firestoreHelpers.js` are unbounded (see docs/TECH_DEBT.md PERF items) — don't copy that
  pattern into new code, and prefer fixing it if you're already touching that function.
- No N+1 reads: don't call `getDoc` per item inside a loop or `.map()`. Dedupe by document id
  first (e.g. via a `Map`), then batch-fetch.
- Batch multi-document writes with `writeBatch()` or a transaction (`runTransaction`) rather than
  sequential `updateDoc`/`setDoc` calls.
- Prefer `getCountFromServer()` for counts instead of downloading full documents just to count
  them (see the admin badge polling in `components/Header.js` for the anti-pattern to avoid).
- If you add a new composite query (a query with more than one `where`/`orderBy` combination that
  Firestore can't serve from a single-field index), add the corresponding entry to
  `firestore.indexes.json` in the same change.
- If you add a new write path, update `firestore.rules` in the same change — a write that isn't
  allowed by the rules will fail in the running app regardless of what the client code does.
- **Never persist private collections to IndexedDB or localStorage:** `users`,
  `sellerPrivateProfiles`, `orders`, `refundRequests` (subcollection of `orders`),
  `adminNotifications`. These must stay in memory only, and any in-memory cache of them must be
  cleared on logout.
- **Only public data may be cached client-side (IndexedDB/localStorage/etc.):** `products`,
  `catalogConfig`, `faqs`, `siteContent`.
- **Staleness budget:** general product/catalog content may be a few **minutes** stale in a
  client-side cache. **Price and quantity must be seconds-fresh** — re-fetch or re-validate them
  close to the point of display/purchase; never serve a cached price/quantity that could be
  minutes old. Checkout must always re-validate server-side regardless of what the client showed
  (`pages/api/orders/create.js` is the authoritative point today).

## Security rules for agents

- Money, stock, order status, roles, and approvals are **server-authoritative**: they must be
  decided and written by an API route using `firebase-admin`, never trusted from the client.
  Never trust a client-supplied `price`, `quantity`, `status`, or `originalProductId` — validate
  or ignore them server-side.
- Verify Firebase ID tokens in every API route that needs a signed-in user, and check role
  server-side. Follow the pattern in `lib/adminAuth.js` (`requireAdminFromRequest`): read the
  `Authorization: Bearer <token>` header, `admin.auth().verifyIdToken()`, then look up the role
  in Firestore via the Admin SDK — don't trust a role claim from the client. (Note: today this
  check only accepts the exact string `'admin'`, while `firestore.rules` also accepts `'Admin'`/
  `'ADMIN'` — that inconsistency is tracked in docs/TECH_DEBT.md; don't silently "fix" the casing
  in one place without checking the other.)
- Never commit `.env.local`, a service-account JSON file, or any other secret. Never open or
  print `.env.local`'s contents.
- Never put a secret in a `NEXT_PUBLIC_*` variable — those are bundled into client JS and are
  public.
- PayFast ITN (`pages/api/payfast/notify.js`) must be fully validated (signature, source IP,
  `merchant_id`, amount, and a server-side confirmation call) before this app can go live. Today,
  validation is intentionally skipped in sandbox mode — don't treat that as the target state, and
  don't add anything that makes it easier to skip validation outside sandbox.
- Escape/sanitize user input before putting it into an email (HTML or plain text) — see
  docs/TECH_DEBT.md for a known gap in the contact form.
- Never log tokens, API keys, signatures, or user emails. (`useAuth.js` currently logs the full
  Firebase user object on every auth state change — don't copy that pattern into new code.)

## Workflow for agents

1. Read `docs/TECH_DEBT.md` before starting any task, if it exists in your checkout.
2. If you find an issue unrelated to what you were asked to do, **log it in docs/TECH_DEBT.md
   with the next available ID** (prefix by area: `PERF-`, `SEC-`, `BUG-`, `ARCH-`, `DX-`) instead
   of silently fixing it. Keep your change scoped to what was asked.
3. Verify your change in the running app: `npm run dev`, then use the Playwright MCP
   (`.mcp.json`) to drive the browser and confirm the behaviour. State in your summary what you
   actually verified (which pages/flows, what you saw), not just that the code compiles.
4. **Do not run `git commit`, `git add`, `git push`, `git stash`, or anything else that changes
   git state.** The repo owner commits. Instead, write a suggested commit message.
5. Commit message style — this repo does not use Conventional Commits prefixes. Recent history
   (`git log --oneline -10`) looks like: `UI changes and footer added`, `GUI update`, `removal of
   duplicates from seller dashboard`, `product status update changes`, `Check out logic updated`,
   `Quantity fix`, `Update notify.js`. Match that: a short, plain-English summary of the change —
   sometimes imperative ("Update notify.js"), sometimes a noun phrase or past tense ("Quantity
   fix", "GUI update") — no ticket numbers, no `feat:`/`fix:` prefixes, no multi-paragraph bodies.

## Domain glossary (verified from code)

**Firestore collections** (all confirmed present in `firestore.rules`):
- `users` — one doc per account, includes `role` and `canSell`
- `productSubmissions` — seller listing submissions awaiting/having been through approval
- `products` — live/public product listings
- `orders` — buyer orders; has a `refundRequests` **subcollection** (`orders/{orderId}/refundRequests/{id}`, not a top-level collection)
- `sellerPublicProfiles` — public seller info (suburb, city, trust badge/score) — readable by anyone
- `sellerPrivateProfiles` — private seller info (ID number, bank details) — owner/admin only
- `catalogConfig` — three docs: `gearBrands`, `subcategories`, `bikeModels`
- `faqs`, `siteContent` — public content, admin-editable
- `adminNotifications` — admin-only

**Product statuses** (`products.status`, from `lib/firestoreHelpers.js`): `'listed'` (current
live listings), `'active'` (legacy alias — `normalizeProductRecord` maps it to `'listed'` on
read), `'pending'` (transiently used in a couple of write paths). `marketSold: true/false`
(boolean) marks whether a listed product has actually sold, separate from `status`.

**Submission statuses** (`productSubmissions.status`): `'pending'` (awaiting admin review) →
`'approved'` (set by `approveSubmission`, `lib/firestoreHelpers.js:1463`) or `'rejected'` (set by
`rejectSubmission`, `lib/firestoreHelpers.js:1546`). Approval also creates the corresponding
`products` doc with `status: 'listed'` (same `approveSubmission` call) and stamps the new
product's id back onto the submission (`productId: productRef.id`); this whole sequence is a
non-atomic read-modify-write — see docs/TECH_DEBT.md.

**Order statuses** (`orders.status`, from `pages/api/orders/create.js`, `pages/admin/sales.js`,
`pages/api/admin/orders/update-status.js`, `lib/firestoreHelpers.js`): `'pending_payment'`
(just created, awaiting PayFast), `'payment_failed'`, `'failed'`, `'cancelled'`, `'paid'`,
`'shipped'`, `'delivered'`, `'refund_pending'`, `'refunded'`. Admin order-status API
(`update-status.js`) only allows transitions **into** `'paid'`, `'shipped'`, `'delivered'` and
does not currently prevent moving a status backwards (e.g. `'delivered'` → `'paid'`) — treat that
as a known gap, not intended behaviour, when writing new status-changing code.

**Refund request statuses** (`orders/{id}/refundRequests/{id}.status`): `'pending'` (just
submitted by buyer), `'accepted'` / `'denied'` (set by `processRefundRequest`, which also moves
the parent order to `'refunded'` or back to `'delivered'`).

**Roles**: `users.role` — intended value is `'admin'` for admin accounts, otherwise unset/buyer.
**Casing caveat:** `firestore.rules` (`isAdmin()`) accepts `'admin'`, `'Admin'`, or `'ADMIN'`;
`lib/adminAuth.js` and `components/Header.js` (`profile?.role === 'admin'`) only accept the exact
lowercase string `'admin'`. Don't assume these two checks agree — verify both if you touch
role-gated logic. Separately, `users.canSell` (boolean) gates seller-only UI/flows and is
currently self-settable by the user document owner per `firestore.rules`.

**Categories**: canonical keys come from `lib/dirtBikeCategories.js` →
`DIRT_BIKE_CATEGORIES = { Accessories: [...], Parts: [...], Gear: [...] }` — capitalized
(`'Gear'`, `'Parts'`, `'Accessories'`). `components/Header.js`'s `topCategoryTabs` also uses this
capitalization. However, other code paths (e.g. category filtering in `pages/index.js`) use
lowercase (`'gear'`) and `pages/shop/catalog.js` lowercases category values before comparing.
There is no shared constant enforcing one casing — when writing new category-matching code,
compare case-insensitively (as `fetchThisWeeksNewProductsByCategory` already does) rather than
assuming a casing.

**Price fields** (`products`/submissions, from `lib/firestoreHelpers.js` around
`normalizeProductRecord`/`updateProductPricingAsAdmin`): `basePrice` is the seller's listed price
(falls back to a legacy `price` field if `basePrice` is absent); `price` is also written
separately and is what `pages/api/orders/create.js` actually charges; `currentPrice` and
`originalPrice` are the computed/display values when an admin "special" (percentage or flat
discount) is active. **The special/discount is computed client-side only today** — the server
charges `price`, not the discounted `currentPrice` — treat this as a known pricing-integrity gap
(see docs/TECH_DEBT.md), not something to build further features on top of without flagging it.

**Other product fields**: `marketSold` (boolean, sold flag), `inventoryReservations` (map keyed
by order id, holding a temporary stock hold created at checkout — lives on the public `products`
doc), `clickCount` (numeric, incremented on every product-detail view, including by anonymous
users per `firestore.rules`; used to rank the "Most clicked"/"Popular" home carousel).

## Pointers

- `docs/TECH_DEBT.md` — the issue register (Firestore cost/caching, security, correctness,
  structure, tooling). Read it before starting work; log new findings there.
- `docs/LEGAL_COMPLIANCE.md` — being written; check it if your task touches T&Cs, privacy,
  consumer-protection, or payment-compliance behaviour.
- `README.md` — exists but is **stale**: it references "MXTrade" branding in places while the
  live product is "Fast Sport", and describes some integrations (e.g. PayFast) as a "placeholder"
  or "future" work that has since been implemented. Don't trust it over reading the actual code.
