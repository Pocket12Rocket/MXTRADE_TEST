# CLAUDE.md

Read and follow [AGENTS.md](./AGENTS.md) — it is the source of truth for this repo (project
summary, repo structure, commands, coding conventions, JSDoc format, Firebase data rules,
security rules, and workflow). Everything below is Claude-specific, in addition to it.

- Use the Playwright MCP server (configured in `.mcp.json`) against the running `npm run dev`
  server to verify UI changes in the browser — don't just assert a change works from reading code.
- Log anything you find unrelated to your current task in `docs/TECH_DEBT.md` with the next
  available ID, instead of fixing it silently or ignoring it.
- Never open, print, or otherwise surface the contents of `.env.local` in this conversation, in a
  file you write, or in a command's output. Use `.env.example` (and, for what's deployed,
  `apphosting.yaml` variable *names*) if you need to know what a variable is called.
- Do not commit, push, stage, or stash — the repo owner commits. Give a suggested commit message
  instead (see AGENTS.md for the style this repo uses).
- When you're unsure what the user actually wants — especially around payments, pricing, order
  status, or security-sensitive behavior — ask rather than assume.
