# ConflictResolution.md

## Purpose

Define how requirement, ownership, design, implementation, and merge conflicts are identified and resolved.

## Conflict classes

- **Requirement conflict:** two acceptance criteria require incompatible behavior.
- **Scientific conflict:** disagreement about units, algorithms, uncertainty, QC, or interpretation.
- **Architecture conflict:** competing boundaries, contracts, or technology choices.
- **Ownership conflict:** multiple tasks need the same files or subsystem.
- **Contract conflict:** producer and consumer expectations differ.
- **Implementation conflict:** incompatible code changes.
- **Schedule conflict:** a dependency cannot complete when required.
- **Evidence conflict:** tests or measurements support different conclusions.

## Resolution priorities

Use this order:

1. Safety and security.
2. Scientific correctness and provenance.
3. Published requirements and acceptance criteria.
4. Public compatibility and data integrity.
5. Architecture and dependency rules.
6. Accessibility.
7. Operational reliability.
8. Performance.
9. Implementation convenience.

Higher priority does not eliminate the need to document impact on lower-priority concerns.

## Resolution process

1. Stop conflicting work from being integrated.
2. Record the conflict and affected task identifiers.
3. Identify the authoritative documents and owners.
4. Collect minimal reproducible evidence.
5. List feasible options and consequences.
6. Assign a decision owner.
7. Select and document the resolution.
8. Update tasks, dependencies, contracts, and acceptance criteria.
9. Revalidate affected work.
10. Notify downstream owners.

## Decision authority

| Conflict | Final authority |
|---|---|
| Product behavior | Product owner |
| Scientific semantics | Scientific owner |
| Security | Security owner |
| Architecture and package boundaries | Architecture owner |
| Accessibility | Accessibility owner |
| Operations and production safety | Platform/operations owner |
| Merge mechanics | Integrator |
| Unresolved cross-domain conflict | Project lead |

Implementers may propose solutions but do not unilaterally override domain owners.

## Merge conflicts

For semantic conflicts, do not mechanically choose one side. Determine the intended combined behavior, restore contract consistency, and rerun affected tests. Generated files are regenerated from the selected source rather than manually merged.

## Deadlock

If no decision is reached within the task’s escalation window, the orchestrator pauses dependent work and escalates with options, evidence, schedule impact, and a recommended default.

## Record

Every material resolution records context, decision, alternatives, consequences, owner, date, and affected tasks. Durable architecture decisions belong in an ADR.
