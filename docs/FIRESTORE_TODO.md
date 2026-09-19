# Firestore / Firebase console to-do — Fast Sport / MXTrade

**Date:** 2026-09-19
**Purpose:** manual steps the repo owner must do in a terminal (Firebase CLI) or the Firebase/
Google Cloud console — nothing here can be done by an agent editing files in this repo, because
they require an interactive login, console clicks, or a human decision.

**This file is a to-do checklist**, not a permanent reference: check items off as you do them
(`[x]`), and once every item in a section is done, delete that whole section (including its
heading) rather than leaving a section of checked boxes behind. When every section is gone,
delete this file.

---

## 0. One-time CLI setup

The Firebase CLI is **not logged in on this machine yet**. Everything in sections 1, 3 and 4 below
needs this done first.

- [ ] Log in: `npx firebase-tools@latest login` (opens a browser window; sign in with the Google
      account that has access to the Firebase project).
- [ ] Point the CLI at this project: `npx firebase-tools use mx-trade-163ce` (the project id from
      `.firebaserc`).
- [ ] Confirm it worked: `npx firebase-tools projects:list` — you should see `mx-trade-163ce` in
      the list, and `npx firebase-tools use` with no args should show it as the active project.

**Note:** the Firebase MCP server configured in `.mcp.json` reuses this same CLI login. Once
you've logged in here, restart Claude Code and the Firebase MCP tools will pick up the same
credentials — no separate login needed for that.

---

## 1. Composite indexes to create

`firestore.indexes.json` currently defines 4 composite indexes. Read alongside `lib/firestoreHelpers.js`
(current working copy) and the pages that call it, the mapping is:

| # | Collection | Fields (in order) | Query it serves | Page that errors until it exists |
|---|---|---|---|---|
| 1 | `productSubmissions` | `status` ASC, `createdAt` DESC, `__name__` DESC | `fetchPendingSubmissions()` — `where('status','==','pending')` + `orderBy('createdAt','desc')` (`lib/firestoreHelpers.js:1309-1318`) | `pages/admin/dashboard.js:136` (submissions-review panel) |
| 2 | `orders` | `status` ASC, `createdAt` DESC, `__name__` DESC | Two queries share this index (Firestore uses the same index shape for `==` and `in` on the same field): `fetchRefundPendingOrders()` — `where('status','==','refund_pending')` + `orderBy('createdAt','desc')` (`lib/firestoreHelpers.js:34-42`); and `fetchAllOrdersForAdmin()` — `where('status','in',VISIBLE_ORDER_STATUSES)` + `orderBy('createdAt','desc')` (`lib/firestoreHelpers.js:270-287`) | `pages/admin/dashboard.js:199` (refund queue panel); `pages/admin/sales.js:96,123` (fulfilment board) |
| 3 | `orders` | `buyerEmail` ASC, `createdAt` DESC, `__name__` DESC | **No current query uses this exact shape** — see the mismatch note below | — |
| 4 | `orders` | `buyerEmail` ASC, `status` ASC, `createdAt` DESC, `__name__` DESC | `fetchUserOrders(email)` — `where('buyerEmail','==',email)` + `where('status','in',VISIBLE_ORDER_STATUSES)` + `orderBy('createdAt','desc')` (`lib/firestoreHelpers.js:186-224`) | `pages/profile/orders.js:43,73` (buyer's "My orders") |

**Mismatch found:** index #3 (`orders` by `buyerEmail` + `createdAt`, no `status`) doesn't match
any query currently in `lib/firestoreHelpers.js` — the only `buyerEmail` query
(`fetchUserOrders`, line 191) also filters on `status`, which needs index #4 instead. Index #3
looks like a leftover from before the `status` filter was added to `fetchUserOrders` (see
`BUG-11` in `docs/TECH_DEBT.md`). It's not harmful to leave it (Firestore just charges a small
amount of storage/write overhead for the extra index), but it's dead weight — if you deploy the
indexes file and it prompts to delete an index not in the file, that's the console's problem, not
this one (this one is *in* the file, just unused). Consider deleting index #3 from
`firestore.indexes.json` the next time you touch that file, once you've confirmed with whoever is
editing it concurrently that nothing else needs it.

### (A) Create via CLI

```
npx firebase-tools deploy --only firestore:indexes
```

This makes the **console match `firestore.indexes.json` exactly** — including deleting any index
that exists in the console but is *not* in this file.

**Before running this**, export what's currently in the console and diff it against the file, so
you don't lose an index someone created by hand:

```
npx firebase-tools firestore:indexes > /tmp/console-indexes.json
```

(On Windows PowerShell, use a real path instead of `/tmp`, e.g.
`npx firebase-tools firestore:indexes > $env:TEMP\console-indexes.json`.) Open both files and
compare the `indexes` arrays. If the console has an index not in `firestore.indexes.json`, either
add it to the file first or accept that the deploy will delete it — don't run the deploy blind.
(This is the same open question already logged in `docs/TECH_DEBT.md` under BUG-06/SEC-20 — no
one has confirmed yet whether console-only indexes exist.)

### (B) Create via console (per index, if you'd rather not deploy the whole file yet)

Either:
- Trigger the error in the app (visit the page in the "errors until it exists" column above while
  signed in with the right role) — the browser console will show a Firestore error containing a
  direct link that pre-fills the index for you. Click it, then click **Create**.
- Or go to the [Firebase console](https://console.firebase.google.com) → your project → **Firestore
  Database → Indexes → Composite → Add index**, and enter the fields exactly as listed in the
  table above (same order, same ASC/DESC, collection scope = Collection, not Collection group).

**Check build status:** Firestore Database → Indexes → Composite tab shows each index as
`Building` or `Enabled`. On this project's current data volume (single/low-double-digit documents
per collection, per `AGENTS.md`), this should take well under a minute, typically 1–5 minutes at
most. The "The query requires an index" error disappears on its own once the index flips to
`Enabled` — no code change or redeploy needed.

**Verify, per index:**
- [ ] Index 1 (`productSubmissions`): sign in as an admin, open `/admin/dashboard`, check the
      submissions-review panel loads pending submissions without an error in the browser console.
- [ ] Index 2 (`orders` status+createdAt): open `/admin/sales` and confirm the order list loads;
      open `/admin/dashboard`'s refund queue panel and confirm it loads (even if empty).
- [ ] Index 4 (`orders` buyerEmail+status+createdAt): sign in as a buyer with at least one order,
      open `/profile/orders`, confirm the order list loads without error.
- [ ] Index 3: no page to verify against (see mismatch note above) — skip.

---

## 2. Indexes coming soon (do not create yet)

The next phases of work are expected to need these — don't pre-create them, they'll be added to
`firestore.indexes.json` in the same change that adds the code using them:

- `productStats` ordered by `clicks7d` desc — 7-day popularity ranking (successor to the
  gameable, unbounded `clickCount` field tracked as `PERF-05`/`BUG-08` in `docs/TECH_DEBT.md`).
- Possibly `products` by `category` + `createdAt` desc, if/when category-scoped, indexed catalog
  queries replace today's whole-catalog client-side fetch+filter (see `PERF-04`/`ARCH-01` in
  `docs/TECH_DEBT.md`).

---

## 3. Security rules deploy

```
npx firebase-tools deploy --only firestore:rules,storage
```

- [ ] Before running this, review what's actually changing: `git diff firestore.rules` (and
      `git diff storage.rules` if it's also been touched). A rules deploy takes effect immediately
      for all live traffic — don't deploy a rules change you haven't read.
- [ ] Test contentious changes in the **Rules Playground** first: Firestore Database → Rules tab →
      **Rules Playground** (or Storage → Rules → Rules Playground for `storage.rules`). Simulate a
      read/write as a specific auth state (signed out, a buyer's UID, an admin's UID) against a
      specific document path before deploying, especially for anything touching the SEC-0x items
      in `docs/TECH_DEBT.md` (e.g. `email_verified` checks, field allowlists).

---

## 4. Data migrations

From `package.json`, the `migrate:*` scripts (all in `scripts/`), each with a dry-run then an
`:apply` variant — **always run the dry-run first and read its output** before running `:apply`:

- [ ] `npm run migrate:brands` → read the output → `npm run migrate:brands:apply`
      (`scripts/migrate-approved-brands.js` — backfills `catalogConfig/gearBrands` from live data)
- [ ] `npm run migrate:seller-public-profiles` → read the output → `npm run migrate:seller-public-profiles:apply`
      (`scripts/migrate-seller-public-profiles.js` — backfills `sellerPublicProfiles` from
      `sellerPrivateProfiles`)
- [ ] `npm run migrate:active-status` → read the output → `npm run migrate:active-status:apply`
      (`scripts/migrate-active-to-listed.js` — rewrites any `products` doc with the legacy
      `status:'active'` to `status:'listed'`. **Expected to be a no-op**: a live read-only check of
      the Firestore project on 2026-09-19 found 0 products with `status:'active'`, so the dry-run
      should report "Nothing to update." If it reports anything else, something changed since that
      check — read the listed product IDs before applying.)

Each of these needs `FIREBASE_SERVICE_ACCOUNT_JSON` set (via `.env.local`, not printed or pasted
anywhere) or to be run in a hosted environment with Application Default Credentials — see the
script's own `getAdminApp()` for the exact fallback logic.

---

## 5. Console settings to enable before launch

Short, click-path items — the app is pre-launch (PayFast sandbox, see `AGENTS.md`), so none of
these block continued testing, but all should be done before `PAYFAST_SANDBOX` is switched off.

- [ ] **Firebase App Check** (not currently configured anywhere in this repo — confirmed by
      searching for `AppCheck`/`RECAPTCHA` references). Console: **Build → App Check** →
      register the web app → choose the **reCAPTCHA Enterprise** provider → create/select a
      reCAPTCHA Enterprise key in Google Cloud console for this project's domain(s) → back in
      Firebase, set App Check to **monitoring/unenforced mode first** and watch the metrics for a
      few days of real traffic before flipping Firestore and Storage to **Enforced**. Enforcing
      too early, before the client SDK is wired up to attach App Check tokens, will break the app
      for every visitor — don't enforce until that client-side wiring exists.
- [ ] **Authentication → Settings → email enumeration protection.** Console: **Build →
      Authentication → Settings** tab → enable **"Email enumeration protection."** This directly
      helps `docs/TECH_DEBT.md` `SEC-13` (password reset currently returns a distinct "not
      registered" response, letting an attacker enumerate which emails have accounts) — enabling
      this setting alone doesn't fully close SEC-13 (the code still needs to return a generic
      response), but it's a console-side mitigation worth turning on regardless.
- [ ] **Google Cloud Billing → Budgets & alerts.** Console:
      [Google Cloud console](https://console.cloud.google.com) → select this Firebase project →
      **Billing → Budgets & alerts → Create budget**. Set a monthly amount and add email
      threshold alerts (e.g. 50%/90%/100%). This is general cost-control hygiene relevant to the
      unbounded/high-read-volume queries already logged under the `PERF-xx` rows in
      `docs/TECH_DEBT.md` (e.g. `PERF-04`, `PERF-13`) and the abuse-prone endpoints under `SEC-05`
      — a budget alert won't fix those, but it gives you a warning if one of them is exploited or
      regresses before the underlying fix ships.
- [ ] **Firebase App Hosting spend cap.** Console: **Build → App Hosting** → select the
      `fastsportprod` backend → backend settings → look for a spend/usage cap option (Cloud Run
      billing controls it under the hood; if App Hosting doesn't expose a direct cap in your
      console version, set the Cloud Run service's max-instance count as a practical ceiling
      instead, and rely on the Billing budget alert above as the financial backstop).
- [ ] **Seed the `faqs` collection.** Confirmed empty in the live project as of 2026-09-19 (see
      `AGENTS.md`'s domain glossary). Until it has at least one document, `pages/faq.js` will show
      an empty FAQ page. Seed it via the admin dashboard's own FAQ editor — sign in as an admin,
      go to `/admin/dashboard`, find the FAQ section (question/answer form, "Add FAQ" button — see
      `pages/admin/dashboard.js` around line 890) and add real entries there. Don't write directly
      to the `faqs` collection via the console unless you're only doing a one-off test — the admin
      UI is the intended path per `AGENTS.md`.

**Note on `docs/TECH_DEBT.md` cross-references:** `BUG-06` and `SEC-20` (both about the missing
composite indexes) are covered in section 1 above. This task's brief also asked to cross-reference
`DOS-01`, `DOS-11`, `DOS-17`, and `DX-04` here, but as of this file's writing none of those IDs
exist in `docs/TECH_DEBT.md` (the register currently has no `DOS-xx` rows at all, and only goes up
to `DX-03`) — so nothing to link. If cost/abuse-focused `DOS-xx` items get added later covering App
Check or billing alerts specifically, link them here.
