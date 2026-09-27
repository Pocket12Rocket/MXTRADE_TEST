# Expansion audit: where we are

This log tracks progress on [PLAN.md](./PLAN.md). Update it whenever a step moves. Newest entries go at the top of each log.

Status key: `Done`, `In progress`, `Blocked (reason)`, `Not started`.

## Client repo (MXTRADE_TEST), owned by the client session
| Step | Item | Status | Evidence / notes |
|---|---|---|---|
| 0 | Decisions doc handed to backend | Done | Committed by backend as `FastSport_BackEnd/docs/DECISIONS.md` (`cc4dfab`). D-20 (role types) requested |
| 0 | Client API needs sent to backend | Done | Backend replied with the domain, cookie, CSRF, OpenAPI and endpoint order |
| 0 | Admin handover sent to admin | Done | Admin confirmed; porting is under way |
| 1 | Remove admin code from client | Blocked (waiting for the admin session to confirm each feature is ported) | Admin has ported: scaffold, auth, dashboard. In progress: submissions, products and pricing, refunds, sales kanban, late payments, About, FAQs, seed |
| 2 | `lib/apiClient.js` (cookies, CSRF header, refresh on `AUTH_TOKEN_EXPIRED`, RFC 9457) | Done | Commits `e6caa5b`; Vitest `tests/lib/apiClient.test.js` |
| 2 | `toUserMessage` handles backend problems | Done | Vitest `tests/lib/userMessage.test.js` |
| 2 | Image cropper (4:3 listings, 1:1 avatar) wired into submit, edit and profile | Done | `components/ImageCropDialog.js`, `lib/cropImage.js`, `lib/useImageCropQueue.js`; Vitest tests. Build passes. Playwright check on 2026-09-27 found no runtime errors on `/profile`, `/seller/submit` and the `/seller/submissions` edit form. A full crop-and-upload run is pending the backend's uploads |
| 2 | AuthContext and login, register, verify, reset and Google pages on the backend | Blocked (waiting for the backend auth milestone) | `/me` returns `id`, not `uid` |
| 2 | Catalog, profile, submissions, orders, refunds and contact on the backend | Blocked (waiting for the backend milestones in order) | |
| 2 | Delete Firebase code, rules, config and dependencies | Not started | After every helper has been replaced |
| 3 | Standalone output and Dockerfile | Done | `npm run build` passes. Docker is not installed on the dev machine, so the image build has not been tested |
| 3 | `next/image` remotePatterns for backend `/files/**` | Done | `e6caa5b` |
| 3 | k3s manifests, dependency upgrades, GitHub Pages workflow decision | Not started | |
| 3 | Vitest setup | Done | `vitest.config.mjs`, `tests/`; `npm test` passes 24 tests across 5 files |
| 4 | Update `AGENTS.md`, `CLAUDE.md` and `README.md` for the new architecture and commit rule | Not started | |

## Backend repo (FastSport_BackEnd), owned by the backend session
| Milestone | Status | Notes |
|---|---|---|
| DECISIONS.md | Done | `cc4dfab` |
| AGENTS.md, CLAUDE.md and README.md | Requested | Taylor flagged these as missing |
| DATABASE.md (schema and ER overview) | Requested | |
| Scaffold (health, problem+json, openapi.json) | Reported in progress | |
| Auth (JWT with role, 15-minute access, 7-day session, Google, verify, reset) and seeded admin | Next | |
| Catalog, then profile, submissions, orders with PayFast, refunds and contact | Not started | |

## Admin repo (FastSport_Admin), owned by the admin session
| Item | Status | Notes |
|---|---|---|
| AGENTS.md, CLAUDE.md and README.md | Done | Per the admin session |
| Scaffold, auth and dashboard | Done | Per the admin session |
| Submissions, products and pricing, refunds, sales kanban, late payments, About, FAQs, seed | In progress | |

## Open questions for Taylor or the business
- All of D-01 to D-20 in `FastSport_BackEnd/docs/DECISIONS.md`.
- DX-05: is the stray `MXTRADE_TEST` gitlink at the repo root accidental?
- Should the GitHub Pages workflow (`.github/workflows/static.yml`), which publishes the whole repo, be removed?

## Change log
- **2026-09-27:**
  - Plan approved.
  - Coordination messages sent.
  - API client, Docker standalone build, cropper and Vitest added to the client.
  - Taylor added these requirements: Vitest, WebP storage, cropping, a JWT role claim with 7-day sessions, a seeded admin user, 2 Sonnet subagents per session, and this `docs/expansion/` folder.
