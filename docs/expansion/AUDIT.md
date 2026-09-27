# Expansion audit: where we are

This log tracks progress on [PLAN.md](./PLAN.md). Update it whenever a step moves. Newest entries go at the top of each log.

Status key: `Done`, `In progress`, `Blocked (reason)`, `Not started`.

## Client repo (MXTRADE_TEST), owned by the client session
| Step | Item | Status | Evidence / notes |
|---|---|---|---|
| 0 | Decisions doc handed to backend | Done | Committed by backend as `FastSport_BackEnd/docs/DECISIONS.md` (`cc4dfab`). D-20 (role types) requested |
| 0 | Client API needs sent to backend | Done | Backend replied with the domain, cookie, CSRF, OpenAPI and endpoint order |
| 0 | Admin handover sent to admin | Done | Admin confirmed; porting is under way |
| 1 | Remove admin code from client | Done | Removed after the admin session confirmed each port: `pages/admin/*` (dashboard, sales, seed), `pages/api/admin/*`, `components/RefundReviewModal.js`, `lib/adminAuth.js`, 26 admin or dead helpers in `lib/firestoreHelpers.js`, the admin nav, badge and `onSnapshot` listeners in Header and the mobile drawer, and the seller-gate admin bypass (D-02). Seller review (D-03) is not built in admin yet, pending Taylor |
| 2 | `lib/apiClient.js` (cookies, CSRF header, refresh on `AUTH_TOKEN_EXPIRED`, RFC 9457) | Done | Commits `e6caa5b`; Vitest `tests/lib/apiClient.test.js` |
| 2 | `toUserMessage` handles backend problems | Done | Vitest `tests/lib/userMessage.test.js` |
| 2 | Image cropper (4:3 listings, 1:1 avatar) wired into submit, edit and profile | Done | `components/ImageCropDialog.js`, `lib/cropImage.js`, `lib/useImageCropQueue.js`; Vitest tests. Build passes. Playwright check on 2026-09-27 found no runtime errors on `/profile`, `/seller/submit` and the `/seller/submissions` edit form. A full crop-and-upload run is pending the backend's uploads |
| 2 | AuthContext and login, register, verify, reset and Google pages on the backend | Done, verified live | `0b35e97`. Playwright run against the local backend (`f39d94d`, Postgres 18) on 2026-09-27: register (202), unverified login blocked (403, 'check your email' screen), verify link consumed once, login, Header shows the signed-in state, forgot and reset (old session revoked), login with the new password, logout (204), and the Google redirect error path. The Google success path is untested because Google isn't configured locally |
| 2 | Catalog reads (home carousels, product detail and views, catalog search with server-side filters and Load more, About, FAQ) | Done, verified live with no product data | `f3d471e`, `50b161a`, `4058aee`. Live check: home, catalog filter options from `/catalog/config` (for example Boots and Lightly Used), About and FAQ all load. Retested with the 5 demo products: the catalog lists all 5 with the no-image placeholder; the category filter refetches (`category=gear`); product detail shows the price, specs from `conditionLabel`, brand and size, and stock; the view POST returns 204; add to cart works and the stock cap (1) blocks a second add; the home 'new this week' carousels populate. Home lists can be up to about 6 minutes stale by design (`max-age=60, stale-while-revalidate=300`). 'Popular' stays empty until non-demo products exist |
| 2 | Seller application (`/me/seller-profile`, final D-03: self-service, approved immediately, admin can suspend) | Done, verified live | `259faed` plus the D-03 follow-up. Live check against backend `a7ec2e0`: seller terms accepted (200), an invalid ID gives 422 with the message shown ('Enter a valid 13-digit South African ID number.'), a valid ID is approved immediately, the masked ID and account survive a reload, and `/seller/dashboard` unlocks. The suspended banner (reason plus support@) is built but untested, because no suspension exists yet |
| 2 | Profile basics (`PATCH /me`) and avatar (`POST /me/photo`) | Done, verified live | Against backend `22fd418`: round crop dialog, then upload (200), and the WebP is served from `/files/profile-photos/...` and shown in the header and profile; invalid phone gives 422 'Enter a valid phone number (6–15 digits).'; name and phone saved, with the phone normalised to digits, and both survive a reload; an expired access token was refreshed transparently (401, then refresh 204, then retry 200). `pages/profile.js` no longer uses Firebase |
| 2 | Submissions and listing uploads, orders and checkout, refunds, contact on the backend | Blocked (waiting for backend milestones; submissions are next) | Seller submit still reads catalog config from Firestore helpers and moves with submissions |
| 2 | Delete Firebase code, rules, config and dependencies | Not started | After every helper has been replaced |
| 3 | Standalone output and Dockerfile | Done | `npm run build` passes. Docker is not installed on the dev machine, so the image build has not been tested |
| 3 | `next/image` remotePatterns for backend `/files/**` | Done | `e6caa5b` |
| 3 | k3s manifests | Dropped | Taylor: local-only for now, so k3s won't be tested and `deploy/` was removed |
| 3 | Dependency upgrades (Next 16, React 19; Tailwind 4 left to Codex) | Done | Next 16.3.6 (Turbopack) and React 19.3.0. 50 tests pass and the build passes. Browser check: login, catalog, profile. `data-scroll-behavior` added for Next 16 smooth scrolling. DX-06 logged (dev-only HMR console noise) |
| 3 | GitHub Pages workflow | Deferred | Leave alone until work reaches main (Taylor) |
| 3 | Vitest setup | Done | `vitest.config.mjs`, `tests/`; `npm test` passes 24 tests across 5 files |
| 4 | Update `AGENTS.md`, `CLAUDE.md` and `README.md` for the new architecture and commit rule | Done | Rewritten for the three-repo split, the backend API rules, the `dev` branch, commits with no co-author, Vitest and the cropper |

## Backend repo (FastSport_BackEnd), owned by the backend session
| Milestone | Status | Notes |
|---|---|---|
| DECISIONS.md | Done | `cc4dfab` |
| AGENTS.md, CLAUDE.md and README.md | Requested | Taylor flagged these as missing |
| DATABASE.md (schema and ER overview) | Done | Postgres 18, node-pg-migrate, uuidv7, `*_cents`. Auth tables exist; the rest are planned |
| Scaffold (health, problem+json, openapi.json) | Done | `3251462` |
| Auth (JWT with role, 15-minute access, 7-day session, Google, verify, reset) and seeded admin | Done | `3251462`. The session is an absolute 7 days (Taylor confirmed); there is no forced password change for the seeded admin |
| Catalog, then profile, submissions, orders with PayFast, refunds and contact | Catalog next | |
| Mailer (Gmail API via a Workspace service account; noreply@ with Reply-To support@) | After catalog | |
| Local run (Postgres 18 installed natively; Docker isn't installed) | Waiting on Taylor's Postgres install | |

## Admin repo (FastSport_Admin), owned by the admin session
| Item | Status | Notes |
|---|---|---|
| AGENTS.md, CLAUDE.md and README.md | Done | Per the admin session |
| Scaffold, auth and dashboard | Done | Per the admin session |
| Submissions, products and pricing, refunds, sales kanban, late payments, About, FAQs, seed | In progress | |

## Business decisions that affect the client (Tyron, backend `6d7f9b4`)
- D-01: show and charge `effectivePriceCents`. Done (the catalog adapter).
- D-03 (final): self-service. The automatic checks are 422 validation; passing means `approved` immediately; an admin can `suspend` (the reason is shown along with support@fastsport.co.za). There are no pending or rejected states.
- D-21 (corrected): all email is from support@fastsport.co.za; there is no noreply@.
- D-04: the seller form shows both the seller price and the marked-up list price (`sellerPriceCents` and `listPriceCents` from the backend). **Remove the client-side markup calculation** in `seller/submit.js` and `seller/submissions.js` when submissions are ported.
- D-05: show the delivery fee from the checkout quote. Don't calculate it on the client.
- D-08: refund requests within **24 hours** of delivery, with **images required**; the delivery fee is always refunded.
- D-10: **guest checkout stays**.
- D-11: signed-in users must have a verified email to buy or sell; guests are unaffected.
- D-12: editing a live listing takes it off sale until an admin re-approves it.
- D-13: description at most **500** characters; **3–5 images for every category**, Parts included.
- D-16: block the app until re-acceptance. Done (`TermsReacceptGate`).
- D-17: demo products are removed, so there is no product data until submissions land.
- D-18: 10 MB per image.

## Open questions for Taylor or the business
- All of D-01 to D-20 in `FastSport_BackEnd/docs/DECISIONS.md`.
- DX-05: is the stray `MXTRADE_TEST` gitlink at the repo root accidental?
- Should the GitHub Pages workflow (`.github/workflows/static.yml`), which publishes the whole repo, be removed?

## Change log
- **2026-09-27 (later):**
  - Migration work is on the `dev` branch (Taylor's decision); master stays on Firebase.
  - Client auth switched to the backend.
  - Email goes through Google Workspace; Tyron holds the API details. The backend is building the mailer against it and will confirm the method and sender with Taylor.
- **2026-09-27:**
  - Plan approved.
  - Coordination messages sent.
  - API client, Docker standalone build, cropper and Vitest added to the client.
  - Taylor added these requirements: Vitest, WebP storage, cropping, a JWT role claim with 7-day sessions, a seeded admin user, 2 Sonnet subagents per session, and this `docs/expansion/` folder.
