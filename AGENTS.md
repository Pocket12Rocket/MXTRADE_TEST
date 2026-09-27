# AGENTS.md: Fast Sport client (MXTRADE_TEST)

This is the single source of truth for any AI coding agent (Claude, Codex, ...) or human
contributor working in this repository. `CLAUDE.md` only points here. If you're an AI agent, read
this whole document before making changes.

## Current state: pre-launch, migrating off Firebase

The app is **not live** and is being split into three repos, each owned by its own Claude
session:

| Repo | Owner session | Role |
|---|---|---|
| `MXTRADE_TEST` (this repo) | client | Buyer and seller storefront only (Next.js) |
| `FastSport_Admin` | admin | All admin screens (Vite, React and MUI) |
| `FastSport_BackEnd` | backend | Express, TypeScript and PostgreSQL API. It owns auth, business logic, files, email and the API contract |

- **The plan and progress:** [docs/expansion/PLAN.md](docs/expansion/PLAN.md) and
  [docs/expansion/AUDIT.md](docs/expansion/AUDIT.md). Update AUDIT.md whenever a step moves.
- **Business rules:** `FastSport_BackEnd/docs/DECISIONS.md` (D-01 onwards). Tyron (business) is
  answering them. Until an item is decided, its "Recommended" option applies.
- **Branching:**
  - Migration work happens on **`dev`**.
  - `master` still runs the old Firebase app, and stays that way until `dev` reaches parity.
  - On `dev`, pages whose backend endpoints don't exist yet still call Firestore through
    `lib/firestoreHelpers.js`. They are expected to be broken until they are ported.
- **Admin code does not belong here.** Every admin feature lives in `FastSport_Admin`. Don't add
  admin screens, admin routes or role bypasses to this repo.
- PayFast is sandbox-only and test data can be reset at any time. Don't treat anything you read
  as real orders, payments or customers.
- **Concurrent editors:** a separate Codex session owns UI *styling* (Tailwind classNames,
  layout, sizing) in `components/` and `pages/`. Claude sessions own *logic*.
  - Never revert or "fix" styling-only diffs you didn't make.
  - Re-read a file right before editing it, and make small targeted edits.
  - `.playwright-ui-review/` is that session's screenshot output; leave it alone.

## Priorities

1. Finish moving every page from Firebase to the backend API (`lib/api/*`), fixing known bugs
   during the port rather than copying them across.
2. Performance (page load, time-to-content). Let the backend's HTTP caching (`Cache-Control` and
   `ETag`) do the caching; don't add client-side persistent caches of API data.
3. Everything else, unless it's a launch blocker (docs/TECH_DEBT.md, docs/LEGAL_COMPLIANCE.md).

## Project summary

- **Framework:** Next.js 16 (Pages Router, Turbopack), fully client-rendered (no
  `getServerSideProps`/`getStaticProps`). `output: 'standalone'` is set for Docker.
- **UI:** React 19 function components, Tailwind CSS 3 plus a shared MUI theme
  (`themes/muiTheme.js`, `themes/tokens.js`). Image cropping uses `react-easy-crop`.
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
- **Tests:** Vitest with jsdom and React Testing Library (`tests/`). Playwright (MCP) is used for
  in-browser checks.

## Repo structure

```
pages/                      Next.js Pages Router; every file is a route (client-rendered)
  _app.js, _document.js     App shell: MUI theme, AuthProvider, CartProvider, Layout
  index.js                  Home carousels: GET /products/popular and /products/new?category=
  shop/catalog.js           Search and browse: server-side filters, sort and cursor "Load more"
  shop.js, shop/*.js        Shop landing and thin redirects to the catalog
  product/[id].js           Product detail and view tracking
  login.js                  Login, register, Google redirect, forgot password, resend verification
  verify-email.js           Landing page for the email verification link
  reset-password.js         Landing page for the password reset link
  profile.js                Profile, avatar (square crop), terms, seller onboarding (partly on Firebase)
  profile/orders*, profile/orders/[orderId]/*   Orders and refund request (still on Firebase)
  seller/*                  Seller dashboard, submit and submissions with 4:3 cropping (still on Firebase)
  checkout.js, order/confirmation.js            Checkout and PayFast return (still on Firebase)
  about.js, faq.js, contact.js                  Content pages (contact still uses the old API route)
  api/                      LEGACY Firebase API routes; each is deleted as the backend takes it over
components/
  Header.js, Layout.js, MobileNavigationDrawer.js, CartDrawer.js, ProductCard.js,
  CarouselControl.js, CategoryTabs.js, TermsAndConditionsModal.js
  ImageCropDialog.js        react-easy-crop dialog used for every image upload
  TermsReacceptGate.js      Blocks the site until changed terms are re-accepted (/me flag)
lib/
  apiClient.js              THE only place that calls the backend with fetch: cookies, CSRF
                            header, refresh on AUTH_TOKEN_EXPIRED, RFC 9457 parsing
  api/auth.js               Auth endpoints and /me
  api/catalog.js            Catalog and content endpoints, plus toClientProduct() (the adapter
                            from the API shape to the page shape)
  AuthContext.js, useAuth.js  Shared session state from GET /me (user, profile, signOut, ...)
  userMessage.js            toUserMessage() and UserFacingError; the only way errors reach the UI
  cropImage.js, useImageCropQueue.js   Crop maths and encoding, and the multi-file crop queue
  termsVersions.js          Terms versions the modal displays (must match the backend)
  cartContext.js            Cart in localStorage, keyed per user id
  firestoreHelpers.js, firebase*.js, publicCache.js, catalogVersions.js, server/, emails.js,
  apiRateLimit.js           LEGACY Firebase code, deleted once nothing imports it
tests/                      Vitest suites (lib/, components/, pages/) and setup.js
docs/expansion/             Cross-repo plan and progress audit
docs/TECH_DEBT.md           Issue register (read before starting work)
Dockerfile, .dockerignore   Standalone image for later deployment (not used locally)
```

**Oddities:** `MXTRADE_TEST/` at the root is an empty, orphaned gitlink (TECH_DEBT DX-05); leave
it alone. `.agents/` and `skills-lock.json` are tool reference docs, not app code.
`.github/workflows/static.yml` publishes the whole repo to GitHub Pages; that is an open decision
in AUDIT.md.

## Commands and setup

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` | Production (standalone) build |
| `npm test` | Vitest, run once |
| `npm run test:watch` | Vitest in watch mode |

**Environment:** copy `.env.example` to `.env.local`. For the migrated pages, the client needs
only `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BRAND_LOGO` and
`NEXT_PUBLIC_WHATSAPP_NUMBER`. The Firebase variables remain only for the legacy pages. Never open,
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

Every new or modified function, hook and component must have a full JSDoc block:

```js
/**
 * Why: <the reason this exists: what problem it solves or what depends on it,
 * NOT a restatement of what the code does>
 * @param {Type} paramName - What it means and any constraints.
 * @returns {Type} What is returned and what it represents.
 * @throws {ErrorType} When and why this can throw.
 * @example
 * const result = await someFunction(arg1, arg2);
 */
```

`@throws` is only needed where the function can throw or reject. `@example` must be a realistic
call. When you touch existing code that lacks this, back-fill it. See `lib/api/catalog.js` for
reference examples.

### Style: match what's already here

- Plain JavaScript (no TypeScript). React function components with hooks.
- Tailwind for layout. MUI for complex, accessible controls (dialogs, drawers, sliders), imported
  per module by path, using the shared theme. Reuse `themes/tokens.js`; no CSS Modules or
  styled-components.
- 2-space indentation, single quotes, semicolons.

### Dependencies

Don't add an npm dependency without saying so in the commit message, and check its latest stable
version online. Flag any major-version upgrade before doing it.

### User-facing errors

Never render `err.message`, error codes, stack text or URLs. Use
`toUserMessage(err, fallback)`. It shows the backend's `detail` for 4xx problems (the contract
says it's safe to show users) and a generic sentence for 5xx. Show per-field validation errors
with `getFieldErrors(err)` from `lib/apiClient.js`. Never log user or profile objects.

### No duplicate code

Before writing a helper, constant, status map or component, grep for an existing one and reuse
it. When two places share logic, extract one module (`lib/` for logic, `components/` for UI) and
make both use it. UI component dedupe is coordinated with the Codex styling session: extract the
logic, don't restyle.

### Tests

Add or update Vitest tests with every logic change (`tests/lib`, `tests/components`,
`tests/pages`). Mock `next/router` and `lib/api/*` in page tests. Stub `fetch` for `lib/api` and
`apiClient` tests. `npm test` and `npm run build` must pass before you commit.

## Backend API rules for agents

- **All backend calls go through `lib/apiClient.js` → `lib/api/<domain>.js`.** Pages and
  components never call `fetch` against the API directly, and never import `firebase/*` in new
  code.
- Keep the export names and return shapes that pages already use when you port a
  `firestoreHelpers` function; adapt the API shape in `lib/api/*` (see `toClientProduct`).
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
7. Subagents: this session may use up to 2 Sonnet subagents.

## Domain glossary (backend contract)

- **Categories:** API keys are `gear`, `parts` and `accessories`. Labels, URLs and filters use
  `Gear`, `Parts` and `Accessories`. `CATEGORY_LABELS` and `toCategoryKey` in
  `lib/api/catalog.js` convert between them.
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
  the versions in `lib/termsVersions.js`.

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
