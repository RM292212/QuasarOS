# Task.md

## Purpose

Define the canonical task model used to plan, execute, review, integrate, and audit QuasarOS work.

## Required fields

| Field | Description |
|---|---|
| `id` | Stable identifier such as `QOS-1234` |
| `title` | Short action-oriented description |
| `objective` | User or system outcome |
| `type` | Feature, defect, research, migration, operations, documentation, or validation |
| `priority` | P0, P1, P2, or P3 |
| `risk` | Low, medium, high, or critical |
| `status` | State defined by `Orchestrator.md` |
| `owner` | Accountable implementing agent or person |
| `domains` | Affected ownership domains |
| `scope` | Required work |
| `out_of_scope` | Explicit exclusions |
| `acceptance_criteria` | Verifiable completion conditions |
| `dependencies` | Required task or artifact identifiers |
| `artifacts` | Required outputs |
| `review_gates` | Mandatory approvals |
| `validation` | Required test suites or evidence |
| `integration_target` | Branch, release, or product version |
| `rollback` | Reversal or containment approach |
| `created_at` | Creation timestamp |
| `updated_at` | Last material update |

## Optional fields

- Requirement identifiers.
- User journey identifiers.
- Estimate and target milestone.
- Feature flag.
- Environment requirement.
- Data classification.
- Security considerations.
- Scientific assumptions.
- Performance or memory budget.
- Browser or GPU matrix.
- Parent task and subtasks.
- External dependency.
- Expiry date.

## Quality criteria

A task is ready when:

- The objective describes an outcome rather than an implementation activity.
- Scope is bounded.
- Acceptance criteria are independently testable.
- Ownership is unambiguous.
- Dependencies identify readiness artifacts.
- Review and validation match the risk.
- Exclusions prevent accidental expansion.
- The rollback or containment strategy is proportionate.

## Task size

A task should normally be completable within several focused working days. Larger work becomes an epic or parent task with separately integrable children.

## State integrity

Only the orchestrator or authorized task owner changes task state. `done` requires integration and accepted evidence. A closed task with deferred mandatory work is reopened or receives an explicitly linked follow-up approved by the relevant gate owner.

## Immutability

Task history, approvals, and completion evidence are append-only audit information. Corrections identify the prior value and reason rather than silently rewriting history.
