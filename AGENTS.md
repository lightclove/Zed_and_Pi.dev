# Project conventions

## Workflow (token-efficient by default)

- Explore before editing: use `find`, `grep`, and `ls` to locate code, then `read` only the
  relevant ranges (pass `offset`/`limit`). Never dump whole files or the whole repo into context.
- Prefer the `edit` tool with small, targeted `oldText` matches over rewriting files with `write`.
- Run cheap, fast checks (typecheck, one failing test) before running the full suite.
- One logical change per turn. Commit working states frequently.

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
