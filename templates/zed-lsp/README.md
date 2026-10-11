# Zed LSP scaffold

Reusable starter for **Zed language-server (LSP)** configuration, project-level, so it transfers to
any `~/Work` project. Zed auto-detects and auto-downloads language servers; this scaffold pins the
servers, turns on useful LSP features (inlay hints), and fixes formatting/indent per language.

## Where settings live

| Scope | File | Purpose |
|---|---|---|
| Global (this machine) | `~/AppData/Roaming/Zed/settings.json` | personal prefs: theme, fonts, base_keymap, agent models |
| **Project (transferable)** | **`.zed/settings.json`** in the project root | repo-specific: language servers, tab size, formatter, inlay hints |
| Global keybindings | `~/AppData/Roaming/Zed/keymap.json` | custom key bindings (array of context objects) |

Project settings take precedence over user settings for that project only. Open/edit via the
command palette: `zed: open project settings` / `zed: open settings` / `zed: open keymap`.

## Install into a project

1. Copy `settings.json` into the project's `.zed/settings.json`.
2. Edit `languages` — pick the language servers for this project's files (see table below), set
   `tab_size` to match the repo's existing indent.
3. Reload: in Zed, `zed: reload settings` (or restart).
4. Verify: open a `.ts` file → type hints appear (if `inlay_hints.enabled`), `F12` go-to-definition,
   `Shift+F12` references, `F2` rename, `Ctrl+.` code actions (all from `base_keymap: VSCode`; see
   the keybindings list at https://zed.dev/docs/key-bindings).

## Language server selection

Zed's `languages.<Name>.language_servers` is an array; `"..."` = keep the remaining defaults,
`"!name"` = exclude a default. First entry is preferred when several handle the same file.

| Language (`languages` key) | Default server(s) | Notes |
|---|---|---|
| `TypeScript` / `JavaScript` / `TSX` / `JSX` | `vtsls` | alt: `typescript-language-server` (npm) |
| `Python` | `basedpyright` (primary since Zed ≥ 0.204) + `ruff` | needs a Python runtime (uv recommended); `ruff` adds lint + formatting |
| `Rust` | `rust-analyzer` | auto-downloaded; install rustup toolchain for full cargo analysis |
| `SQL` / PostgreSQL | **none** | grammar only (SQL extension); no SQL LSP exists — semantic SQL via the Postgres MCP server; formatting via `sql-formatter` |
| `JSON` / `YAML` / `TOML` | built-in | no config needed |
| `Markdown` | built-in preview | no LSP needed |

Example adding a second server (e.g. Tailwind):

```jsonc
"languages": {
  "TypeScript": { "language_servers": ["vtsls", "tailwindcss-language-server", "..."] }
}
```

Per-server settings go under top-level `lsp`:

```jsonc
"lsp": {
  "tailwindcss-language-server": { "settings": { "experimental": { "classRegex": ["..."] } } }
}
```

## Notes

- **Playwright tests** are plain `.ts` files — covered by `vtsls`/`typescript`, no dedicated LSP
  exists (or is needed). The browser automation itself is the Playwright MCP server
  (`templates/mcp`).
- **SQL has no language server in Zed** (or serena) — the `SQL` block above only configures
  `sql-formatter` with the `postgresql` dialect. Schema/query intelligence = Postgres MCP server.
- **`vtsls` vs `typescript-language-server`:** Zed defaults to `vtsls` (standalone, auto-downloaded,
  no npm needed). Pin `typescript-language-server` only if you need its specific behavior.
- **Inlay hints** (`type_hints`, `parameter_hints`, `value_hints`) are off by default — the scaffold
  enables type hints. Personal preference? Move `inlay_hints` to the *global* settings.json.
- **Not all settings work at project level** — global-only keys (theme, vim_mode, base_keymap) must
  stay in user settings. See https://zed.dev/docs/configuring-zed#project-settings.
- **`format_on_save` / `tab_size`** are the most common per-project knobs; match `tab_size` to the
  repo's existing style (2 here) so formatting doesn't fight the codebase.

## Source of truth

Live copy at the repo root: `.zed/settings.json` (this project: TypeScript/JavaScript via `vtsls`).
