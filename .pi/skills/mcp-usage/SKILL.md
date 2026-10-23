---
name: mcp-usage
description: Token-efficient MCP usage in pi — pick the right exposure (direct/deferred/codemode), discover deferred tools via tool_search, batch uniform calls in codemode, prefer skills/CLI for narrow ops. Use when wiring a new MCP server, choosing between skill/CLI/MCP for a capability, or planning bulk MCP calls.
---

# MCP usage (token-efficient)

Full rationale, numbers, and sources: `references/mcp-economics.md`.
Rules below are the compressed, actionable version.

## Decision: how to give the agent a capability

| Need | Cheapest correct option | Cost until first use |
|---|---|---|
| Narrow frequent op (read issue, grep repo, internal API) | skill / CLI script / small tool + README | ≈ 0 tokens — nothing declared to the model |
| External ecosystem (browser, DB, GitHub/Linear/Jira) | MCP server, `exposure: deferred` | 1 line in the `mcp_servers` prompt section |
| Small always-needed tool set | MCP server, `exposure: direct` | full schemas of that set — keep it small |
| Many uniform calls (dozens of records) | one codemode script batching MCP/CLI calls | only the final reduced result |

## Rules

1. **New capability → cheapest option first** (A13/YAGNI). Anything narrow and frequent is a
   skill or CLI script. Add an MCP server only for an ecosystem you cannot cover with scripts.
2. **Exposure is a cost decision.** Default `deferred`. `direct` only for small, always-needed
   sets; `codemode` when scripts should combine/filter calls; `toolExposure` to override single
   tools (e.g. `delete_*: hidden`). Never `direct` for a large server — its full schemas land
   in the system prompt.
3. **Deferred tools are invisible until found.** Call `tool_search` for the capability you need
   before calling any `mcp__*` tool; never invent tool names. Loaded tools stay declared on the
   branch — don't re-search for them there.
4. **Bulk = codemode.** For N > 1 uniform calls, write one codemode script with
   `Promise.allSettled` and return a reduced result. Direct text results > 20 KB reach the model
   middle-truncated anyway; a script receives the full result and can shrink it first.
5. **Every MCP call is a delegated call** (A2). Check `isError` — it is reported as an error for
   direct calls but *resolves* inside scripts, so check it there explicitly. Handle timeout and
   disconnected servers; a failed call is never passed off as success.
6. **Numbers, not opinions** (A1). If MCP feels expensive or "not fully used", measure the
   session with `tools/pi-cost` instead of guessing.
7. **Stable toolset = warm cache.** Don't flip exposure or server modes mid-session: a stable
   prompt + tool set keeps the DeepSeek prefix cache hot (cache hit ≈ 30–50× cheaper than miss).

## Checklist: wiring a new MCP server

- [ ] Narrow op already covered by a skill/CLI/extension? → no server needed (rule 1).
- [ ] `exposure: deferred` (or `codemode` for batchable); `direct` only for small sets (rule 2).
- [ ] One-sentence `description` in `mcp.json` — `tool_search` ranks tools by it (rule 3).
- [ ] `enabled: false` for servers not ready in every environment (noise ≠ safety).
- [ ] Secrets only via `${ENV_VAR}` — never committed.
- [ ] Verified outside: `pi mcp list` → `connected, N tools`.
- [ ] Verified inside pi: `tool_search` finds the new tools before the first real use.
