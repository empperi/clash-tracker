@./AGENTS.md

---

## Claude-specific notes

### Playwright MCP

This project ships a Playwright MCP server for browser-driven verification (E2E checks,
screenshots of the PWA). **Claude Code reads it from [`.mcp.json`](.mcp.json)** at the repo
root (project-scoped `mcpServers`). It starts automatically when you open the project; tools
appear as `mcp__playwright__*`.

> Configuration location differs by agent: Claude uses `.mcp.json`; Gemini uses
> `.gemini/settings.json` (see GEMINI.md). Keep both in sync if you change the server.

Use it to drive the running app (`npm run dev --workspace web` against the emulators) for
manual/automated verification steps — it does **not** replace the Vitest/emulator unit and
integration tests that every task requires.
