# Tech debt register — Fast Sport / MXTrade (storefront client)

**Date:** 2026-09-29
**Next free IDs:** `PERF-20` · `BUG-12` · `SEC-37` · `DOS-20` · `ARCH-15` · `DX-07` · `LEGAL-30`

This register collects the findings of four read-only audits (Firestore query/caching cost, security & rules, repo structure & architecture, denial-of-service & cost amplification) plus a legal/compliance research pass, run on 2026-09-19 against the old Firebase version of this app, plus the owner's decisions on how to treat them. It exists so that issues found once don't need to be rediscovered: every row is a discrete, evidence-backed item that any contributor (human or agent) can pick up, fix, and close.

**Cleaned up on 2026-09-29 after the Firebase removal.** On the `dev` branch this repo no longer contains any Firebase or Firestore code: `pages/api/*`, `lib/firestoreHelpers.js`, `lib/firebase*.js`, the rules files, the caching layer, `lib/emails.js`, `lib/apiRateLimit.js` and `scripts/*` are deleted, the admin pages moved to FastSport_Admin, and orders, payments, email, rate limiting and business rules moved to FastSport_BackEnd (commits `41a384e` and `cf5e364`). Every row about that code was deleted and recorded in the `## Fixed log`. Only rows that still apply to this client repo remain, plus rows marked `(check after migration)` that need someone to confirm. The `PERF-`, `BUG-` and (mostly) `SEC-` tables are now empty or short; their prefixes stay for future findings.

## How to use this register

- **Adding an item:** pick the prefix for the area (see below), use the next free number in that prefix's series (the header's **Next free IDs** line above, or the highest ID currently in that table or in the Fixed log + 1 if this line is stale), and fill in every column. Evidence must be a real `file:line` (or `file:startLine-endLine`) you have actually looked at — not a guess.
- **Prefixes:** `PERF-` (performance and data-fetching cost) · `BUG-` (correctness bugs) · `SEC-` (security) · `DOS-` (denial-of-service & cost amplification) · `ARCH-` (structure & architecture) · `DX-` (tooling, lint, tests, versions) · `LEGAL-` (legal & compliance, sourced from `docs/LEGAL_COMPLIANCE.md`).
- **Severity:** `Critical` / `High` / `Medium-High` / `Medium` / `Low-Med` / `Low` (`Design` for design notes that aren't defects). Critical = data loss, money, or full compromise; High = a real exploit or a correctness bug that loses/corrupts data; Medium = abuse or waste with a workaround or limited blast radius; Low = hygiene, inconsistency, or a paper cut.
- **Row order:** within each table, rows are sorted **by severity, high to low**; where a table has a **Launch blocker** column, `yes` rows sort before `no` rows at the same severity. **IDs are assigned in discovery order and no longer indicate row position** — always use the ID, never "the Nth row", when referring to an item.
- **Status values:** `Open` (default, not started) · `In progress` (someone is actively working it, including a fix that's genuinely partial) · `Fixed — awaiting commit` (the fix is complete in the working tree but not yet committed by the repo owner — the row stays, with a note, until it's committed) · `Won't fix` (a deliberate decision not to act, with a one-line reason in the row) · `(check after migration)` appended to any of these when the row was written against the Firebase version and needs confirming against the backend-based app.
- **Closing an item:** once a fix is **committed**, DELETE its row from the table (it's no longer debt) and add one line to the `## Fixed log` at the very end of this file: `ID — title — <short commit hash>`. This is the only place a fixed item's ID persists — the table itself never carries a "fixed" row. Items that stopped being this repo's problem are logged the same way, as "resolved by the backend migration" or "moved to FastSport_BackEnd".
- **Never put secret values here.** Reference a secret by name only — never paste an API key, password, signature, or token into this file (or into any commit).
- **IDs are permanent.** Once assigned, an ID is never reused or renumbered — not while its row is still in a table, and not after that row is deleted into the `## Fixed log`. Check both the live tables and the Fixed log before assuming a number is free.

> ## Current state
> **This app is pre-launch and in active testing.** PayFast is **intentionally** running in **sandbox mode**, now configured in FastSport_BackEnd, with no real accounts and no real money moving. **The remaining `SEC-xx`, `DOS-xx` and `LEGAL-xx` rows describe launch blockers, not active incidents.** Each row carries a `Launch blocker` column; everything marked `yes` must be resolved (or explicitly accepted with owner sign-off) before real payments start.
>
> **Fix priority (owner-set):** launch blockers always come first. After that, the project's stated priority is cost reduction first and performance second; the Firestore billing half of that goal is closed by the migration, so what remains is static-asset egress (`DOS-04`, `ARCH-08`) and page performance.

### Top 10 right now

Highest-impact open items across every table.

1. **LEGAL-01 / LEGAL-02 / LEGAL-03 / LEGAL-24 / LEGAL-29** — Terms, Privacy, Refund & Return and buyer policy pages are missing and the footer links fall through to `#` (launch blockers).
2. **LEGAL-09 / LEGAL-13 / LEGAL-22 / LEGAL-16** — ECT Act s43 business details, CIPC number and VAT disclosure are not shown anywhere (launch blockers).
3. **LEGAL-14 / LEGAL-15** — cooling-off and CPA disclosures are missing from checkout and confirmation (launch blockers).
4. **LEGAL-11 / LEGAL-12 / LEGAL-17 / LEGAL-18 / LEGAL-21 / LEGAL-23** — PayFast verification, the marketplace payout model, the Information Officer, and the Second-Hand Goods Act and FICA opinions (launch blockers, mostly owner or legal actions).
5. **DOS-04** — Oversized images in `public/images/` (up to 16 MB each) are served with no cache headers: an egress cost and an availability risk (High, launch blocker).
6. **SEC-19** — The GitHub Pages workflow publishes the entire repository on every push to `master` (Medium, launch blocker).
7. **DX-01** — No ESLint, Prettier, TypeScript or CI step; planned as Step 5 of the restructure (High).
8. **ARCH-08** — Image weight: 31 raw `<img>` tags, the 8 MB background image loaded three times on the home page (Low, shares DOS-04's fix).
9. **ARCH-01** — No SEO metadata (`next/head`) anywhere (Medium).
10. **ARCH-10 / DX-05 / ARCH-09** — Accessibility gaps, the orphan `MXTRADE_TEST` gitlink and repo hygiene (Low).

---

## PERF — performance & data-fetching cost

| ID | Severity | Title | Evidence (file:line) | Impact | Suggested fix | Status |
|---|---|---|---|---|---|---|

_No open rows. Every PERF row described the Firestore query and caching layer, which no longer exists in this repo._

---

## BUG — correctness bugs

| ID | Severity | Title | Evidence (file:line) | Impact | Suggested fix | Status |
|---|---|---|---|---|---|---|

_No open rows. Every BUG row was in Firestore query logic, refund/stock handling or code that moved to the backend or the admin app._

---

## SEC — security

> Every row also has a **Launch blocker** column: `yes` means it must be resolved (or explicitly accepted by the owner) before real payments begin. Server-side security items (ITN validation, rate limiting, rules, Firestore/Storage access) are now owned by FastSport_BackEnd and tracked there.

| ID | Severity | Title | Evidence (file:line) | Impact | Suggested fix | Status | Launch blocker |
|---|---|---|---|---|---|---|---|
| SEC-19 | Medium | GitHub Pages workflow publishes the entire repository on every push to `master` | `.github/workflows/static.yml:36-40` — `path: '.'` under "Upload entire repository", deploying every tracked file on every push, regardless of whether the repo is private | If the GitHub repository is or ever becomes public (or the Pages site is discoverable), this publishes application source and config to the public internet. This is a Next.js server app, so the published files are not even a working site. Overlaps ARCH-09. | Delete the Pages workflow; if a public site is genuinely wanted, build only the intended static output rather than `path: '.'`. | Open | yes |
| SEC-33 | Low | `.gitignore` doesn't cover several local-only paths | `.gitignore` has `.env.local`, `.env`, `/.idea`, `/.playwright-mcp`, `/.playwright-ui-review`; missing: `.env*.local`, `.env.production`, `.claude/`; `.mcp.json` is tracked (`git ls-files .mcp.json`) | A contributor could accidentally `git add -A` and commit a differently-named env file or local agent config. Overlaps ARCH-09. | Add the missing patterns to `.gitignore`; decide whether `.mcp.json` should stay tracked. | Open | no |

---

## DOS — denial of service & cost amplification

> Same **Launch blocker** column meaning as the SEC table above. Firestore, Storage-token, rate-limit, ITN and email-quota rows moved to the backend or were resolved by the migration (see the Fixed log).

| ID | Severity | Title | Evidence (file:line) | Impact | Suggested fix | Status | Launch blocker |
|---|---|---|---|---|---|---|---|
| DOS-04 | High | Static-asset egress: oversized images are served from the app origin with no cache headers | `public/images/` totals ~54 MB: `Gear.jpg` 16.3 MB, `Accessories.jpg` 15.1 MB, `Bik Parts.jpg` 9.6 MB, `background image.jpg` 8.2 MB, `Fast Sports main Logo.png` 4.7 MB, tracked `Fast Sports Logo.psd` 1.6 MB; `next.config.js` has no `headers()`; `pages/index.js:174,193,288` load the 8 MB background three times per home visit; `pages/shop.js:52` loads the category JPGs | 16 MB per unauthenticated GET from the app origin; a few requests per second is an egress bill and can saturate the server's concurrency. The legitimate cost is already high too: the home page and the shop page pull tens of MB per cold visit. | Recompress to under 300 KB WebP; delete the tracked `.psd`; add `headers()` with `Cache-Control: public, max-age=31536000, immutable` for `/images/*`; migrate to `next/image`. | Open | **yes** |
| DOS-17 | Medium | Platform-level: no WAF, ingress limit or spend cap documented for the new hosting | The Firebase App Hosting config (`apphosting.yaml`, `firebase.json`) is deleted; the repo now ships a `Dockerfile` (self-hosting, `output: 'standalone'` in `next.config.js`) with no documented host, instance cap or budget alert | With App Hosting gone, nothing in this repo says where the storefront runs or what bounds its compute and egress spend. | Decide the host, set an instance/concurrency cap and a billing budget alert, and record them here or in the README. Cloud Armor or a CDN in front is an architecture decision, not a quick fix. | Open (check after migration) | yes (spend alert) |

---

## ARCH — structure & architecture

| ID | Severity | Title | Evidence (file:line) | Impact | Suggested fix | Status |
|---|---|---|---|---|---|---|
| ARCH-01 | Medium | No SEO — every page is client-rendered, no `next/head` anywhere | No `next/head` in `pages/` or `components/` (grep 2026-09-29); no `getServerSideProps`/`getStaticProps`; `pages/product/[id].js` fetches its data client-side; `pages/shop/gear.js`, `parts.js`, `accessories.js` redirect client-side to `/shop/catalog` | Product pages have no server-rendered content, no page titles, and no social-preview metadata — nothing is indexable by search engines or shareable with a preview card as things stand. | `<Seo>` component via `next/head`; server-render or statically generate `product/[id]`, home, about and faq against the backend API; convert the three shop redirect pages to `next.config.js` `redirects()`. | Open |
| ARCH-02 | Medium | Seller listing flow may still be duplicated across `submit.js` and `submissions.js` | `pages/seller/submit.js` (298 lines) and `pages/seller/submissions.js` (710 lines) now share `lib/listingForm.js` and `components/ListingFormFields.js`; the old 1300+/1600+ line copies were shrunk during the port | The original duplication (constants, merge helpers, form markup) was mostly extracted, but nobody has re-checked what is still duplicated between the two pages. | Diff the two pages for leftover duplicated helpers and constants and move them into `lib/listingForm.js`, or close this row if nothing is left. | Open (check after migration) |
| ARCH-04 | Low | Order status, category and role strings may still be scattered | Order statuses are now centralised in `lib/api/orders.js` (`ORDER_STATUSES`, `orderStatusColour`); category keys appear as literals, for example `components/Layout.js:8-10` uses `category=Gear`/`Parts`/`Accessories` while `lib/dirtBikeCategories.js` defines its own keys; no hand-copied role checks remain in `pages/` | The status half and the role half of the original row are resolved; whether category casing and keys still drift is unconfirmed. | Export one shared category constant from `lib/dirtBikeCategories.js` and use it in Layout, catalog and seller pages; close the row once that's done or confirmed unnecessary. | Open (check after migration) |
| ARCH-05 | Low | Home page has three near-identical, hand-copied carousels instead of a shared component | `pages/index.js` (543 lines) — three carousel sections with inline product cards (`:221`, `:260`, `:316`, `:355`) instead of reusing `components/ProductCard.js` | Near-duplicate carousel markup and logic that has to be changed three times for any shared behaviour change. | Extract a `ProductCarousel` and reuse `ProductCard` for all home carousels. | Open |
| ARCH-08 | Low | Unoptimised/oversized images and raw `<img>` tags | 31 raw `<img>` usages across `pages/` and `components/`; `next.config.js` now has `images.remotePatterns` for the backend's `/files/**` host, but the pages still use `<img>`; `pages/index.js:174,193,288` load the 8 MB `background image.jpg` three times; `public/images/` ~54 MB (see DOS-04) | Real-world page weight and load time are dominated by unoptimised images. Same evidence also drives DOS-04. | Migrate public product images to `next/image` (private refund images must stay plain `<img>`); recompress the oversized JPGs; remove the `.psd` from `public/`. | Open |
| ARCH-09 | Low | Repository hygiene: an empty gitlink and tracked non-app files | `MXTRADE_TEST/` is an empty directory tracked as a gitlink (mode 160000, sha `67bcf0d`) with no `.gitmodules` (also DX-05); `.agents/` and `skills-lock.json` (AI-skill docs, not app code) and `.mcp.json` are tracked; `public/images/Fast Sports Logo.psd` is tracked; the GitHub Pages workflow publishes the whole repo (SEC-19) | A confusing repo checkout for new contributors and non-app files mixed into the source. | Remove the empty gitlink (confirm first — see the open question); decide whether `.agents/`, `skills-lock.json` and `.mcp.json` belong in this repo; add the missing `.gitignore` patterns (SEC-33); restrict the Pages workflow (SEC-19). | Open |
| ARCH-10 | Low | Accessibility, loading and error handling are minimal | Only 3 `htmlFor` attributes across `pages/` and `components/`; 31 `role=`/`aria-label` lines in total; the price tooltip is a `<span tabIndex={0}>` (`components/SellingPriceInfo.js:28`); loading states are bare text; there is no `pages/_error.js`, no `pages/404.js` and no error boundary | Screen-reader users can't reliably associate labels with their inputs; there's no graceful fallback UI for a crashed component or an unmatched route. | Add `htmlFor`/`id` pairing to form labels as they're touched; add an error boundary and custom `_error.js`/`404.js`. | Open |

---

## DX — tooling, lint, tests, versions

| ID | Severity | Title | Evidence (file:line) | Impact | Suggested fix | Status |
|---|---|---|---|---|---|---|
| DX-01 | High | No lint, formatter, type-check or CI safety net | `package.json` scripts are `dev`, `build`, `start`, `test`, `test:watch` only; no ESLint, Prettier, TypeScript or `jsconfig`; the only CI workflow is the Pages deploy (SEC-19); Vitest tests exist (`tests/`, 99 passing) | Mechanical mistakes such as an undefined component or an unused import can reach a build undetected. The old admin dashboard crash that motivated this row is gone with the admin pages, but the missing safety net remains. | Add ESLint (`core-web-vitals`) and Prettier, then TypeScript, per the restructure plan (Step 5 in `docs/expansion/PLAN.md`); add a CI step that runs lint, tests and build on every push and PR. | Open |
| DX-03 | Low | `reactStrictMode` doubles effects in development | `next.config.js` — `reactStrictMode: true` | Every `useEffect`, including data-fetching effects, fires twice in local development, which is expected React behaviour but can be mistaken for a duplicate request bug. It doesn't happen in production. | No code change needed; keep this note so nobody chases a doubled dev-mode request count. | Won't fix — expected React dev-mode behaviour, not a defect |
| DX-04 | Low | The FAQ page may render empty | `pages/faq.js:3,17` calls `fetchFaqs()` from `lib/api/catalog.js` and shows an empty state when the list is empty; the original finding (zero FAQ documents in the live Firebase project) was about data that no longer exists | If the backend has no FAQ content yet, the FAQ page looks unfinished to every visitor. Not a code bug. | Confirm the backend has FAQ content (FastSport_Admin manages it), or hide the `/faq` page and its links until it does. | Open (check after migration) |
| DX-05 | Low | Stray `MXTRADE_TEST` gitlink (orphan submodule) at the repo root | `git ls-files -s MXTRADE_TEST` shows mode `160000` commit `67bcf0dd` with no `.gitmodules` file; the folder is empty on disk; `.dockerignore` already excludes it | Clones get an empty, un-initialisable `MXTRADE_TEST/` folder; tools that recurse the tree can trip over it, and it confuses which folder is the real repo. | Confirm with the owner it is accidental, then `git rm --cached MXTRADE_TEST` and delete the empty folder. | Open |
| DX-06 | Low | Next 16 dev overlay logs `[HMR] Invalid message: isrManifest` TypeErrors | Seen in the browser console during `next dev` (Next 16.3.6, Turbopack, Pages Router) on every route change, 2026-09-27: `TypeError: Cannot read properties of undefined (reading 'components') at handleStaticIndicator` | Dev-only console noise; not present in the production build. It can hide real errors when reading the console during Playwright checks. | Re-check after the next Next 16 patch release; if it persists, report upstream or filter it when reviewing console output. | Open |

---

## Sandbox → production launch checklist

Before real payments start (PayFast sandbox is switched off in FastSport_BackEnd). Backend items (ITN validation, rate limiting, order and stock rules) are tracked in that repo and are not repeated here.

- [ ] Fix or delete the GitHub Pages workflow (stop publishing the whole repo) — closes **SEC-19**
- [ ] Recompress `public/images` and add `Cache-Control` headers — closes **DOS-04**
- [ ] Decide the host, an instance cap and a billing budget alert for the storefront — closes **DOS-17**
- [ ] Publish Terms & Conditions, Privacy Policy, Refund & Return Policy and Shipping pages, and wire the footer links to them — closes **LEGAL-01**, **LEGAL-02**, **LEGAL-03**, **LEGAL-04**, **LEGAL-24**, **LEGAL-29**
- [ ] Display ECT Act s43 business details (legal/trading name, physical address, CIPC registration number, VAT number if registered) — closes **LEGAL-09**, **LEGAL-13**, **LEGAL-22**, **LEGAL-16**
- [ ] Add cooling-off and CPA disclosures to the Refund & Return Policy and checkout/order-confirmation flow — closes **LEGAL-14**, **LEGAL-15**
- [ ] Name an Information Officer and confirm registration with the Information Regulator — closes **LEGAL-17**, **LEGAL-18**
- [ ] Add the PayFast logo/accepted-payment-method badge at checkout — closes **LEGAL-07**
- [ ] Complete PayFast business verification and confirm the marketplace (hold-and-pay-later) payout model is permitted with PayFast merchant support — closes **LEGAL-11**, **LEGAL-12**
- [ ] Get a legal opinion on the Second-Hand Goods Act and FICA applicability to this marketplace's funds-holding model — closes **LEGAL-21**, **LEGAL-23**

---

## Suggested fix order

Launch blockers first. After that, the owner's priority is cost first and performance second; with Firestore gone, that means image egress and page weight.

1. **Launch blockers.** The LEGAL launch-blocker rows (pages and disclosures, mostly content and owner actions), `SEC-19` (Pages workflow), `DOS-04` (image recompression and cache headers) and `DOS-17` (hosting cap and budget alert).
2. **Image weight.** `DOS-04` and `ARCH-08` together: recompress, add cache headers, migrate public images to `next/image`.
3. **Repo hygiene.** `ARCH-09`, `DX-05`, `SEC-33`.
4. **Lint, format and type safety net.** `DX-01`, then TypeScript, per Step 5 of `docs/expansion/PLAN.md`.
5. **Shared code.** `ARCH-05` (home carousels), `ARCH-02` and `ARCH-04` (re-check what duplication is left).
6. **SEO and accessibility.** `ARCH-01`, `ARCH-10`.

---

## Open questions (need answers from the owner)

### Repo & infra
- Is the GitHub repository public, and is the GitHub Pages deployment (which currently publishes the whole repo on every push) intentional at all?
  Answer:
- What is the `MXTRADE_TEST/` empty gitlink (mode 160000, sha `67bcf0d`) — a stale submodule reference, or a leftover nested clone? Does a separate repo exist at that commit?
  Answer:
- Should `.agents/`, `skills-lock.json` and `.mcp.json` (AI-skill docs and local agent config, not application code) live in this application repo at all?
  Answer:
- Where will the storefront be hosted, and is the `Dockerfile` the deployment path (`DOS-17`)?
  Answer:
- What is the actual `Cache-Control` header on `/images/*` from the deployed host (for example `curl -sI https://<domain>/images/Gear.jpg`)? Next.js serves `/public` with `max-age=0` by default unless `headers()` overrides it.
  Answer:

### Product & business intent
- Should the "MXTrade" vs "Fast Sport" branding be unified across the UI copy and the WhatsApp link text?
  Answer:
- What are the canonical category keys and casing, and should the rest of the codebase be migrated to match (`ARCH-04`)?
  Answer:
- Does the backend have FAQ content, or should the `/faq` page be hidden for now (`DX-04`)?
  Answer:

### Legal & compliance
- What is the registered legal/trading name, and is there a CIPC company registration number to disclose (`LEGAL-13`, `LEGAL-22`)?
  Answer:
- Is the operating entity VAT-registered? If so, what is the VAT number, and are listed/checkout prices meant to be VAT-inclusive (`LEGAL-16`)?
  Answer:
- When a product is defective, counterfeit, or never arrives, who is legally and contractually responsible to the buyer — FastSport (the platform) or the individual seller? This needs to be reflected consistently in a buyer-facing policy, not just the seller T&Cs.
  Answer:
- Are items sold on Fast Sport new, used, or both? This determines whether the Second-Hand Goods Act applies (`LEGAL-21`) and what warranty language is appropriate.
  Answer:
- Does FastSport intend to keep holding buyer funds until delivery and manually pay sellers (as the seller T&C currently states), or move to PayFast's native Split Payments? This affects the FICA question (`LEGAL-23`) and the PayFast merchant-agreement question.
  Answer:
- What physical address should be displayed publicly (registered office / trading address) to satisfy ECT Act s43 and PayFast requirements (`LEGAL-09`, `LEGAL-13`)?
  Answer:
- Has an Information Officer been registered with the Information Regulator, and who should be named as the POPIA contact (`LEGAL-17`, `LEGAL-18`)?
  Answer:
- Are newsletter/marketing emails planned? If so, an opt-in consent flow and unsubscribe mechanism will need to be built (`LEGAL-27`); if not, this can stay low priority.
  Answer:
- Where does the backend (database, file storage, email) run, so the POPIA cross-border transfer disclosure can be written (`LEGAL-20`)?
  Answer:
- Is a typed ID number sufficient for the business's risk appetite for seller onboarding, or should ID document upload plus verification be added, particularly if the Second-Hand Goods Act or FICA is found to apply (`LEGAL-21`, `LEGAL-23`)?
  Answer:

---

## Legal & compliance (LEGAL-xx)

Full detail, sources and the PayFast go-live checklist are in docs/LEGAL_COMPLIANCE.md — research, not legal advice. Evidence paths were re-checked against the `dev` branch on 2026-09-29; line ranges are given only where they were re-verified.

| ID | Priority | Requirement | Status in app | Evidence (file:line) | Launch blocker | Status |
|---|---|---|---|---|---|---|
| LEGAL-01 | Launch blocker | Terms & Conditions accessible from Home and Checkout pages | Missing — no T&C page exists; the footer link falls through to `href="#"` | `components/Layout.js:7-14,95` (`FOOTER_LINK_ROUTES` has no Terms entry) | yes | Open |
| LEGAL-02 | Launch blocker | Privacy Policy accessible from a permanent page/URL | Partial — text only inside the signup modal, no standalone page; footer link unmapped | `components/TermsAndConditionsModal.js`; `pages/login.js:462`; `components/Layout.js:7-14,95` | yes | Open |
| LEGAL-03 | Launch blocker | Refund & Return Policy displayed | Partial — a buyer refund request form exists but no published policy page; footer link unmapped | `components/RefundRequestForm.js`; `pages/profile/orders/[orderId]/return.js`; `components/Layout.js:7-14,95` | yes | Open |
| LEGAL-09 | Launch blocker | Physical business address and up-to-date contact details visible | Missing — no physical address shown on the contact page or footer | `pages/contact.js`; `components/Layout.js` | yes | Open |
| LEGAL-11 | Launch blocker | PayFast merchant "going live" business verification (KYC) | Open question — account-level process with PayFast, not in repo scope | N/A (owner/PayFast account process) | yes | Open |
| LEGAL-12 | Launch blocker | Marketplace / split-payment compliance with PayFast | Missing / mismatch — single merchant account, manual payout later, not PayFast Split Payments | `lib/api/orders.js` (`startPayfast`, `submitPayfastForm`); `components/TermsAndConditionsModal.js` (seller terms) | yes | Open |
| LEGAL-13 | Launch blocker | ECT Act s43 — trading name, address, registration, VAT, full price disclosure | Missing — no legal name, registration number, VAT number or address found anywhere | `pages/`, `components/`, footer, contact page, checkout (no match found) | yes | Open |
| LEGAL-14 | Launch blocker | ECT Act 7-day cooling-off right disclosure | Missing — not mentioned in checkout, order confirmation, or any policy page | `pages/order/confirmation.js`, `pages/checkout.js` (no disclosure found) | yes | Open |
| LEGAL-15 | Launch blocker | CPA returns/refunds/warranties for defective/unsafe goods | Missing (policy) / Partial (workflow) — a buyer refund request flow exists, no published CPA policy | `components/RefundRequestForm.js`; `pages/profile/orders/[orderId]/return.js` | yes | Open |
| LEGAL-16 | Launch blocker | VAT-inclusive pricing / VAT disclosure | Open question / Missing disclosure — plain `R{amount}` everywhere, no VAT label or registration status shown | `pages/checkout.js:409-413`; `pages/shop.js`; `lib/api/orders.js` (`formatRands`) | yes | Open |
| LEGAL-17 | Launch blocker | POPIA-compliant Privacy Policy content | Partial — thorough content in the modal, but not a standalone page and no Information Officer named | `components/TermsAndConditionsModal.js` | yes | Open |
| LEGAL-18 | Launch blocker | Information Officer registered with the Information Regulator | Open question / Missing — no Information Officer named anywhere in the repo | N/A (organisational, not code) | yes | Open |
| LEGAL-21 | Launch blocker (pending legal opinion) | Second-Hand Goods Act dealer registration | Open question — listings carry a new/used condition (`GEAR_CONDITION_OPTIONS`), but no dealer-registration status is known | `lib/dirtBikeCategories.js:2`; `components/ListingFormFields.js` | yes | Open |
| LEGAL-22 | Launch blocker | CIPC company registration disclosure | Missing — no CIPC number, company name, or director info found anywhere | `pages/`, `components/` (no match found) | yes | Open |
| LEGAL-23 | Launch blocker (pending legal opinion) | FICA obligations (accountable institution / funds-holding) | Open question — platform briefly holds buyer funds; seller ID number is collected in the profile form and only the last 4 digits are shown back | `components/TermsAndConditionsModal.js`; `pages/profile.js:421,651-652` | yes | Open |
| LEGAL-24 | Launch blocker | Distinct, discoverable buyer Terms & Conditions | Missing — modal only has `privacy`/`seller` modes, no general buyer T&C despite a footer link for it | `components/TermsAndConditionsModal.js`; `pages/login.js`; `components/Layout.js:7-14,95` | yes | Open |
| LEGAL-29 | Launch blocker (mechanical fix once pages exist) | Footer legal links actually resolve | Missing — 7 of the footer links fall through to `href="#"` (Terms & Conditions, Privacy Policy, Refund & Return Policy, Buyer & Seller Protection, Getting Paid, Seller Obligations, Shipping) | `components/Layout.js:7-14,16-30,95` | yes | Open |
| LEGAL-04 | High | Shipping / delivery policy displayed | Partial — the delivery fee is shown at checkout only; footer "Shipping" link unmapped | `pages/checkout.js:298,413`; `components/Layout.js:16-20` | no | Open |
| LEGAL-07 | High | PayFast/accepted-payment-method logos on Home and Checkout | Missing — no PayFast logo/badge found | `pages/checkout.js`; `pages/index.js`; `components/` | no | Open |
| LEGAL-19 | High | Cookie consent mechanism (POPIA) | Missing — no cookie banner/consent component anywhere (cookie mentions exist only in the privacy text and login copy); the app now uses backend session cookies | `components/`; `pages/_document.js`; `components/TermsAndConditionsModal.js`; `pages/login.js` | no | Open |
| LEGAL-20 | High | POPIA cross-border data transfer disclosure/safeguards | Open question — the Firebase/Firestore region facts no longer apply; where the backend database, file storage and email run is unconfirmed | Not in this repo (FastSport_BackEnd hosting) | no | Open (check after migration) |
| LEGAL-25 | High | T&C acceptance actually captured for the terms being referenced | Partial — signup captures acceptance of the Privacy Policy text under a misleading `hasAcceptedTerms` state; `TermsReacceptGate` and `lib/termsVersions.js` handle re-acceptance | `pages/login.js:55,126,462`; `components/TermsReacceptGate.js`; `lib/termsVersions.js` | no | Open (check after migration) |
| LEGAL-26 | High | VAT/price breakdown and T&C re-confirmation at checkout | Missing — Subtotal/Delivery/Total only, no VAT line and no T&C/Refund link at point of payment (guests do accept terms via `acceptTerms`) | `pages/checkout.js:409-413`; `lib/api/orders.js` (`createOrder`) | no | Open |
| LEGAL-05 | Medium | Buyer & Seller Protection policy | Missing — footer link unmapped, no page | `components/Layout.js:7-14,95` | no | Open |
| LEGAL-06 | Medium | "How it Works" / "Getting Paid" / "Seller Obligations" content | Partial — "How it Works" links to `/about#how-it-works`; the other two are unmapped with no content | `pages/about.js`; `components/Layout.js:7-14,16-20` | no | Open |
| LEGAL-08 | Medium | Secure checkout / SSL / PCI-DSS indication | Unknown (infra) — PayFast hosts the card page (the client only posts to an https action); the storefront domain's HTTPS is not verified | `lib/api/orders.js` (`submitPayfastForm`) | no | Open |
| LEGAL-28 | Medium | Prohibited/restricted goods policy enforcement | Partial — prohibited categories listed in seller T&C text only, no buyer-facing list or automated enforcement | `components/TermsAndConditionsModal.js` | no | Open |
| LEGAL-27 | Low (until marketing emails are planned) | Marketing email consent (opt-in) and unsubscribe mechanism | Missing but currently N/A — only transactional emails are sent today (by the backend), no marketing path exists | `lib/api/contact.js` | no | Open |

---

## Fixed log

Rows are listed by ID. Firestore, Storage, API-route and admin-page rows were deleted on 2026-09-29 after the Firebase removal on the `dev` branch (commits `41a384e` and `cf5e364`); the two forms below say whether the problem simply disappeared with the code or is now FastSport_BackEnd's to own.

### PERF
PERF-00 — Recommended caching design: per-section version doc — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-01 — Home page fetches live products 4x per visit — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-02 — N+1 seller-profile reads per product, not deduped — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-03 — Admin header badge polls every 30s, downloading full docs to count them — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-04 — Catalog, admin sales and "my orders" queries are unbounded, no pagination — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-05 — clickCount write on every product view, anonymous — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-06 — useAuth is a plain hook, so each mounted instance re-reads users/{uid} — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-07 — Unbatched multi-document writes across several flows — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-08 — Near-static catalogConfig docs re-fetched every mount — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-09 — Admin dashboard re-fetches the full product list after every pricing save — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-10 — Server-side (Admin SDK) query waste — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-11 — Order-detail page does N+1 product reads — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-12 — isAdmin() rules helper costs an extra read on every admin-gated request — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-13 — Admin dashboard loads the entire catalog on every mount — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-14 — Seller submissions/dashboard queries are unbounded and fully refetch after every edit — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-15 — Checkout re-fetches each cart-item's product doc when sellerId is missing — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-16 — FAQ and About are refetched in full on every visit — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-17 — sellerPrivateProfiles (bank/ID numbers) must never be cached client-side — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-18 — Profile save triggers an extra users read — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
PERF-19 — Per-seller read in the PayFast notify handler — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)

### BUG
BUG-01 — Buyer's refund-request status update is likely denied by the rules — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
BUG-02 — Lost-update race in approveSubmission — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
BUG-03 — Reserved / zero-stock items still display as available — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364); the client now shows the backend quote's availability and the cart no longer treats quantity 0 as 1
BUG-04 — Separate useAuth instances drift out of sync — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
BUG-05 — Admin dashboard fetches before the auth/role check resolves — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
BUG-06 — Composite indexes missing from firestore.indexes.json — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
BUG-07 — Buyer email case mismatch between write and query — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
BUG-08 — clickCount can be set by anyone and drives "Popular this week" — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
BUG-09 — Google sign-in never creates a users document — resolved by the backend migration (dev branch, commit 41a384e / cf5e364); Google sign-in is now a backend redirect flow
BUG-10 — Dead/broken helper functions in the query layer — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
BUG-11 — Hidden-order-status sets duplicated and drifted — resolved by the backend migration (dev branch, commit 41a384e / cf5e364); statuses now live in `lib/api/orders.js`

### SEC
SEC-01 — PayFast ITN validation skipped by default in sandbox — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)
SEC-02 — A seller can get any product deleted through the approval flow — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-03 — Next.js 15.2.9 is out of support with multiple published advisories — resolved (dev branch, upgraded to Next ^16.3.6 in `package.json`, above the 15.5.24 fix line)
SEC-04 — Order IDs and a cancellation token leak from a public surface — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364); order access now uses the session or the `X-Order-Token` header
SEC-05 — Anonymous order creation with no effective rate limit — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)
SEC-06 — Order-owner and refund rules trust the token email without checking email_verified — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)
SEC-07 — Seller can change a live listing's price with no validation — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-08 — Admin "specials" discounts computed only in the browser and never charged — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-09 — Sellers can self-assign a trust badge — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-10 — Anyone can set any product's clickCount — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-11 — Public product documents expose more than shoppers need — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-12 — Contact form accepts unescaped HTML and a spoofable from address — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-13 — Password reset leaks account existence and internal error detail — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)
SEC-14 — Storage rules accept disguised file types — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-15 — Refund flow is broken end-to-end for buyers — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-16 — Late ITN notifications leave orders paid-but-stuck — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364); the backend now has a `late_payment` status, shown by the client as "Payment received, being reviewed"
SEC-17 — Re-submitting a listing copies stale sale-state into a new product — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-18 — Sellers can revert an approved submission back to pending — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-20 — Missing composite indexes for orders queries — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-21 — Admin role checks disagree across the codebase — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-22 — User self-registration rule is loose — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-23 — Cart treats a quantity of 0 as 1 — resolved (dev branch, `lib/cartContext.js` now uses `?? 0`)
SEC-24 — Order status can move backwards — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)
SEC-25 — Order input is stored without validation — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364); the backend returns 422 with field paths
SEC-26 — Any signed-in user can trigger an email to all admins — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-27 — Full PayFast redirect URL, including merchant_key and signature, is logged — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-28 — Host-header steering of siteUrl when NEXT_PUBLIC_SITE_URL is unset — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-29 — Dead/placeholder code left reachable — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-30 — isAdmin() costs a read on every check — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-31 — Secrets rely solely on .env.local; service-account key in a plaintext file — resolved by the backend migration (dev branch, commit 41a384e / cf5e364); this repo holds no secrets, see `.env.example`
SEC-32 — Ad hoc scripts that read .env.local are tracked in git — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-34 — No secret values found in NEXT_PUBLIC_ variables (informational) — resolved by the backend migration (dev branch, commit 41a384e / cf5e364); `.env.example` documents that NEXT_PUBLIC_* holds no secrets
SEC-35 — Data-wiping migration script has no environment/project guard — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
SEC-36 — publicProductVisible() is wider than what the app treats as live — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)

### DOS
DOS-01 — Unbounded public Firestore reads from the browser — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
DOS-02 — Unfiltered public collection scans — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
DOS-03 — Anonymous write amplification via the public clickCount field — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
DOS-05 — Email-quota exhaustion causes a total email blackout — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)
DOS-06 — Whole-catalogue stock lock-up from a single unauthenticated request — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)
DOS-07 — Unbounded request-body buffering can OOM-kill an instance — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364); the ITN handler is the backend's
DOS-08 — Storage egress via tokenized download URLs — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
DOS-09 — Unbounded, effectively undeletable Storage uploads — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)
DOS-10 — Create/cancel write-churn loop using a leaked order ID and token — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
DOS-11 — Unlimited account creation (no App Check, no bot protection) — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)
DOS-12 — Admin-email flood plus a triple users scan on every call — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
DOS-13 — A single forged ITN yields 3-4 emails plus writes — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)
DOS-14 — Log-volume amplification, including a full ITN payload dump — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
DOS-15 — CPU burn from verifyIdToken calls on junk JWTs — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
DOS-16 — Unauthenticated placeholder routes still consume request slots — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
DOS-18 — Per-request read multipliers amplify DOS-01/DOS-02 — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
DOS-19 — In-memory rate limiter with FIFO eviction and spoofable X-Forwarded-For — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364); the client only handles the 429 `RATE_LIMITED` response

### ARCH
ARCH-03 — Pricing/fee magic numbers duplicated and inconsistent between client and server — resolved by the backend migration (dev branch, commit 41a384e / cf5e364); markup (`useMarkupQuote`), delivery fee and totals now come from the backend quote (D-04, D-05)
ARCH-06 — API routes don't share common helpers; inconsistent error shapes — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
ARCH-07 — Dead and stray code left in the app, including a demo-seeding path — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
ARCH-11 — lib/firestoreHelpers.js is a 1641-line god module running privileged admin logic in the browser — resolved by the backend migration (dev branch, commit 41a384e / cf5e364)
ARCH-12 — useAuth is a plain hook, not a context — resolved by the backend migration (dev branch, commit 41a384e / cf5e364); `lib/AuthContext.js` is the single provider and no hand-copied role checks remain in `pages/`
ARCH-13 — pages/admin/dashboard.js is a single 1060-line component — resolved by the backend migration (dev branch, commit 41a384e / cf5e364); the admin pages moved to FastSport_Admin
ARCH-14 — Raw error messages rendered straight to end users — resolved (dev branch, `lib/userMessage.js` sweep complete; a 2026-09-29 grep found no `err.message` rendered in `pages/` or `components/`)

### DX
DX-02 — Dependency versions are stale and inconsistent — resolved by the backend migration (dev branch, commit 41a384e / cf5e364); `package.json` now has Next ^16.3.6 and React ^19.3.0, and firebase, firebase-admin, nodemailer and uuid are gone

### LEGAL
LEGAL-10 — PayFast ITN signature/source/amount validation — moved to FastSport_BackEnd (dev branch, commit 41a384e / cf5e364)
