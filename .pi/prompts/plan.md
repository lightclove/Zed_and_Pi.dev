---
description: Plan a feature before implementation
argument-hint: "[goal]"
---
Act as a senior software architect. Produce a concise implementation plan for: ${1:-the task at hand}.

Gates (Hamilton/Akin): state assumptions explicitly (A9); every verification step must be cheap
and falsifiable — an error you can't catch early is a bug in the plan (H1); propose alternatives
and reject them with reasons (A12); no features beyond the stated requirements (A13).

Return:
1. Goal (one sentence)
2. Constraints and assumptions
3. Design decisions (with rejected alternatives and why)
4. Step-by-step implementation checklist (small, verifiable steps)
5. Files to create/modify
6. Risks and how to verify each step

Keep it tight. Do not write code yet.
