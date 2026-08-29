# ReviewGates.md

## Purpose

Define mandatory reviews that must pass before task integration or release.

## Gate levels

### G0 — Self-validation

Required for every task:

- Scope reviewed.
- Diff inspected.
- Applicable tests run.
- Generated files current.
- No secrets or unrelated changes.
- Completion report prepared.

### G1 — Peer review

Required for code, configuration, schema, and normative documentation:

- Correctness.
- Maintainability.
- Test sufficiency.
- Dependency compliance.
- Error and cancellation behavior.
- Documentation.

The reviewer must not be the sole implementer.

### G2 — Domain review

Required based on impact:

| Impact | Required reviewer |
|---|---|
| Scientific meaning | Scientific owner |
| Public API or event contract | API/architecture owner |
| WebGPU/WebGL behavior | Rendering owner |
| Database migration | Database owner |
| Accessibility | Accessibility owner |
| Authentication, authorization, secrets | Security owner |
| Infrastructure or production operation | Platform owner |
| User workflow or requirement | Product/design owner |
| Data licensing or governance | Data owner |

### G3 — Integration review

Confirms combined behavior, dependency versions, migrations, feature flags, cross-system tests, and deployment order.

### G4 — Release review

Confirms all production quality gates, evidence, rollback readiness, known limitations, and approvals.

## Review outcomes

- `approved`
- `approved_with_follow_up`
- `changes_requested`
- `blocked`
- `not_applicable`

Follow-up approval is prohibited for unresolved scientific corruption, critical accessibility barriers, authorization defects, destructive migration risk, or required P0 failures.

## Reviewer responsibilities

Reviewers must:

- Evaluate the acceptance criteria, not only formatting.
- Identify the evidence examined.
- State required changes clearly.
- Distinguish blockers from suggestions.
- Avoid approving outside their authority.
- Re-review material changes made after approval.

## Stale approvals

Approval becomes stale when:

- Acceptance criteria change.
- The relevant contract version changes.
- A material implementation rewrite occurs.
- A required dependency changes incompatibly.
- New evidence invalidates the review.
- The task is rebased across conflicting semantic changes.

## Gate record

Record reviewer, role, outcome, revision, date, evidence, comments, and conditions. Automated checks may satisfy mechanical gates but cannot replace required scientific, security, design, or operational judgment.
