# The Vibecoding Method: Intent → Evidence → Small Steps

Synthesis of [obra/superpowers](https://github.com/obra/superpowers) and [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).

## Reading the two repos

| | Superpowers | Agent-skills |
|---|---|---|
| Strength | Discipline: how the agent thinks and behaves (brainstorm → TDD → evidence) | Coverage: a lifecycle with specialist gates (spec, security, perf, ship) |
| Core idea | Skills are mandatory, auto-triggered | Skills are processes with exit criteria and anti-rationalization tables |
| Weak spot | Heavy by default (worktrees, subagents, 2-5 min tasks) | Many skills: context bloat and cost |

Shared beliefs: agents take the shortest path, so process must be forced; claims need proof; work happens in small verified slices.

Division of labor: Superpowers is the operating system (how each task runs). Agent-skills is the specialist toolbox (what to check for a given risk).

## Philosophy: five laws

1. **Intent before code.** The costliest bug is building the wrong thing.
2. **Evidence before claims.** "Done" means a command ran and its output was seen. A test never seen failing proves nothing.
3. **Thin slices.** Small enough to hold in your head, verify in one call, and revert cleanly.
4. **Proportional rigor.** Match process weight to risk. Process costing more than the failure it prevents is waste.
5. **The bar is written down and cannot be lowered quietly.** Never skip, delete or loosen a test, suppress a lint, or edit a threshold to reach green. Report it.

## The loop, scaled by tier

- **Tier 0, trivial** (typo, copy, constant): do it, one verify call.
- **Tier 1, small** (bug or tweak in one area): 2-4 line plan (cause or goal, files, proving test, risk), then the loop.
- **Tier 2, feature** (several files or new behavior): short written spec, task list, inline or subagent execution, one review.
- **Tier 3, risky** (data shape, auth, injected HTML, page-wide listeners, irreversible ops): Tier 2 plus the matching specialist gate (`security-and-hardening`, `deprecation-and-migration`, `performance-optimization`) and a fresh-context doubt pass.

Phases:

1. **Define.** Restate goal, constraints, done criteria. One batched question for what cannot be derived. Tier 2+ gets a written spec. (`brainstorming`, `spec-driven-development`)
2. **Plan.** Slices, each with files, proving test, verification command. (`writing-plans`)
3. **Prove (red).** Failing test first, seen failing for the right reason. Bugs: reproduce first; if it cannot be reproduced, stop and ask. (`test-driven-development`, `systematic-debugging`)
4. **Build (green).** Minimum code, then refactor. One slice, one verify call. (`incremental-implementation`)
5. **Review.** One pass on five axes (correctness, readability, architecture, security, performance) with severity labels; critical blocks. `code-simplification` on big changes. (`code-review-and-quality`, `requesting-code-review`)
6. **Ship.** Commit locally, show the result, human authorizes the push; release via script. (`verification-before-completion`, `git-workflow-and-versioning`)

## Efficiency rules

- Context is the budget: load only the file or line range needed. A codebase map in CLAUDE.md saves more than any skill.
- Turns cost more than tokens: chain build, test and diff in one call; batch independent commands; report at milestones.
- Run related tests only; full suite only for tasks about the tests.
- Script any ritual that happens twice.
- Subagents for isolation (review, parallel independent work), not ceremony.
- One task per thread; follow-ups and reverts start fresh.

## Quality guardrails

- Anti-rationalization: "too simple to test", "tests after", "just this once", "the test is wrong" are stop signs. A failing test means the code is wrong until proven otherwise.
- Bar-lowering diff check before every commit: added suppressions, removed or skipped assertions, edited thresholds, stubs.
- A suite reporting 0 checks crashed; it is a failure, not a pass.
- Tier 3: a fresh-context reviewer attacks the plan before building (`doubt-driven-development`).
- Retire, don't skip: delete checks for removed behavior.

## Human-in-the-loop

The human owns intent and irreversible actions (what to build, what "done" means, when to push or publish). The agent owns execution and proof. It never pushes, force-pushes or invents scope; follow-ups are flagged, not done.

## What to cut

- From Superpowers: worktrees and branch ceremony when policy is commit-local-then-push; subagent-per-task unless the plan is large.
- From agent-skills: workflow, git, CI and meta-skills (duplicate Superpowers' process layer, add context cost). Keep only specialist gates, called by risk.

## Measuring

Per thread: turns to done, tests red before green, defects found after "done", push rework. Turns up with defects flat: too heavy, drop a tier. Defects slipping through: move up a tier, add the missing gate.
