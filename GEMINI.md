@./AGENTS.md

---

## Gemini-specific notes

### Playwright MCP

This project ships a Playwright MCP server for browser-driven verification (E2E checks,
screenshots of the PWA). **Gemini reads it from [`.gemini/settings.json`](.gemini/settings.json)**
(the `mcpServers` block). It starts when Gemini loads the project.

> Configuration location differs by agent: Gemini uses `.gemini/settings.json`; Claude uses
> `.mcp.json` at the repo root (see CLAUDE.md). The server definition is the same
> (`npx @playwright/mcp@latest`) — keep both files in sync if you change it.

Use it to drive the running app (`npm run dev --workspace web` against the emulators) for the
manual verification steps in each `plan.md` checkpoint. It does **not** replace the
Vitest/emulator unit and integration tests that every task requires — write those first (TDD).
