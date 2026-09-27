# CLAUDE.md

Read and follow [AGENTS.md](./AGENTS.md). It is the source of truth for this repo: project
summary, the three-repo split, structure, commands, conventions, backend API rules, security and
workflow. Everything below is Claude-specific, in addition to it.

- This session is **"client"**. The other Claude sessions are **"admin"** (`FastSport_Admin`) and
  **"backend"** (`FastSport_BackEnd`). Talk to them with SendMessage, and edit only this repo.
- Use the Playwright MCP server (`.mcp.json`) against a running dev server pointed at the local
  backend to verify UI changes in the browser. Don't just assert that a change works from
  reading code.
- Log anything unrelated that you find in `docs/TECH_DEBT.md` with the next available ID, rather
  than fixing it silently or ignoring it. Keep `docs/expansion/AUDIT.md` current.
- Never open, print or otherwise surface the contents of `.env.local` (or any `.env*` other than
  `.env.example`), whether in conversation, in a file you write, or in command output.
- Commit on `dev` as the repo owner only. **Never add a `Co-Authored-By` line or any Claude
  attribution.** Taylor pushes.
- When you're unsure what the user actually wants, ask rather than assume, especially around
  payments, pricing, order status or security-sensitive behaviour. Business rules go in the
  backend's `docs/DECISIONS.md`.
