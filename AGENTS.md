# Project conventions

## Workflow (token-efficient by default)

- Explore before editing: use `find`, `grep`, and `ls` to locate code, then `read` only the
  relevant ranges (pass `offset`/`limit`). Never dump whole files or the whole repo into context.
- Prefer the `edit` tool with small, targeted `oldText` matches over rewriting files with `write`.
- Run cheap, fast checks (typecheck, one failing test) before running the full suite.
- One logical change per turn. Commit working states frequently.

## Engineering principles (Hamilton + Akin)

Full set + source quotes: skill `engineering-principles` (`.pi/skills/engineering-principles/`).

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

## Model usage (DeepSeek)

- `deepseek-flash` is the default workhorse: cheapest input/output and automatic context caching.
- Escalate to `deepseek-v4-pro` (or `/model deepseek/auto` + high thinking) only for hard
  architecture, subtle debugging, or security-sensitive reasoning.
- Keep the thinking level low for routine edits: reasoning tokens are billed as output and stay
  in the conversation context.

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
