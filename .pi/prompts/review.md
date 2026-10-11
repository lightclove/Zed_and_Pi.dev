---
description: Review staged changes for correctness, security, and performance
argument-hint: "[focus]"
---
Review the staged changes. Focus on ${1:-correctness, security, and error handling}.

Gates (Hamilton/Akin): are errors caught at the earliest possible point (input validation,
boundary contracts) or do they surface at runtime (H1/H3)? Do failure paths exist and are they
exercised — truncation, abort, sub-agent failure (A2)? Are extraordinary claims sanity-checked
(A19) and is borrowed analysis verified, not passed through (A16)?

For each issue report: file:line, severity (critical/major/minor), what is wrong, and a concrete fix.
Then give a one-paragraph verdict: ship / fix then ship / block.
