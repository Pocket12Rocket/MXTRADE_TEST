# FastSport expansion plan: splitting into client, admin and backend

**Status tracking:** see [AUDIT.md](./AUDIT.md). **Business decisions:** see `FastSport_BackEnd/docs/DECISIONS.md` (D-01 to D-20).

## Why

The original app is a single Next.js 15 app (pages router) that talks straight to Firebase (Auth, Firestore and Storage):

- Most business logic runs in the browser, in `lib/firestoreHelpers.js`.
- Authorisation is enforced only by `firestore.rules` and `storage.rules`.
- Admin and shopper code live in the same bundle.

We are splitting the app into three repos, with a real backend on PostgreSQL. The goals:

- Money, stock, status and role decisions are made on the server.
- The admin tools become a separate app.
- The Firebase lock-in and its read-based billing go away.

## Repos and owners

Each repo is owned by one Claude session. Each session edits only its own repo, and the sessions coordinate with each other through messages.

| Repo                | Session | Stack                                                                                        | Responsibility                                                 |
| ------------------- | ------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `MXTRADE_TEST`      | client  | Next.js (pages router), Tailwind with some MUI, Vitest                                       | Buyer and seller UI only                                       |
| `FastSport_Admin`   | admin   | Vite, React and MUI SPA; Vitest and Playwright                                               | All admin features                                             |
| `FastSport_BackEnd` | backend | Node LTS, Express, TypeScript, PostgreSQL, Zod with `@asteasolutions/zod-to-openapi`, Vitest | Auth, business logic, files, the API contract and the database |

## Decisions (made by Taylor)

- **Backend:** Node/Express with TypeScript, on PostgreSQL. The C# option was rejected.
- **API contract:** owned by the backend and generated from Zod schemas.
  - Served at `GET /v1/openapi.json`, with a copy committed at `FastSport_BackEnd/openapi/openapi.json`.
  - Money is integer cents in ZAR, IDs are UUIDs, timestamps are ISO 8601 UTC, and lists use cursor pagination (`{items, nextCursor}`).
- **Errors:** RFC 9457 `application/problem+json` from day one, with `type`, `title`, `status`, `detail`, `instance`, `code` and `errors[{path, message}]`. `detail` is safe to show users.
- **Auth:** owned by the backend. Sign-in is email/password or Google (redirect with state and PKCE), and the backend handles email verification and password reset itself.
  - JWTs carry the user id and **role**.
  - The access token lasts **15 minutes** and rotates.
  - A login lasts **7 days**. The refresh token rotates on every use, and reusing an old one revokes the whole session family.
  - Both tokens are httpOnly, Secure, SameSite=Lax, host-only cookies on the API host.
  - CSRF protection: the SameSite cookie, an Origin allowlist, and a required `X-Requested-With: FastSport` header on every data-changing request.
- **Email:** sent through the **Gmail API**, using a Google Workspace service account with domain-wide delegation (Taylor confirmed). All email comes from `support@fastsport.co.za` (Tyron corrected it; there is no noreply@). Tyron supplies the credentials, as backend env vars or a secret file only; Resend is dropped.
- **Branching:** client migration work goes on `dev`, and master stays on Firebase until the client reaches parity.
- **Seeded admin user:** created from the env vars `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, which are never committed. The seed is idempotent.
- **Files:** stored on disk (a volume later) behind the backend's storage interface.
  - **All images are stored as WebP.** The backend converts every upload format, strips metadata and caps dimensions.
  - Public images are served at `/files/**`; refund images are private.
- **Cropping:** the client crops before uploading, using `react-easy-crop`.
  - Listing images are **4:3**, matching every card and carousel.
  - Profile pictures are **1:1**.
- **Data:** start fresh, with no Firestore migration. The seed data is the catalog config (brands, models and subcategories), FAQs, About content and the admin user.
- **Known bugs** are fixed during the port, not copied across. The intended rules come from DECISIONS.md, and until an item is decided its "Recommended" option applies.
- **Running it:** **local only for now** (Taylor, 2026-09-27): this app on :3000, admin on :3001, the API on :4000 against a local Postgres 18. Deployment to the self-hosted Ubuntu server, and k3s, are out of scope and won't be tested until the local stack works end to end.
  - Hosts: `fastsport.co.za` (client), `admin.fastsport.co.za` (admin), `api.fastsport.co.za` (API).
  - Local ports: client on 3000, admin on 3001, API on 4000 (`http://localhost:4000/v1`).
- **Testing:** Vitest for unit and component tests in all repos, and Playwright for end-to-end tests.
- **Standards for every repo:**
  - Each repo has its own `README.md`, `AGENTS.md`, `CLAUDE.md` and `.env.example`, following this repo's rules. That means JSDoc/TSDoc with a `Why:` line, never rendering raw errors, no duplicate code, a `docs/TECH_DEBT.md` register, never surfacing `.env*` contents, and asking when unsure.
  - Use the latest stable dependencies, a production folder structure, lint and format tooling, health checks, structured logging and a Dockerfile.
- **Commits:** made as Taylor only, with **no Co-Authored-By line**.
- **Subagents (Sonnet):** client: up to 2. Admin: up to 3. Backend: up to 3.

## Database (PostgreSQL)

The backend owns the schema, and its source of truth will be `FastSport_BackEnd/docs/DATABASE.md` together with the migrations. The proposed starting shape comes from the Firestore investigation:

| Area            | Tables                                                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity        | `users` (role, `can_sell`, terms versions), `auth_identities` (password or Google), `auth_sessions` (refresh token families), `auth_tokens` (email verification and password reset)                                                    |
| Sellers         | `seller_profiles` (ID and account number encrypted, approval status per D-03), payout ledger (D-06)                                                                                                                                    |
| Catalog         | `product_submissions` (`attributes` jsonb for the category-specific fields), `products` (`base_price_cents`, `special_*` fields, `quantity >= 0`), `product_images`, `product_fitments`, `gear_brands`, `bike_models`, `subcategories` |
| Orders          | `orders`, `order_items` (price, name and image snapshots), `inventory_reservations`, `order_status_history`, `payfast_itn_events`                                                                                                      |
| Refunds         | `refund_requests`, `refund_request_images`                                                                                                                                                                                             |
| Content and ops | `faqs`, `site_content`, `admin_notifications`, `product_daily_views`                                                                                                                                                                   |

## Client repo steps (this repo)

0. **Coordination.**
   - The decisions doc goes to the backend, the client's API needs go to the backend, and the admin handover goes to the admin session.
   - Source drafts for these are listed in AUDIT.md.
1. **Remove admin code once the admin session confirms each feature is ported.** That covers:
   - `pages/admin/*`, `pages/api/admin/*` and `components/RefundReviewModal.js`
   - the admin helpers in `lib/firestoreHelpers.js`
   - the admin nav and badge in `components/Header.js` and `components/MobileNavigationDrawer.js`
   - the admin bypass of the seller gate (D-02)
2. **Replace Firebase with the backend API.**
   - Every call goes through `lib/apiClient.js`, which handles cookies, the CSRF header, one refresh when the backend returns `AUTH_TOKEN_EXPIRED`, and RFC 9457 parsing.
   - Split `lib/firestoreHelpers.js` into `lib/api/*` modules, keeping the same export names.
   - Rewrite `AuthContext` to use `GET /v1/me`, with `id` replacing `uid`.
   - New auth pages: `/verify-email` and `/reset-password`.
   - Uploads become multipart requests of the cropped files.
   - Checkout shows the totals the backend calculates.
   - Remove the IndexedDB versioned cache in favour of HTTP caching.
   - Delete all Firebase code, rules, config and dependencies.
3. **Packaging.**
   - `output: 'standalone'` and a Dockerfile on Node 24 LTS (move to Node 26 once it becomes LTS on 2026-10-28).
   - Upgrade to the latest stable dependencies, flagging any major upgrade before applying it.
   - Decide whether to keep the GitHub Pages workflow.
4. **Docs.** Update `AGENTS.md`, `CLAUDE.md` and `README.md` for the new architecture and commit rule, and retire the Firestore-specific entries in TECH_DEBT and FIRESTORE_TODO.

## Step 5: Restructure to production standard (after the full test pass)

Taylor decided on 2026-09-29 to bring the client in line with `FastSport_Admin`. **Brought forward on 2026-10-01: start it now**, right after the terms-after-registration change and before the browser test pass.

**Split (Taylor, 2026-10-01):**

- **Claude (client session)** does the structural move: TypeScript, `src/` with feature folders, generated API types, ESLint, Prettier and `check`, and TanStack Query. The UI markup and Tailwind classes are kept as they are.
- **Codex then converts the whole UI to Material UI** using the shared FastSport theme (the same tokens as admin) and **removes Tailwind entirely**.
- Codex pauses on this repo during Claude's move.
- **Full TypeScript migration:** convert every `.js` file to `.ts`/`.tsx` with a strict `tsconfig`. Generate API types from the backend's `openapi.json` with `openapi-typescript` (an `npm run api:types` script, as in admin), and type `lib/api/*` against them so contract drift fails the build.
- **Layout:** `src/pages` holds thin route files. `src/features/{auth,catalog,product,cart,checkout,orders,seller,profile,content}` holds each feature's pages, components, hooks and tests side by side, alongside `src/lib/api`, `src/components` (shared UI) and `src/theme`. Tests live next to the code they cover.
- **Tooling:** ESLint (including the jsdoc and react-hooks rules), Prettier, `.editorconfig`, `.nvmrc`, a Node `engines` field, pinned dependency versions, and `npm run check` (typecheck, lint, format and test).
- **Data layer:** replace the hand-written `useEffect` fetching, loading and caching with TanStack Query, as admin does.
- **Coordination:** pause the Codex styling session during the move, then update AGENTS.md for the new layout.

## Verification

- `npm test` (Vitest) and `npm run build` pass.
- `docker build` succeeds.
- Playwright end-to-end against the backend's `docker compose`:
  - register, verify, log in with a password, log in with Google, reset the password, log out
  - browse the catalog
  - seller onboarding, then submitting a listing with cropped images and editing and deleting it
  - PayFast sandbox checkout, with the ITN arriving and the order moving to paid
  - viewing orders and requesting a refund
- No `firebase` references left in `pages`, `components` or `lib`, and no admin code left in the client.
