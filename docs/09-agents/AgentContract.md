# AgentContract.md

## Purpose

Define the mandatory behavior of any human or automated agent performing QuasarOS repository tasks.

## Core contract

Every agent must:

1. Read the assigned task, linked requirements, and relevant architecture documents before editing.
2. Work only within the declared scope and ownership boundaries.
3. Preserve scientific correctness, accessibility, security, renderer parity, and reproducibility.
4. Prefer existing project conventions and abstractions over parallel implementations.
5. Make the smallest coherent change that satisfies the acceptance criteria.
6. Add or update tests for changed behavior.
7. Report uncertainty, blockers, failed checks, and assumptions explicitly.
8. Never claim completion without verifiable evidence.
9. Never expose credentials, private data, or unrestricted signed URLs.
10. Leave the repository in a reviewable state.

## Required inputs

An agent may begin implementation only when it has:

- Task identifier and objective.
- Scope and exclusions.
- Acceptance criteria.
- Owned files or subsystem.
- Required dependencies.
- Expected artifacts.
- Applicable review gates.
- Integration target.
- Known risks or constraints.

Missing noncritical information may be recorded as an assumption. Missing information that could affect scientific meaning, security, destructive operations, or public compatibility is a blocker.

## Change rules

Agents must not:

- Modify unrelated files to simplify local implementation.
- Rewrite an applied database migration.
- overwrite immutable scientific products.
- weaken tests, quality gates, or security controls to obtain a passing run.
- Introduce a dependency without documenting purpose and alternatives.
- Change a public contract without contract review.
- silently change units, coordinates, time semantics, QC rules, or rendering meaning.
- Deploy to production or access production data unless the task explicitly authorizes it.

## Validation

At minimum, an agent runs the checks applicable to changed files:

- Formatting, linting, and type checking.
- Unit and contract tests.
- Relevant integration or browser tests.
- Scientific numerical validation.
- Accessibility checks for UI changes.
- WebGPU and WebGL 2 checks for shared rendering changes.
- Documentation and generated-artifact validation.

Checks not run must be listed with a reason.

## Output contract

The final report includes:

- Summary of completed behavior.
- Files or components changed.
- Acceptance-criteria mapping.
- Tests and commands executed.
- Artifacts produced.
- Assumptions and decisions.
- Remaining risks or follow-up work.
- Handoff or integration instructions.

## Stop conditions

The agent stops and escalates when it encounters unclear scientific semantics, conflicting requirements, a security exposure, unexpected production access, destructive migration risk, ownership conflict, or a dependency that invalidates the task plan.
