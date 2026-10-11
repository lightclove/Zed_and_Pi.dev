# Akin's Laws of Spacecraft Design — full list, applied to agent orchestration

Source: Prof. David Akin, University of Maryland. Each law is followed by how it maps to
this harness (design of tools, extensions, sub-agent pipelines, and prompts).

1. **Engineering is done with numbers. Analysis without numbers is only an opinion.**
   → Every claim about cost, speed, or quality needs a measurement (pi-cost, usage, timings).
2. **To design a spacecraft right takes an infinite amount of effort. This is why it's a good
   idea to design them to operate when some things are wrong.**
   → Never assume a sub-agent or tool call succeeds. Error paths are part of the design.
3. **Design is an iterative process. The necessary number of iterations is one more than the
   number you have currently done. This is true at any point in time.**
   → No design is finished after one pass; each review/verify loop is one more iteration.
4. **Your best design efforts will inevitably wind up being useless in the final design.
   Learn to live with the disappointment.**
   → Don't fall in love with a plan or prototype; discard without grief when data says so.
5. **(Miller's Law) Three points determine a curve.**
   → Don't draw conclusions from one run; repeat measurements before optimizing.
6. **(Mar's Law) Everything is linear if plotted log-log with a fat magic marker.**
   → Beware of overfitted charts and "obvious" trends from too few points.
7. **At the start of any design effort, the person who most wants to be team leader is least
   likely to be capable of it.**
   → In delegation: the agent that should own a task is the one best able to do it, not the
   one that asks first.
8. **In nature, the optimum is almost always in the middle somewhere. Distrust assertions
   that the optimum is at an extreme point.**
   → Token budgets, thinking levels, check depth: extremes (always 0 / always max) are
   suspicious by default.
9. **Not having all the information you need is never a satisfactory excuse for not starting
   the analysis.**
   → Start with what you have; write down the missing pieces as assumptions.
10. **When in doubt, estimate. In an emergency, guess. But be sure to go back and clean up
    the mess when the real numbers come along.**
    → Estimates must be marked as estimates and revisited when real data arrives.
11. **Sometimes, the fastest way to get to the end is to throw everything out and start over.**
    → Patching a broken delegation or plan is often more expensive than redoing it cleanly.
12. **There is never a single right solution. There are always multiple wrong ones, though.**
    → Propose alternatives; explicitly reject the wrong ones and say why.
13. **Design is based on requirements. There's no justification for designing something one
    bit "better" than the requirements dictate.**
    → YAGNI. The best design is the smallest one that meets the stated requirements.
14. **(Edison's Law) "Better" is the enemy of "good".**
    → Ship when checks pass. Indefinite polishing delays value and inflates tokens.
15. **(Shea's Law) The ability to improve a design occurs primarily at the interfaces. This
    is also the prime location for screwing it up.**
    → Tool parameters, sub-agent I/O contracts, prompt/skill boundaries: highest-risk surface,
    highest-leverage surface. Validate there.
16. **The previous people who did a similar analysis did not have a direct pipeline to the
    knowledge of God. There is therefore no reason to believe their analysis over yours. There
    is especially no reason to present their analysis as yours.**
    → Verify sub-agent and model output before it enters your answer; cite or re-derive.
17. **The fact that an analysis appears in print has no relationship to the likelihood of its
    being correct.**
    → Docs, blogs, and model claims are inputs, not verdicts.
18. **Past experience is excellent for providing a reality check. Too much reality can doom
    an otherwise worthwhile design, though.**
    → Use past sessions as evidence; don't let "we've always done it this way" block a
    measurably better approach.
19. **The odds are greatly against you being immensely smarter than everyone else in the
    field. If your analysis says your terminal velocity is twice the speed of sound, you may
    have invented the warp drive, but you're more likely to have screwed up.**
    → Extraordinary results (free speedup, zero-cost feature) get a sanity check first.
20. **A bad design with a good presentation is doomed eventually. A good design with a bad
    presentation is doomed immediately.**
    → The summary/commit message/verdict matters: state what changed and the numbers.
21. **(Larrabee's Law) Half of everything you hear in a classroom is crap. Education is
    figuring out which half is which.**
    → Filter advice (including this file): keep what survives contact with measurements.
22. **When in doubt, document. (Documentation requirements will reach a maximum shortly after
    the termination of a program.)**
    → Write down decisions and numbers now; they are cheapest exactly when they feel
    unnecessary.
23. **The schedule you develop will seem like a complete work of fiction up until the time
    your customer fires you for not meeting it.**
    → Estimates without a feedback loop are fiction; re-estimate from real elapsed data.
24. **It's called a "Work Breakdown Structure" because the work remaining will grow until you
    have a breakdown, unless you enforce some structure on it.**
    → Decompose tasks into small verifiable steps; unstructured big tasks expand silently.
25. **(Bowden's Law) Following a testing failure, it's always possible to refine the analysis
    to show that you really had negative margins all along.**
    → A failing check is ground truth; don't re-frame the analysis to explain it away.
26. **(Montemerlo's Law) Don't do nuthin' dumb.**
    → Final plain-language pass before ship.
27. **(Varsi's Law) Schedules slip one day at a time.**
    → Small daily overruns compound; surface drift early instead of silently.
28. **(Ranger's Law) There's never enough time to do it right, but somehow, there's always
    enough time to do it over.**
    → Skipping a check to save time is a loan against doing the whole task twice.
29. **Space is a completely unforgiving environment. If you screw up the engineering, somebody
    dies (and there's no partial credit because most of the analysis was right...).**
    → "Mostly right" is not right. Run the checks; a broken change has no partial credit.
