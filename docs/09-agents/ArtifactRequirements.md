# ArtifactRequirements.md

## Purpose

Define the artifacts that prove a task was implemented, validated, reviewed, and integrated correctly.

## General requirements

Every artifact must be:

- Associated with a task identifier.
- Traceable to a repository revision.
- Named and stored in an approved location.
- Reproducible where practical.
- Free of secrets and restricted data.
- Versioned when consumed by another task.
- Accompanied by creation metadata and validation status.

A verbal statement is not a substitute for required evidence.

## Required task artifacts

Every implementation task produces:

1. Source or documentation changes.
2. Acceptance-criteria mapping.
3. Test evidence.
4. Change summary.
5. Assumption and decision record.
6. Handoff or integration notes.

## Conditional artifacts

| Change type | Required artifacts |
|---|---|
| Public API | OpenAPI update, generated client, contract tests, compatibility assessment |
| Event or worker message | Versioned schema, producer and consumer tests |
| Database | Migration, impact analysis, validation queries, rollback strategy |
| Scientific algorithm | Independent reference, tolerances, provenance, real-data or analytic validation |
| Renderer | Reference scene, shader tests, backend parity evidence, GPU resource impact |
| UI/UX | Screenshots, keyboard behavior, accessibility evidence, responsive states |
| Data pipeline | Source manifest, checksums, processing configuration, validation report |
| Infrastructure | Plan output, policy checks, recovery and rollback notes |
| Security-sensitive change | Threat assessment, scan results, security approval |
| Performance-sensitive change | Before-and-after benchmark report |
| Release | Signed artifacts, SBOM, provenance, release gate bundle |

## Artifact manifest

The task record lists each artifact with:

- Artifact type.
- Path or immutable URL.
- Producer.
- Source revision.
- Environment.
- Creation time.
- Checksum where applicable.
- Validation result.
- Retention classification.
- Consumer tasks.

## Screenshots and visual evidence

Images must state browser, viewport, renderer, theme, dataset, and product version. Screenshots cannot be the only proof of scientific correctness.

## Test evidence

Test evidence includes commands, suite names, result counts, environment, and links to retained reports. If a test was not run, the task record states why and who accepts the resulting risk.

## Retention

Release, scientific-validation, migration, security, and incident-related artifacts follow long-term retention policy. Temporary debugging artifacts may expire after integration when they contain no unique evidence.
