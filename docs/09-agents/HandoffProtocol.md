# HandoffProtocol.md

## Purpose

Ensure responsibility can transfer between agents without loss of context, hidden work, or ambiguous ownership.

## Handoff triggers

A handoff occurs when:

- One agent completes a dependency for another.
- Ownership moves between domains.
- A task is paused or reassigned.
- Implementation moves to review.
- Review moves to integration.
- An agent reaches a permission or expertise boundary.
- A work session ends with incomplete changes.

## Required handoff package

The transferring agent provides:

- Task identifier and current status.
- Objective and acceptance criteria.
- Completed work.
- Changed files and artifacts.
- Current branch, commit, or patch identity.
- Decisions and assumptions.
- Commands and tests run.
- Test results and known failures.
- Remaining steps.
- Open questions and risks.
- Dependencies and downstream consumers.
- Environment or fixture requirements.
- Cleanup obligations.
- Recommended first action for the recipient.

## Incomplete changes

Incomplete work must be clearly labeled. The handoff identifies:

- Code that is safe and complete.
- Experimental or temporary code.
- Disabled tests or provisional fixtures.
- Generated files requiring regeneration.
- Database or storage state created during testing.
- Any behavior not yet validated.

Temporary changes must not be presented as production-ready.

## Acceptance

The receiving agent confirms:

1. Required artifacts are accessible.
2. The task state matches the repository state.
3. Known failures can be reproduced or understood.
4. Ownership boundaries are clear.
5. Required dependencies are identified.
6. No secret or restricted data is present.
7. The next action is feasible.

If acceptance fails, ownership remains with the transferring agent or returns to the orchestrator.

## Review handoff

For review, include a concise change rationale, risk areas, acceptance-criteria mapping, and specific reviewer questions. Do not ask reviewers to reconstruct the task from the diff alone.

## Integration handoff

Integration handoffs additionally identify migration order, feature flags, contract versions, deployment constraints, rollback behavior, and cross-task compatibility.

## Emergency handoff

During an incident, prioritize current impact, actions already taken, unsafe actions to avoid, credentials or access already rotated, and the next decision deadline. Complete documentation after stabilization.
