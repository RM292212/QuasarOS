# Orchestrator.md

## Purpose

Define the task orchestrator responsible for decomposition, assignment, dependency control, state transitions, evidence collection, and escalation.

## Responsibilities

The orchestrator:

- Converts approved work into bounded tasks.
- Assigns stable task identifiers.
- Validates task templates.
- Maintains the dependency graph.
- Selects agents from the registry.
- Enforces ownership and concurrency limits.
- Tracks progress and blockers.
- Routes artifacts to consumers.
- Schedules review and integration gates.
- Prevents duplicate or conflicting work.
- Escalates unresolved decisions.
- Produces completion and release-readiness summaries.

The orchestrator does not replace product, scientific, security, or architecture authority.

## Task states

| State | Meaning |
|---|---|
| `draft` | Incomplete definition |
| `ready` | Valid and unblocked |
| `assigned` | Owner selected |
| `in_progress` | Active work |
| `blocked` | Cannot proceed |
| `review` | Awaiting required review |
| `changes_requested` | Review requires modification |
| `integration` | Being combined and validated |
| `done` | Accepted and integrated |
| `failed` | Stopped without completion |
| `cancelled` | Intentionally terminated |

Every state change records actor, timestamp, reason, and relevant artifact.

## Scheduling rules

The orchestrator prioritizes:

1. Incident and security work.
2. Scientific-correctness defects.
3. Critical-path blockers.
4. Release-gate failures.
5. P0 product work.
6. Other planned work.

It avoids assigning overlapping writable ownership unless a coordination plan exists.

## Decomposition rules

A task should have one primary objective, one accountable owner, independently verifiable output, and a duration small enough for meaningful progress reporting. Split work when implementation, scientific approval, migration, or integration can fail independently.

## Stale work

A task becomes stale after its configured reporting interval. The orchestrator requests status, checks whether ownership remains valid, and reassigns only after preserving a handoff record.

## Safety

The orchestrator cannot authorize production access, waive mandatory review, or accept scientific/security risk on behalf of domain owners. Automated task execution uses least-privileged credentials and isolated workspaces.

## Completion

A task reaches `done` only after acceptance criteria, required artifacts, review gates, integration checks, and documentation are complete. Code creation alone is not completion.
