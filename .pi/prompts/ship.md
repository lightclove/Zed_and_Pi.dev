---
description: Turn the current work into a production-ready change
argument-hint: "[scope]"
---
Take the current work to production-ready state for ${1:-the active feature}:

1. Run the project's checks (tests, lint, typecheck, build).
2. Add or update tests for changed behavior.
3. Update docs/changelog if present.
4. Write a clear commit message and a summary of what changed.

Do not push or deploy without explicit confirmation.
