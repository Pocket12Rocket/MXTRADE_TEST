# AGENTS.md: Fast Sport client (MXTRADE_TEST)

This is the single source of truth for any AI coding agent (Claude, Codex, ...) or human
contributor working in this repository. `CLAUDE.md` only points here. If you're an AI agent, read
this whole document before making changes.

## Current state: pre-launch, running on the FastSport backend

The app is **not live** and is being split into three repos, each owned by its own Claude
session:

| Repo                       | Owner session | Role                                                                                                    |
| -------------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `MXTRADE_TEST` (this repo) | client        | Buyer and seller storefront only (Next.js)                                                              |
| `FastSport_Admin`          | admin         | All admin screens (Vite, React and MUI)                                                                 |
| `FastSport_BackEnd`        | backend       | Express, TypeScript and PostgreSQL API. It owns auth, business logic, files, email and the API contract |

- **The plan and progress:** [docs/expansion/PLAN.md](docs/expansion/PLAN.md) and
  [docs/expansion/AUDIT.md](docs/expansion/AUDIT.md). Update AUDIT.md whenever a step moves.
- **Business rules:** `FastSport_BackEnd/docs/DECISIONS.md` (D-01 onwards). Tyron (business) is
  answering them. Until an item is decided, its "Recommended" option applies.
- **Branching:**
  - Migration work happens on **`dev`**.
  - `master` still runs the old Firebase app, and stays that way until `dev` reaches parity.
  - On `dev`, **all Firebase code has been removed**: every page uses the backend API through
    `src/lib/api/*`. Some pages (orders, refunds) are built against the backend's draft contract
    (`FastSport_BackEnd/docs/CONTRACT_DRAFTS.md`) until those endpoints land in `openapi.json`.
- **Admin code does not belong here.** Every admin feature lives in `FastSport_Admin`. Don't add
  admin screens, admin routes or role bypasses to this repo.
- PayFast is sandbox-only and test data can be reset at any time. Don't treat anything you read
  as real orders, payments or customers.
- **Concurrent editors:** a separate Codex session owns UI _styling_ (Tailwind classNames,
  layout, sizing) in `src/components/` and `src/features/`. Claude sessions own _logic_.
  - Never revert or "fix" styling-only diffs you didn't make.
  - Re-read a file right before editing it, and make small targeted edits.
  - `.playwright-ui-review/` is that session's screenshot output; leave it alone.

## Priorities

1. Complete the storefront against the backend API (`src/lib/api/*`), reconciling pages built on
   draft contracts with `openapi.json` as each endpoint lands, then run the full end-to-end test
   pass (Taylor: implement everything first, test afterwards).
2. Performance (page load, time-to-content). Let the backend's HTTP caching (`Cache-Control` and
   `ETag`) do the caching; don't add client-side persistent caches of API data.
3. Everything else, unless it's a launch blocker (docs/TECH_DEBT.md, docs/LEGAL_COMPLIANCE.md).

## Project summary

- **Framework:** Next.js 16 (Pages Router, Turbopack), fully client-rendered (no
  `getServerSideProps`/`getStaticProps`). `output: 'standalone'` is set for Docker.
- **UI:** React 19 function components, Tailwind CSS 3 plus a shared MUI theme
  (`src/theme/muiTheme.js`, `src/theme/tokens.js`). Image cropping uses `react-easy-crop`.
- **Backend:** the FastSport API (`FastSport_BackEnd`), reached at `NEXT_PUBLIC_API_URL`, which
  includes the version prefix (for example `http://localhost:4000/v1`).
  - The contract is OpenAPI, generated from Zod: `GET /v1/openapi.json`, with a copy at
    `FastSport_BackEnd/openapi/openapi.json`.
  - Errors are RFC 9457 `application/problem+json`: `type`, `title`, `status`, `detail`, and the
    extensions `code` and `errors[{path, message}]`.
  - Money is integer cents in ZAR, and IDs are UUIDs.
  - Lists use cursor pagination: `{items, nextCursor}`.
- **Auth:** the backend sets httpOnly cookies.
  - The access token lasts 15 minutes. A session lasts an absolute 7 days, and the refresh token
    rotates on every use.
  - The client never sees or stores tokens.
  - Login methods are email and password, and Google, which is a full-page redirect through the
    backend.
- **Images:** the backend stores everything as WebP.
  - The client crops before upload: listings are 4:3 (at most 1600×1200), avatars are 1:1 (at
    most 512×512).
  - Public images are served from `<api host>/files/**`. Refund images are private and must not
    go through `next/image`.
- **Payments:** PayFast, sandbox only, handled entirely by the backend.
- **Email:** sent only by the backend, through the Gmail API with a Workspace service account
  (D-21). The client never sends email.
- **Running it:** for now everything runs **locally only**: this app on :3000, the admin app on
  :3001 and the API on :4000 against a local Postgres 18. Deployment (a self-hosted Ubuntu server)
  is out of scope until the local stack works end to end. The root `Dockerfile` (Node 24 LTS) is
  kept for later, but isn't part of the local workflow.
  - Production hosts: `fastsport.co.za` (client), `admin.fastsport.co.za`,
    `api.fastsport.co.za`.
  - Local ports: client 3000, admin 3001, API 4000.
- **Tests:** Vitest with jsdom and React Testing Library (`*.test.js` next to the code). Playwright (MCP) is used for
  in-browser checks.

## Repo structure

```
src/
  pages/                    THIN Next.js Pages Router files only: each re-exports its page
                            component from a feature (export { default } from '@/features/...')
    _app.js, _document.js   App shell: MUI theme, AuthProvider, CartProvider, Layout
  features/                 One folder per feature: its pages, components, hooks and tests
    auth/                   LoginPage, VerifyEmailPage, ResetPasswordPage, TermsReacceptGate,
                            TermsAndConditionsModal, termsVersions.js
    catalog/                HomePage (carousels), ShopPage, CatalogPage (server-side filters, sort,
                            cursor "Load more"), the /shop/<category> redirects, ProductCard
    product/                ProductPage: detail and view tracking
    cart/                   cartContext (cart in localStorage, keyed per user id), CartDrawer
    checkout/               CheckoutPage (quote, order, PayFast form post), OrderConfirmationPage
                            (PayFast return and cancel), useOrderStatusPoll
    orders/                 OrdersPage, OrderDetailPage, ReturnOrderPage (signed in),
                            GuestOrderPage, GuestReturnOrderPage (email link, ?token=),
                            OrderDetail, RefundRequestForm, PrivateImage, usePrivateImageUrl
    seller/                 SellerDashboardPage, SellerSubmitPage, SellerSubmissionsPage,
                            ListingFormFields, SellingPriceInfo, useListingImages,
                            useServiceFeeQuote
    profile/                ProfilePage: details, avatar (square crop), terms, seller application
    content/                AboutPage, FaqPage, ContactPage
  components/               Shared UI: Header, Layout, MobileNavigationDrawer, CategoryTabs,
                            CarouselControl, ServiceFeeNote, ImageCropDialog (every image upload)
  lib/                      Shared logic
    apiClient.js            THE only place that calls the backend with fetch: cookies, CSRF
                            header, refresh on AUTH_TOKEN_EXPIRED, RFC 9457 parsing
    api/                    One module per backend domain: auth, catalog (plus toClientProduct()),
                            profile, seller, submissions (plus toSellerListing()), checkouts,
                            orders, returns, contact
    AuthContext.js, useAuth.js   Shared session state from GET /me (user, profile, signOut, ...)
    userMessage.js          toUserMessage() and UserFacingError; the only way errors reach the UI
    useSingleFlight.js      Double-submit guard for every backend action
    cropImage.js, useImageCropQueue.js   Crop maths and encoding, and the multi-file crop queue
    listingForm.js          Listing form logic shared by the seller pages and lib/api/submissions
    dirtBikeCategories.js   Header mega-menu category list (the forms use /catalog/config)
  theme/                    muiTheme.js and tokens.js
  styles/globals.css        Tailwind layers and global CSS
  test/setup.js             Vitest setup (jest-dom matchers, cleanup)
public/                     Static assets
docs/expansion/             Cross-repo plan and progress audit
docs/TECH_DEBT.md           Issue register (read before starting work)
Dockerfile, .dockerignore   Standalone image for later deployment (not used locally)
```

Tests live next to the code they cover as `*.test.js` (for example
`src/features/auth/LoginPage.test.js`). Imports that cross folders use the `@/` alias for `src/`
(`jsconfig.json`, Vitest alias); imports within one folder stay relative (`./Foo`).

**Oddities:** `MXTRADE_TEST/` at the root is an empty, orphaned gitlink (TECH_DEBT DX-05); leave
it alone. `.agents/` and `skills-lock.json` are tool reference docs, not app code.
`.github/workflows/static.yml` publishes the whole repo to GitHub Pages; that is an open decision
in AUDIT.md.

## Commands and setup

| Command                | What it does                                         |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Next.js dev server on :3000                          |
| `npm run build`        | Production (standalone) build                        |
| `npm test`             | Vitest, run once                                     |
| `npm run test:watch`   | Vitest in watch mode                                 |
| `npm run lint`         | ESLint over the repo                                 |
| `npm run lint:fix`     | ESLint with autofix                                  |
| `npm run format`       | Prettier, write                                      |
| `npm run format:check` | Prettier, check only                                 |
| `npm run check`        | Lint, format check and tests (run before committing) |

**Environment:** copy `.env.example` to `.env.local`. The client needs only
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BRAND_LOGO` and
`NEXT_PUBLIC_WHATSAPP_NUMBER`; every secret lives in the backend. Old Firebase variables in an
existing `.env.local` are ignored and can be removed. Never open,
print or paste `.env.local`. To point a dev run at the local API without touching it:
`NEXT_PUBLIC_API_URL=http://localhost:4000/v1 npx next dev -p 3000`.

**Local backend:** the backend session runs the API on `:4000` against a local Postgres 18. In
local development, email goes to the backend's log, so ask the backend session for verification
and reset links.

**Port 3000 stuck (stale `next dev` on Windows):** `netstat -ano | findstr :3000`, then
`taskkill /PID <pid> /F /T`.

**Browser checks:** use the Playwright MCP server (`.mcp.json`) against the running dev server.

## Coding conventions

### JSDoc: required on every function, hook, component and handler

Every new or modified function, hook and component must have a JSDoc block:

```js
/**
 * Why: <one or two plain sentences on why this exists>
 * @param {Type} paramName - What it means and any constraints.
 * @returns {Type} What is returned and what it represents.
 * @throws {ErrorType} When and why this can throw.
 * @example
 * const result = await someFunction(arg1, arg2);
 */
```

- **`Why:` is one or two plain sentences** on why the code exists, not a restatement of what it
  does.
- **Keep these out of JSDoc:**
  - business decisions and rule explanations, including `D-xx` references (they live in
    `FastSport_BackEnd/docs/DECISIONS.md`);
  - porting history ("ported from…", "the old app did…");
  - contract notes, commit hashes and "planned until…" remarks;
  - multi-sentence essays.
- `@throws` is only needed where the function can throw or reject.
- `@example` must be a realistic call.
- When you touch existing code, bring its JSDoc in line with these rules.

### Style: match what's already here

- Plain JavaScript for now (TypeScript is a later phase). React function components with hooks.
- ESLint (flat config, `eslint.config.mjs`) and Prettier (`.prettierrc.json`, 100 columns) are enforced. Run `npm run lint` and `npm run format` (or `npm run check`) before committing. Don't disable a lint rule to get past it; fix the code, or report the rule if it fires on many legitimate cases.
- New route files in `src/pages/` stay thin: put the page component in a feature folder and re-export it as default.
- Tailwind for layout. MUI for complex, accessible controls (dialogs, drawers, sliders), imported
  per module by path, using the shared theme. Reuse `src/theme/tokens.js`; no CSS Modules or
  styled-components.
- 2-space indentation, single quotes, semicolons (Prettier does this).
- Dependencies are pinned to exact versions (no `^`); `.nvmrc` and `engines` set Node 24.

### Dependencies

Don't add an npm dependency without saying so in the commit message, and check its latest stable
version online. Flag any major-version upgrade before doing it.

### User-facing errors

Never render `err.message`, error codes, stack text or URLs. Use
`toUserMessage(err, fallback)`. It shows the backend's `detail` for 4xx problems (the contract
says it's safe to show users) and a generic sentence for 5xx. Show per-field validation errors
with `getFieldErrors(err)` from `src/lib/apiClient.js`. Never log user or profile objects.

### No double submits

- Every button or form that calls the backend, or changes important state, goes through `useSingleFlight` (`src/lib/useSingleFlight.js`).
  - It blocks a second click synchronously, before React re-renders.
  - It exposes `pending`, so the button can be disabled and show a busy label.
  - Use `holdOnSuccess` for actions that navigate away (login, the PayFast hand-off).
- Effects that send a request on mount need a ref guard, so they fire once under StrictMode.
- New actions need a test that triggers them twice quickly and asserts one API call.

### No duplicate code

Before writing a helper, constant, status map or component, grep for an existing one and reuse
it. When two places share logic, extract one module (`src/lib/` for shared logic, `src/components/` for shared UI, or the feature folder when only one feature uses it) and
make both use it. UI component dedupe is coordinated with the Codex styling session: extract the
logic, don't restyle.

### Tests

Add or update Vitest tests with every logic change (next to the code, as `*.test.js`). Mock `next/router` and `lib/api/*` in page tests. Stub `fetch` for `lib/api` and
`apiClient` tests. `npm run check` (lint, format check, tests) and `npm run build` must pass before you commit.

## Backend API rules for agents

- **All backend calls go through `src/lib/apiClient.js` → `src/lib/api/<domain>.js`.** Pages and
  components never call `fetch` against the API directly, and never import `firebase/*` in new
  code.
- Keep the export names and return shapes that pages already use when you port a
  `firestoreHelpers` function; adapt the API shape in `src/lib/api/*` (see `toClientProduct`).
- The backend is authoritative for money, stock, status, roles and approvals. The client only
  displays values the API returns (for example `effectivePriceCents`) and never computes prices
  or totals to send to the server.
- Auth and email-link endpoints pass `retryOnUnauthorized: false` so a 401 never triggers a
  refresh loop.
- Never persist private API data (profile, seller profile, orders, refunds) to localStorage or
  IndexedDB. Only the cart lives in localStorage.
- Adding a field you need: ask the backend session (SendMessage to "backend") to add it to the
  contract. Don't work around a missing field on the client.

## Security rules for agents

- Never trust the client for money, stock, status or roles; the backend decides.
- The session cookies are httpOnly; don't try to read them. Every state-changing request must
  carry the `X-Requested-With: FastSport` header, which `apiClient` adds automatically.
- Never put a secret in a `NEXT_PUBLIC_*` variable, and never commit `.env*` files.
- **Never open, print or otherwise surface the contents of `.env.local`** (or any `.env*` other
  than `.env.example`), whether in conversation, in a file you write, or in command output. Use
  `.env.example` for variable names.
- Render API text as plain text. Content bodies (About, FAQ) interpret only `**bold**`; never use
  `dangerouslySetInnerHTML`.
- `returnTo` values for Google sign-in must be relative paths (`getGoogleSignInUrl` enforces
  this).
- Never log tokens, emails or user objects.

## Agent sessions and communication

- Three Claude sessions work in parallel: **"client"** (this repo), **"admin"**
  (`FastSport_Admin`) and **"backend"** (`FastSport_BackEnd`). Each edits only its own repo.
- They coordinate through SendMessage using those names. Relay any cross-repo requirement from
  the user to the sessions it affects.
- Ask for missing API fields or behaviour from "backend". Ask "admin" about admin features. Never
  edit another repo.
- In local development, email goes to the backend's log, so ask "backend" for verification and
  password-reset links.
- **When you're unsure what the user wants, ask rather than assume**, especially around
  payments, pricing, order status or security-sensitive behaviour. Business-rule questions belong
  in `FastSport_BackEnd/docs/DECISIONS.md`, for the business to answer.

## Workflow for agents

1. Read `docs/TECH_DEBT.md` and `docs/expansion/AUDIT.md` before starting.
2. Log anything unrelated that you find in `docs/TECH_DEBT.md` with the next free ID (`PERF-`,
   `SEC-`, `BUG-`, `ARCH-`, `DX-`, `DOS-`, `LEGAL-`), rather than silently fixing it.
   - Tables are ordered by severity. IDs are never reused.
   - A fixed row is deleted and recorded in the `## Fixed log` with its commit hash.
3. **Verify UI changes in the browser; don't assert from reading code.** Use the Playwright MCP
   server (`.mcp.json`) against a dev server pointed at the local backend, and say exactly what
   you verified. Create your own clearly named test data, and don't modify others' records.
4. **Commits:**
   - Commit on `dev`, in logical chunks, as the repo owner's git identity only.
   - **Never add a `Co-Authored-By` line or any AI attribution.**
   - Taylor pushes; tell him which commits are ready.
   - Don't stash or rewrite history.
5. Commit message style: a short plain-English summary, with no `feat:`/`fix:` prefixes and no
   ticket numbers. Examples: `Catalog reads from FastSport backend: ...`, `Quantity fix`.
6. Coordinate with the other sessions through messages. Each session edits only its own repo.
   Relay the user's cross-repo requirements to the others.
7. Subagents: this session may use up to 3 Sonnet subagents.

## Domain glossary (backend contract)

- **Categories:** API keys are `gear`, `parts` and `accessories`. Labels, URLs and filters use
  `Gear`, `Parts` and `Accessories`. `CATEGORY_LABELS` and `toCategoryKey` in
  `src/lib/api/catalog.js` convert between them.
- **Conditions:** `new_in_packaging`, `lightly_used`, `used_good`, `used`. Display labels come
  from `conditionLabel` or `/catalog/config`.
- **Product statuses:** `listed`, `pending_review`, `sold_out` and `removed`. Public endpoints
  return only `listed` and `sold_out`.
- **Prices:** `basePriceCents` is the listed price. `effectivePriceCents` is what the buyer pays
  now, with any special applied (D-01). Show `basePrice` struck through when `isSpecialActive`
  is true.
- **Roles:** `role` plus `permissions[]` come from `/me` (see D-20). Selling depends on `canSell`,
  which only the backend sets (D-03). Admins follow normal buyer and seller rules in the shop
  (D-02).
- **Terms:** `/me` reports `termsReacceptRequired` and `sellerTermsReacceptRequired`. Accept with
  the versions in `src/features/auth/termsVersions.js`.

## Pointers

- `docs/expansion/PLAN.md` and `docs/expansion/AUDIT.md`: the plan and where we are.
- `docs/TECH_DEBT.md`: the issue register. Many Firestore-era rows move to the backend or close
  as pages are ported.
- `docs/LEGAL_COMPLIANCE.md`: legal requirements and the PayFast go-live checklist.
- `FastSport_BackEnd/docs/DECISIONS.md`, `DATABASE.md` and `openapi/openapi.json`: business
  rules, schema and contract.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
