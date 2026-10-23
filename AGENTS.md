# Project conventions

## Workflow (token-efficient by default)

- Explore before editing: use `find`, `grep`, and `ls` to locate code, then `read` only the
  relevant ranges (pass `offset`/`limit`). Never dump whole files or the whole repo into context.
- Prefer the `edit` tool with small, targeted `oldText` matches over rewriting files with `write`.
- Run cheap, fast checks (typecheck, one failing test) before running the full suite.
- One logical change per turn. Commit working states frequently.

## Engineering principles (Hamilton + Akin)

Full set + sources: skill `engineering-principles` (`.pi/skills/engineering-principles/`).

- **Detect errors at the earliest possible point** (Hamilton): cheap checks before expensive
  ones; validate inputs at every boundary — never silently default or coerce on invalid input.
- **Design to operate when some things are wrong** (Akin 2): every delegated call needs an
  error path; failures, truncation, and aborts must be reported loudly, never passed off as success.
- **Numbers, not opinions** (Akin 1): decisions are backed by measurements (`pi-cost`, usage,
  test results). Estimates are allowed only if marked as such and revisited (Akin 10).
- **Errors migrate to interfaces** (Hamilton, Shea 15): define the contract before the
  implementation; validate at the boundary.
- **Don't build better than requirements dictate** (Akin 13/14): YAGNI; "better" is the enemy
  of "good" — ship when checks pass.
- **Verify extraordinary claims** (Akin 19): sanity-check sub-agent/model answers before
  passing them through; previous analysis is not truth (Akin 16).
- **When in doubt, document** (Akin 22): record decisions, assumptions, and numbers.

## Fact-check gate (every reply, 100%)

Every reply passes this gate before being sent. Classify each factual claim (paths, numbers,
dates, prices, quotes, "X is present/absent in Y", "I verified/checked") into exactly one of:

- **Proven** — backed by a command/output shown in the reply itself (command + result, or
  file:line reference).
- **Unverified** — no direct evidence; must be labeled inline `[не проверено]` / `[assumption]`.

Hard rules:

1. Never present an unverified claim as proven. Run the cheap check (`grep`, `ls`, `read`)
   before asserting (H1). "I verified it" without showing the check is a violation.
2. No invented numbers, quotes, prices, paths, or dates. A number without a source is an
   estimate — say so explicitly.
3. A check that found nothing is reported literally ("`grep X` → 0 matches"), never
   paraphrased as "checked, fine".
4. Extraordinary claims get a sanity check before leaving the reply (A19); previous analysis
   is not truth — re-verify before passing through (A16).
5. Verification-heavy turns (cross-file consistency audits, fact-checking) — escalate to
   `deepseek-v4-pro`; flash is for routine edits.
6. Every reply ends with a one-line footer: `Fact-check: <n> proven / <m> unverified / <k>
   checks run this turn`. No footer = gate skipped = failure.

## Model usage (DeepSeek)

- `deepseek-flash` is the default workhorse: cheapest input/output and automatic context caching.
- Escalate to `deepseek-v4-pro` (or `/model deepseek/auto` + high thinking) only for hard
  architecture, subtle debugging, or security-sensitive reasoning.
- Keep the thinking level low for routine edits: reasoning tokens are billed as output and stay
  in the conversation context.

## MCP usage (token-efficient)

Full rationale + sources: skill `mcp-usage` (`.pi/skills/mcp-usage/`).

- **New capability → cheapest option first** (A13): skill / CLI script / small tool with README;
  MCP only for external ecosystems (browser, DB, GitHub/Jira).
- **Exposure is a cost decision**: default `deferred`; `direct` only for small always-on sets;
  `codemode` for batchable servers. Never `direct` for a large server — full schemas bloat the
  system prompt.
- **Deferred tools are invisible until found**: call `tool_search` before any `mcp__*` tool;
  never invent tool names.
- **Bulk = codemode**: N > 1 uniform calls → one script with `Promise.allSettled`, reduced final
  result (direct text > 20 KB is middle-truncated anyway).
- **Every MCP call is a delegated call** (A2): check `isError` (resolves inside scripts!), handle
  timeout/disconnect; a failed call is never success.
- **Numbers, not opinions** (A1): "MCP is expensive/underused" → measure with `pi-cost` first.

## Secrets (non-negotiable)

Full evidence + measured limits: skill `secret-leak-guard` (`.pi/skills/secret-leak-guard/`).

**Read = sent.** Anything that enters the transcript is already at the provider; redaction
is a backstop, never a guarantee.

- **Never read or print secrets on purpose**: no `cat .env`, `env`/`printenv`, `echo $TOKEN`,
  `base64` of a secret file, `kubectl get secret -o yaml`.
- **`.gitignore` is layer 1** — verify with `git check-ignore -v <path>`, don't assume.
- **`pi-heimdall` guards are a speed bump, not a boundary** (measured: multi-line base64
  leaks past `secret-guard`). Install it; never rely on it.
- **gitleaks pre-commit gate is authoritative**: `gitleaks git --staged`. A missing scanner
  blocks the commit — never treated as a pass.
- **A gate that never caught a planted secret is untested.** Plant one, run it, revert.
- **Secret leaked → say it, then rotate the credential.** History rewriting does not
  un-send data.

## Hygiene

- Keep the system prompt and tool set stable during a session so DeepSeek's automatic prefix
  cache stays warm (cache hits are ~30-50x cheaper than misses).
- Review tool output before trusting destructive commands.
- Do not commit secrets or `auth.json`.

## Tools

- `tools/pi-cost/pi-cost.mjs` — отчёт по токенам/стоимости сессий:
  `node tools/pi-cost/pi-cost.mjs [paths...] [flags]` (по умолчанию все сессии `~/.pi/agent/sessions`).
  - `--today` — только сессии за сегодня; `--last N` — за последние N дней.
  - `--top N` — топ-N сессий по стоимости; `--json` — машинночитаемый вывод.
  - Пример: `node tools/pi-cost/pi-cost.mjs --last 7 --top 5`.
