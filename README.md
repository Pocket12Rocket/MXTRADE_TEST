# Fast Sport: storefront (client)

The buyer and seller web shop for Fast Sport, a South African marketplace for dirt-bike gear,
parts and accessories. It's built with Next.js (Pages Router), React, Tailwind and MUI.

Fast Sport is split into three repositories:

| Repo | What it is |
|---|---|
| **MXTRADE_TEST** (this repo) | The storefront: browse, search, product pages, cart, checkout, profiles and seller listings |
| FastSport_Admin | The admin app: moderation, pricing, orders, refunds and content |
| FastSport_BackEnd | The API: Express, TypeScript and PostgreSQL. It handles auth, business logic, images, email and PayFast |

This app holds no business logic of its own. It calls the backend API over cookie-based
sessions.

> **Status:** pre-launch. The move off Firebase is in progress on the `dev` branch; `master` is
> the old Firebase version. See [docs/expansion/AUDIT.md](docs/expansion/AUDIT.md) for which
> pages are migrated.

## Requirements

- Node.js 24 LTS
- The FastSport backend running locally (see the `FastSport_BackEnd` README). By default it
  serves `http://localhost:4000/v1`.

## Getting started

```bash
npm install
cp .env.example .env.local   # then set NEXT_PUBLIC_API_URL=http://localhost:4000/v1
npm run dev                  # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` / `npm run test:watch` | Vitest unit and component tests |

## Configuration

`NEXT_PUBLIC_*` values are compiled into the browser bundle, so they must never contain secrets.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL including the version, for example `https://api.fastsport.co.za/v1` |
| `NEXT_PUBLIC_SITE_URL` | This site's public URL |
| `NEXT_PUBLIC_BRAND_LOGO` | Optional logo path override |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Optional WhatsApp contact number |

The Firebase variables in `.env.example` are only used by pages that haven't been migrated yet.

## Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.fastsport.co.za/v1 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://fastsport.co.za \
  -t fastsport-client .
docker run -p 3000:3000 fastsport-client
```

The image is a Next.js standalone build on `node:24-alpine`. It runs as a non-root user and has a
health check. It's kept for later deployment; for now the project runs locally only.

## How it works

- **API access:** everything goes through `lib/apiClient.js` and `lib/api/*`. That layer sends
  the session cookies and the CSRF header, refreshes an expired session once, and turns
  RFC 9457 error responses into friendly messages.
- **Sessions:** `lib/AuthContext.js` loads the signed-in user from `GET /v1/me`.
- **Images:** every upload is cropped in the browser first, with `components/ImageCropDialog.js`
  (4:3 for listings, square for avatars). The backend stores them as WebP.

## Documentation

- [AGENTS.md](AGENTS.md): conventions and rules for contributors and AI agents
- [docs/expansion/PLAN.md](docs/expansion/PLAN.md): the migration plan
- [docs/TECH_DEBT.md](docs/TECH_DEBT.md): known issues
- [docs/LEGAL_COMPLIANCE.md](docs/LEGAL_COMPLIANCE.md): legal and PayFast go-live checklist
