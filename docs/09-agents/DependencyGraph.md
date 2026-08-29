# DependencyGraph.md

## Purpose

Define how task dependencies are represented, validated, scheduled, and changed.

## Dependency types

| Type | Meaning |
|---|---|
| `blocks` | Downstream work cannot begin meaningfully |
| `requires` | Downstream completion depends on the artifact |
| `contract` | Work may proceed against an approved interface |
| `data` | Requires a fixture, schema, or product |
| `environment` | Requires infrastructure or deployment |
| `review` | Requires approval before integration |
| `informational` | Useful context but not a scheduling blocker |

Dependencies should reference artifacts or decisions, not merely task completion.

## Graph rules

- The graph must be acyclic for blocking dependencies.
- Every task has a stable identifier.
- A dependency has an owner and readiness condition.
- External dependencies include a fallback or escalation plan.
- Cross-team dependencies use explicit contracts.
- A task cannot be marked ready while a blocking predecessor is incomplete.
- Integration and release gates are represented as graph nodes when they block promotion.

## Recommended decomposition

Prefer this sequence:

1. Requirement and acceptance criteria.
2. Contract or architecture decision.
3. Independent implementation tasks.
4. Unit and contract validation.
5. Integration task.
6. Cross-system and scientific validation.
7. Documentation.
8. Release evidence.

Frontend and backend work may run in parallel after the API contract is approved. WebGPU and WebGL 2 implementation may run in parallel after the shared renderer contract and reference scenes are approved.

## Critical path

The orchestrator computes the critical path using blocking dependencies and estimated duration. Critical-path tasks receive early risk review. Adding work to the critical path requires explicit schedule impact reporting.

## Dependency readiness

A dependency is ready only when:

- Its required artifact exists.
- The artifact version is identified.
- Relevant review gates passed.
- Consumers can access it.
- Known limitations are documented.
- No unresolved change is expected to invalidate consumers.

## Changes

When a dependency changes:

1. Increment or identify the new artifact version.
2. Mark affected consumers.
3. Determine compatibility.
4. Reopen downstream tasks when necessary.
5. Update estimates and critical path.
6. Notify owners.

## Validation

Automation checks missing identifiers, cycles, completed tasks with incomplete blockers, unowned dependencies, and consumers referencing obsolete artifact versions.
