# Review checklist

1. Correctness: edge cases, off-by-one, null/undefined, error propagation.
2. Security: injection, secrets in logs/code, unsafe deserialization, path traversal, authz checks.
3. Concurrency: races, deadlocks, shared mutable state, transaction boundaries.
4. Performance: N+1 queries, unbounded loops, accidental O(n^2), memory leaks.
5. Error handling: swallowed errors, missing retries/backoff, unclear messages.
6. Tests: does the change include tests for the new behavior and regressions?
