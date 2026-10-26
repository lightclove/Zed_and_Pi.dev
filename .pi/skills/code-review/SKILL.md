---
name: code-review
description: Deep code review for correctness, security, performance, and maintainability. Use when asked to review, audit, or harden code.
---

# Code review

## Checklist (run through it before writing findings)

1. Correctness: edge cases, off-by-one, null/undefined, error propagation.
2. Security: injection, secrets in logs/code, unsafe deserialization, path traversal, authz checks.
3. Concurrency: races, deadlocks, shared mutable state, transaction boundaries.
4. Performance: N+1 queries, unbounded loops, accidental O(n^2), memory leaks.
5. Error handling: swallowed errors, missing retries/backoff, unclear messages.
6. Tests: does the change include tests for the new behavior and regressions?

## Output

Report every finding as:

- `[severity] file:line — issue`
- why it matters
- a concrete fix

Severity levels: critical (data loss / security / incorrect behavior), major (bug in edge cases),
minor (style / maintainability).

End with a verdict: ship / fix then ship / block.
