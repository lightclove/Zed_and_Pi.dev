# MCP scaffold (Serena + Playwright + PostgreSQL)

Reusable starter for wiring MCP servers into any pi project under `~/Work`. Three servers,
each optional — copy `mcp.json` into `.pi/mcp.json` and delete the entries you don't need.
All use `exposure: deferred`: tools surface via `tool_search` / `searchTools()` instead of
bloating the base prompt (see "Exposure" at the bottom).

| Server | What it gives | Ready when | LSP side |
|---|---|---|---|
| `serena` | semantic code tools: symbols, references, definitions, search, safe renames | always (uv/uvx, node) | **yes** — its own LSP backend (`serena.project.yml`) |
| `playwright` | real browser automation: navigate, click, fill, snapshot, screenshot | browsers installed (`npx playwright install chromium`) | tests are `.ts` → covered by Zed's `vtsls` / serena `typescript` |
| `postgres` | schema exploration, SQL queries, migrations | a reachable PostgreSQL + `DATABASE_URL` set | **no LSP for SQL exists** — see "PostgreSQL" below |

## Prerequisites

- `uv` / `uvx` (serena), Node.js + npm (all three run via `npx`/`uvx`).
- Playwright: `npx playwright install chromium` (or chrome/msedge channel).
- Postgres: a running server + connection string, e.g.
  `DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"` in your shell profile.

## Serena

Copy `serena.project.yml` into `.serena/project.yml` and set `project_name` +
`language_servers` (see the language table there). Verify:

```bash
pi mcp list                                              # serena: connected, ~22 tools
uvx --from serena-agent serena project health-check .    # LSP backend + symbol tools
```

- `--context ide` trims serena to symbolic + memory tools (pi already has read/edit/grep/find).
- `--project-from-cwd` finds the nearest `.serena/project.yml` from pi's cwd — no hardcoded paths.
- Windows cp1251: `env.PYTHONUTF8=1` keeps stdio UTF-8.
- Gitignore: `.serena/project.local.yml`, `.serena/memories/`, `.serena/logs/`.

## Playwright

Browser automation tools (`browser_navigate`, `browser_click`, `browser_snapshot`,
`browser_take_screenshot`, ...). Config choices:

- `--headless` — agent-friendly (headed is the server default!).
- `--caps vision` — the model receives screenshots; `--image-responses allow` is default.
- `--file-paths relative` — cleaner paths in results.
- `--output-dir .playwright-mcp` — auto-named screenshots land in the repo → gitignore
  `.playwright-mcp/`.
- No `--isolated` — the profile persists across pi sessions, so logins survive. For one-off
  throwaway runs add `--isolated` (in-memory profile).
- Default browser is chromium (needs `npx playwright install chromium`); use `--browser
  chrome|msedge` for a system channel.

LSP: Playwright Test files are plain TypeScript — no dedicated language server exists, and
none is needed. Zed covers them with `vtsls` and serena with the `typescript` LS.

## PostgreSQL

Official server (`@henkey/postgres-mcp-server`): schema/table exploration, parameterized
read-only queries, safe writes, migrations. The connection string comes from the
`DATABASE_URL` environment variable (expanded by pi), so credentials never land in the
committed config.

- The scaffold ships with `"enabled": false` — set `DATABASE_URL` and flip it on via `/mcp`
  in pi. A server that fails to connect every session start is noise, not safety.
- Secrets stay out of the repo: pi expands `${DATABASE_URL}` in `env` values; define it in
  your shell profile / session environment.
- LSP: **no SQL language server exists in Zed** (the SQL extension is grammar-only) and
  serena has no SQL backend. Semantic SQL work belongs to this MCP server — that *is* the
  LSP-analogue for PostgreSQL. For formatting, Zed supports `sql-formatter` (see
  `templates/zed-lsp/`).

## Install into a project

1. Copy `mcp.json` → `.pi/mcp.json`; drop the servers you don't need; for serena also copy
   `serena.project.yml` → `.serena/project.yml` and edit.
2. Add to `.gitignore`:
   ```gitignore
   .serena/project.local.yml
   .serena/memories/
   .serena/logs/
   .playwright-mcp/
   ```
3. Verify: `pi mcp list` (every enabled server should show `connected`); inside pi `/reload`,
   then `/mcp` for status/enable/disable.

## Exposure

| Mode | When to use |
|---|---|
| `deferred` (used here) | large servers, tools loaded via `tool_search` on demand |
| `codemode` | when scripts should combine/filter calls |
| `direct` | small always-on tool sets |
| `hidden` | registered but unavailable |

## Source of truth

Live copy at the repo root: `.pi/mcp.json` (this project: serena enabled, playwright enabled,
postgres disabled until a database is reachable).
