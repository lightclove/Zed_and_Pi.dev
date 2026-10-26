# Project conventions

This file holds only rules that cannot be inferred from code and must hold in every turn.
Rationale, evidence, and numbers live in skills and their `references/` — read them when the
task matches, don't inline them here (see "Progressive disclosure" at the end).

## Workflow (token-efficient by default)

- Explore before editing: `find`/`grep`/`ls` first, then `read` narrow ranges (`offset`/`limit`).
  Never dump whole files or the whole repo into context.
- Prefer `edit` with small `oldText` matches over rewriting files with `write`.
- Cheap checks (typecheck, one failing test) before the full suite.
- One logical change per turn. Commit working states frequently.

## Fact-check gate (every reply, 100%)

Classify each factual claim (paths, numbers, dates, prices, quotes, "X is present/absent in Y",
"I verified/checked") as exactly one of:

- **Proven** — backed by a command/output shown in the reply itself (command + result, or
  file:line reference).
- **Unverified** — no direct evidence; label inline `[не проверено]` / `[assumption]`.

Rules:

1. Never present an unverified claim as proven. Run the cheap check first (H1); "I verified it"
   without showing the check is a violation.
2. No invented numbers, quotes, prices, paths, or dates. A number without a source is an
   estimate — say so.
3. A check that found nothing is reported literally ("`grep X` → 0 matches"), never paraphrased
   as "checked, fine".
4. Extraordinary claims get a sanity check before leaving the reply (A19); previous analysis is
   not truth — re-verify (A16).
5. Verification-heavy turns (cross-file audits, fact-checking) — escalate to `deepseek-v4-pro`.
6. Every reply ends with: `Fact-check: <n> proven / <m> unverified / <k> checks run this turn`.
   No footer = gate skipped = failure.

## Engineering principles

Cheap checks before expensive (H1); broken things fail loudly, never silently (H2); contract
before code, validate at boundaries (H3); plan before code (H4); step → check → commit (H5);
numbers not opinions (A1); YAGNI — don't build better than requirements dictate (A13); document
decisions and assumptions (A22).

Full lists + mapping to this harness: skill `engineering-principles` (H1–H5, Akin laws).

## Model usage (DeepSeek)

- `deepseek-flash` is the workhorse (cheapest I/O, automatic prefix caching).
- Escalate to `deepseek-v4-pro` only for hard architecture, subtle debugging, security reasoning.
- Keep thinking low for routine edits: reasoning tokens are billed as output and stay in context.

## MCP usage

- **New capability → cheapest option first** (A13): skill / CLI script / small tool. MCP only for
  external ecosystems (DB, GitHub/Jira/Linear, OAuth with refresh).
- Default `exposure: deferred`; `direct` only for small always-on sets; `codemode` for batchable.
  Never `direct` for a large server.
- Call `tool_search` before any `mcp__*` tool; never invent tool names.
- Every MCP call is delegated (A2): check `isError`, handle timeout/disconnect — failure is never
  success.
- Numbers, not opinions: measure with `tools/pi-cost` before calling MCP expensive.

Details (exposure matrix, 6 replace / 3 keep, MCP→skill migration recipe): skill `mcp-usage`.

## CI/CD (GitHub Actions)

- **Every new project gets CI at creation time**:
  `node templates/github-actions/scaffold-ci.mjs <target-dir>`. CI is the cheapest error detector.
- **CI (build/test) needs zero secrets**; secrets only at deploy, only via OIDC.
- **Never fork the pipeline**: projects edit only `ci.yml`; `reusable-ci.yml` stays canonical.
- **Fix red jobs, never disable them**: no `|| true`, no `continue-on-error`.

Job order, security model, full rules: skill `ci-cd`; harness: `templates/github-actions/`.

## Secrets (non-negotiable)

**Read = sent.** Anything in the transcript is already at the provider; redaction is a backstop.

- **Never read or print secrets on purpose**: no `cat .env`, `env`/`printenv`, `echo $TOKEN`,
  `base64` of a secret file, `kubectl get secret -o yaml`.
- **`.gitignore` is layer 1** — verify with `git check-ignore -v <path>`, don't assume.
- **gitleaks gate is authoritative** (`gitleaks git --staged`); a missing scanner blocks the
  commit, never treated as a pass.
- **Secret leaked → say it, then rotate the credential.** History rewriting does not un-send data.
- Do not commit secrets or `auth.json`.

Layered defence + measured limits of each layer: skill `secret-leak-guard`.

## Hygiene

- Keep system prompt and tool set stable during a session — the DeepSeek prefix cache is 30–50×
  cheaper on hits; a mid-session prompt change is a cache miss.
- Review tool output before trusting destructive commands.

## Tools

- `node tools/pi-cost/pi-cost.mjs [--today|--last N] [--top N] [--json]` — tokens/cost per session.
- `node tools/skill-lint.mjs` — skill structure gate (see below).
  Tests: `node --test tools/skill-lint.test.mjs` (17 contract cases, TDD — a check that cannot
  be made to fail by a fixture is not a check).
- `node templates/github-actions/scaffold-ci.mjs <target-dir> [--lang node|python|rust|go]`.

## Progressive disclosure

- Detail belongs in a skill, not here: `AGENTS.md` = rules that must hold every turn,
  `SKILL.md` = procedure + triggers, `references/` = evidence. A rule earns a place here only
  if it cannot be deferred.
- `description` is the router — it states what the skill does *and* when to use it.
- Each reference opens with `## Index` (§N → when to read); the parent links a specific §,
  never "read the whole file". Material always read together belongs in one file.
- Gate before commit: `node tools/skill-lint.mjs` → 0 errors.
