# Akin's Laws of Spacecraft Design — canonical list, applied to agent orchestration

Source (canonical set, verified): Prof. David Akin, University of Maryland —
<https://spacecraft.ssl.umd.edu/akins_laws.html>

The current canonical set has **45 laws**. Older editions circulating online had 29 with
different numbering (e.g., "never enough time to do it right" was Ranger's Law #28; the
"space is unforgiving" law was #29). The numbering below is the current source numbering.

Each law is quoted verbatim from the source, followed by how it maps to this harness
(design of tools, extensions, sub-agent pipelines, prompts).

## Index — читать только нужный диапазон

| Законы | Когда читать |
|---|---|
| 1–6 | планируешь замеры, борешься с преждевременными выводами (A1, A10) |
| 7–14 | дизайн, требования, YAGNI (A13/A14) |
| 15–22 | интерфейсы, проверка чужих ответов, документация (A15, A16, A19, A22) |
| 23–32 | оценки сроков/объёма, декомпозиция работ |
| 33–45 | программные реальности, «сначала заставь работать» (A40) |

1. **Engineering is done with numbers. Analysis without numbers is only an opinion.**
   → Every claim about cost, speed, or quality needs a measurement (pi-cost, usage, timings).
2. **To design a spacecraft right takes an infinite amount of effort. This is why it's a
   good idea to design them to operate when some things are wrong.**
   → Never assume a sub-agent or tool call succeeds. Error paths are part of the design.
3. **Design is an iterative process. The necessary number of iterations is one more than
   the number you have currently done. This is true at any point in time.**
   → No design is finished after one pass; each review/verify loop is one more iteration.
4. **Your best design efforts will inevitably wind up being useless in the final design.
   Learn to live with the disappointment.**
   → Don't fall in love with a plan or prototype; discard without grief when data says so.
5. **(Miller's Law) Three points determine a curve.**
   → Don't draw conclusions from one run; repeat measurements before optimizing.
6. **(Mar's Law) Everything is linear if plotted log-log with a fat magic marker.**
   → Beware of overfitted charts and "obvious" trends from too few points.
7. **At the start of any design effort, the person who most wants to be team leader is
   least likely to be capable of it.**
   → In delegation: the agent that should own a task is the one best able to do it, not
   the one that asks first.
8. **In nature, the optimum is almost always in the middle somewhere. Distrust assertions
   that the optimum is at an extreme point.**
   → Token budgets, thinking levels, check depth: extremes (always 0 / always max) are
   suspicious by default.
9. **Not having all the information you need is never a satisfactory excuse for not
   starting the analysis.**
   → Start with what you have; write down the missing pieces as assumptions.
10. **When in doubt, estimate. In an emergency, guess. But be sure to go back and clean up
    the mess when the real numbers come along.**
    → Estimates must be marked as estimates and revisited when real data arrives.
11. **Sometimes, the fastest way to get to the end is to throw everything out and start
    over.**
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
    → Tool parameters, sub-agent I/O contracts, prompt/skill boundaries: highest-risk
    surface, highest-leverage surface. Validate there.
16. **The previous people who did a similar analysis did not have a direct pipeline to the
    wisdom of the ages. There is therefore no reason to believe their analysis over yours.
    There is especially no reason to present their analysis as yours.**
    → Verify sub-agent and model output before it enters your answer; cite or re-derive.
17. **The fact that an analysis appears in print has no relationship to the likelihood of
    its being correct.**
    → Docs, blogs, and model claims are inputs, not verdicts.
18. **Past experience is excellent for providing a reality check. Too much reality can doom
    an otherwise worthwhile design, though.**
    → Use past sessions as evidence; don't let "we've always done it this way" block a
    measurably better approach.
19. **The odds are greatly against you being immensely smarter than everyone else in the
    field. If your analysis says your terminal velocity is twice the speed of light, you
    may have invented warp drive, but the chances are a lot better that you've screwed up.**
    → Extraordinary results (free speedup, zero-cost feature) get a sanity check first.
20. **A bad design with a good presentation is doomed eventually. A good design with a bad
    presentation is doomed immediately.**
    → The summary/commit message/verdict matters: state what changed and the numbers.
21. **(Larrabee's Law) Half of everything you hear in a classroom is crap. Education is
    figuring out which half is which.**
    → Filter advice (including this file): keep what survives contact with measurements.
22. **When in doubt, document. (Documentation requirements will reach a maximum shortly
    after the termination of a program.)**
    → Write down decisions and numbers now; they are cheapest exactly when they feel
    unnecessary.
23. **The schedule you develop will seem like a complete work of fiction up until the time
    your customer fires you for not meeting it.**
    → Estimates without a feedback loop are fiction; re-estimate from real elapsed data.
24. **It's called a "Work Breakdown Structure" because the Work remaining will grow until
    you have a Breakdown, unless you enforce some Structure on it.**
    → Decompose tasks into small verifiable steps; unstructured big tasks expand silently.
25. **(Bowden's Law) Following a testing failure, it's always possible to refine the
    analysis to show that you really had negative margins all along.**
    → A failing check is ground truth; don't re-frame the analysis to explain it away.
26. **(Montemerlo's Law) Don't do nuthin' dumb.**
    → Final plain-language pass before ship.
27. **(Varsi's Law) Schedules only move in one direction.**
    → Slippage compounds and never comes back; surface drift early instead of silently.
28. **(Ranger's Law) There ain't no such thing as a free launch.**
    → Every "free" shortcut (skipped check, copied analysis) is paid for somewhere else.
29. **(von Tiesenhausen's Law of Program Management) To get an accurate estimate of final
    program requirements, multiply the initial time estimates by pi, and slide the decimal
    point on the cost estimates one place to the right.**
    → Multiply first-pass token/time estimates by a constant; suspiciously round numbers
    are wrong by construction.
30. **(von Tiesenhausen's Law of Engineering Design) If you want to have a maximum effect
    on the design of a new engineering system, learn to draw. Engineers always wind up
    designing the vehicle to look like the initial artist's concept.**
    → The first plan/diagram shapes the architecture; draw it carefully — /plan matters.
31. **(Mo's Law of Evolutionary Development) You can't get to the moon by climbing
    successively taller trees.**
    → Incremental patches don't replace a change of approach; sometimes a step change is
    the only way.
32. **(Atkin's Law of Demonstrations — так в источнике) When the hardware is working
    perfectly, the really important visitors don't show up.**
    → Re-verify right before showing/delivering; last-minute state changes break demos.
33. **(Patton's Law of Program Planning) A good plan violently executed now is better than
    a perfect plan next week.**
    → /plan must not delay work; a decent plan executed today beats a perfect one tomorrow.
34. **(Roosevelt's Law of Task Planning) Do what you can, where you are, with what you
    have.**
    → Sibling of A9: start with available information and tools.
35. **(de Saint-Exupery's Law of Design) A designer knows that they have achieved
    perfection not when there is nothing left to add, but when there is nothing left to
    take away.**
    → Minimalism; sibling of A13/A14 (YAGNI, "better" vs "good").
36. **Any run-of-the-mill engineer can design something which is elegant. A good engineer
    designs systems to be efficient. A great engineer designs them to be effective.**
    → First effective (task solved), then efficient (tokens, latency) — never the reverse.
37. **(Henshaw's Law) One key to success in a mission is establishing clear lines of
    blame.**
    → Every delegated call has an owner and an error path; no orphaned responsibilities.
38. **Capabilities drive requirements, regardless of what the systems engineering
    textbooks say.**
    → New tools/models change what's reasonable to require; revisit requirements instead
    of clinging to the original spec.
39. **Any exploration program which "just happens" to include a new launch vehicle is, de
    facto, a launch vehicle program.** (Alternate formulation: The three keys to keeping a
    new human space program affordable and on schedule: 1) No new launch vehicles. 2) No
    new launch vehicles. 3) Whatever you do, don't develop any new launch vehicles.)
    → "Just add one dependency/infra change" is de facto a bigger project; say so.
40. **(McBryan's Law) You can't make it better until you make it work.**
    → Get it working first, optimize later; premature optimization is wasted tokens.
41. **There's never enough time to do it right, but somehow, there's always enough time to
    do it over.** (In older editions: Ranger's Law #28.)
    → Skipping a check to save time is a loan against doing the whole task twice.
42. **If there's not a flight program, there's no money. If there is a flight program,
    there's no time.**
    → No task: no budget. Task: no slack. Budget checks and slack checks accordingly.
43. **You really understand something the third time you see it (or the first time you
    teach it.)**
    → Explaining = verification of understanding; write the doc/commit message as a test.
44. **(Lachance's Law) "Plenty of time" becomes "not enough time" in a very short time.**
    → Start early; slack evaporates non-linearly.
45. **Space is a completely unforgiving environment. If you screw up the engineering,
    somebody dies (and there's no partial credit because most of the analysis was
    right...)**
    → "Mostly right" is not right. Run the checks; a broken change has no partial credit.

Akin closes the page with the origin story: written for his senior spacecraft design
class, leaked onto a jokes listserv, now circulated in many editions — he maintains the
linked page as the canonical set. A reduced set hangs on the wall of the NASA Mission
Management Room (Mission Control) at Johnson Space Center.
