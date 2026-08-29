# ProgressReporting.md

## Purpose

Define concise, evidence-based progress reporting for tasks and coordinated work.

## Reporting events

Agents report when:

- Work starts.
- A meaningful milestone completes.
- A blocker appears or changes.
- Scope, estimate, or dependency changes.
- Review is requested.
- A task is handed off.
- Integration completes.
- A task fails, is cancelled, or is done.

Long-running tasks provide updates at least once per working day or at the interval configured by the orchestrator.

## Status format

Every update contains:

- Task identifier.
- Current state.
- Objective.
- Completed since previous update.
- Current work.
- Next action.
- Blockers and owner needed.
- Dependencies consumed or produced.
- Tests or evidence added.
- Scope or estimate change.
- Confidence: high, medium, or low.

## Progress measurement

Report progress through completed acceptance criteria and artifacts, not arbitrary percentage alone. If a percentage is required, it must be accompanied by:

- Completed milestones.
- Remaining milestones.
- Highest-risk unresolved item.
- Basis for the estimate.

“Almost done” is not a valid status without evidence.

## Blocker reporting

A blocker report states:

- What cannot proceed.
- Why.
- When it was discovered.
- Attempts already made.
- Evidence or reproduction.
- Required decision, artifact, permission, or owner.
- Impact on dependent tasks and schedule.
- Safe work that can continue in parallel.

Security incidents and scientific-correctness concerns are escalated immediately rather than waiting for the next status interval.

## Completion report

A completion report includes:

- Final summary.
- Acceptance-criteria mapping.
- Changed components.
- Artifact manifest.
- Tests executed and results.
- Reviews received.
- Integration revision.
- Known limitations.
- Follow-up tasks.
- Operational or release notes.

## Accuracy

Reports distinguish facts, assumptions, and forecasts. An agent must not report a test as passing when it was skipped, partially run, or executed against an obsolete artifact.

## Noise control

Routine reports should be brief and link to detailed evidence. Repeated unchanged updates are avoided unless a blocker’s escalation window requires confirmation.
