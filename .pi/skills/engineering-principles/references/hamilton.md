# Margaret Hamilton — principles, applied to agent orchestration

Margaret Hamilton led the Apollo flight software team at MIT. The guidance computer had to
keep working during landing even when overloaded or mis-sequenced (Apollo 11's 1201/1202
alarms are the canonical example). Her principles generalize directly to this harness.

## 1. Detect errors as early as possible

> "We made the decision that software should be designed so that errors could be detected
> during development and not during operation."

The cost of an error grows the later it is found: design → implementation → check → ship →
runtime → user. In the harness:

- Validate inputs at every boundary (tool params, sub-agent I/O) — fail loudly and early,
  never silently coerce.
- Cheap checks before expensive ones: typecheck and one failing test before the full suite,
  `grep`/`find` before `read`, plan before code.
- Reject invalid input at the interface rather than handling it deep in the logic.

## 2. Design for error detection and recovery during operation

Apollo software was built to detect its own errors asynchronously and recover: priority
displays, restarts, shedding low-priority work. In the harness:

- Sub-agents, models, and tools fail or get truncated: report failures explicitly
  (`isError`, details), never return an empty/partial answer as if complete.
- When a delegated call fails, degrade or retry with a narrower scope — the pipeline must
  keep operating when something is wrong (Akin #2 is the same law in different words).

## 3. Errors migrate to interfaces

Hamilton's analysis of Apollo errors: most defects live at the interfaces — between people
and software, between software and hardware, between components. In the harness:

- The contract (tool parameters, sub-agent I/O schema, skill boundaries) is both the highest-
  risk and highest-leverage surface (Shea's Law, Akin #15).
- Define the interface before the implementation; validate at the boundary.

## 4. Define before the fact (DBTF), not debug after the fact

Her later work (Development Before The Fact, USL/001 Tool Suite): define the system with a
notation that prevents entire classes of errors *by construction*, instead of hunting bugs
afterwards. In the harness:

- Encode invariants in code/types/tool schemas, not prose: a parameter schema that rejects
  bad input is a DBTF artifact.
- `/plan` first for non-trivial changes: requirements, assumptions, rejected alternatives,
  verifiable steps — then implement.

## 5. There are no shortcuts

> "There are no shortcuts in software development. The more you invest up front, the less it
> costs later."

Skipping a check to save a minute is a loan against doing the task twice (Ranger's Law,
Akin #28). Small verifiable steps, commit working states, run every gate before ship.
