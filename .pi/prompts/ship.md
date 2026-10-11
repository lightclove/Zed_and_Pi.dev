---
description: Turn the current work into a production-ready change
argument-hint: "[scope]"
---
Take the current work to production-ready state for ${1:-the active feature}:

0. Numbers gate (Akin 1 / Hamilton 5): record the measurements — test results, typecheck,
   and session cost (pi-cost) — and ship on them, not on opinion.
1. Run the project's checks (tests, lint, typecheck, build).
2. Add or update tests for changed behavior.
3. Update docs/changelog if present.
4. Final plain-language pass: would this change embarrass you in review? (Akin 26)
5. Write a clear commit message and a summary of what changed.

Do not push or deploy without explicit confirmation.
