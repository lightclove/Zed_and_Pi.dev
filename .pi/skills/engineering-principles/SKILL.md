---
name: engineering-principles
description: Engineering discipline for design and orchestration decisions — Margaret Hamilton's error-detection principles and Akin's Laws of Spacecraft Design. Use when planning architecture, designing agent/tool/extension interfaces, estimating effort, reviewing design decisions, or gating a change before ship.
---

# Engineering principles (Hamilton + Akin)

Two sources govern every design and orchestration decision in this harness:
Margaret Hamilton (Apollo flight software) and Akin's Laws of Spacecraft Design.
Canonical lists + mapping to this harness: `references/hamilton.md`, `references/akin-laws.md`.

## Core rules, applied to this harness

| # | Rule | Concrete behavior here |
|---|---|---|
| H1 | **Detect errors at the earliest possible point** — development time, not operation time | Run cheap checks before expensive ones (typecheck, one failing test) before the full suite; validate inputs at every boundary (tool params, sub-agent I/O); never silently default on invalid input |
| H2 | **Design to detect and recover from errors during operation** | Sub-agents, tools, and models can fail: report failures loudly (`isError` + details), handle truncation/abort/timeout, let the caller retry with a narrower scope |
| H3 | **Errors migrate to interfaces** | Agree on the contract before the implementation; validate at the boundary, not deep inside the logic |
| H4 | **Define before the fact, not debug after the fact** | `/plan` for non-trivial changes: goal, assumptions, rejected alternatives, verifiable steps — before writing code |
| H5 | **There are no shortcuts: "first time right" is cheaper than fixing later** | Small verifiable steps, commit working states, never skip a check to save a minute |
| A1 | **Engineering is done with numbers. Analysis without numbers is only an opinion.** | Back decisions with measurements: `pi-cost`, usage footer, test results, timings. Never argue from feeling |
| A2 | **Design it to operate when some things are wrong** | Every orchestration path needs an error path: assume one sub-agent of N will fail |
| A3 | **Design is iterative — always one more iteration than you've done** | Review after each change; never ship the first version of a design without a verification loop |
| A9 | **Missing information is not an excuse for not starting** | Start with what you have; list assumptions explicitly instead of waiting |
| A10 | **When in doubt, estimate; in an emergency, guess — then clean up when real numbers arrive** | Estimates are allowed only if marked as estimates and revisited with data |
| A12 | **Never a single right solution; always multiple wrong ones** | Present alternatives + rejected ones (why) — never one unbranched proposal |
| A13 | **No justification for designing better than the requirements dictate** | YAGNI: build exactly what the task needs |
| A14 | **"Better" is the enemy of "good"** (Edison) | Stop polishing when checks pass; ship |
| A15 | **Improvements occur primarily at interfaces — which is also the prime location for screwing up** (Shea) | Treat every tool/sub-agent I/O contract as the highest-risk surface |
| A16 | **Previous analysis is not the wisdom of the ages** | Verify sub-agent and model answers before passing them through; never present someone else's analysis (or an unverified paraphrase) as truth |
| A19 | **The odds are against you being immensely smarter than everyone** | If a result looks extraordinary (too fast, too cheap, too good), sanity-check it before trusting |
| A22 | **When in doubt, document** | Record decisions, assumptions, and numbers where they will be needed later |
| A26 | **Don't do nuthin' dumb** (Montemerlo) | The final gate before ship: one plain-language pass over the change |

## Gates — where these rules fire

- **Planning** (`/plan`): H4, A9, A12 — requirements first, assumptions listed, alternatives rejected explicitly.
- **Implementation**: H1, H3, A2 — validate at boundaries, cheap checks first, error paths for every delegated call.
- **Review** (`/review`, skill `code-review`): H1/H3 (error detection timing, boundary validation), A2 (failure paths exercised), A16/A19 (verify claims).
- **Ship** (`/ship`): A1 (numbers gate: tests/typecheck/cost), H5 (nothing skipped), A26 (final sanity pass).
