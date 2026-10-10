---
name: code-review
description: Deep code review for correctness, security, performance, and maintainability. Use when asked to review, audit, or harden code.
---

# Code review

Read `references/checklist.md` first, then review the specified files or diff.

Report every finding as:

- `[severity] file:line — issue`
- why it matters
- a concrete fix

Severity levels: critical (data loss / security / incorrect behavior), major (bug in edge cases), minor (style / maintainability).

End with a verdict: ship / fix then ship / block.
