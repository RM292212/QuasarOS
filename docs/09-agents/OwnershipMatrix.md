# OwnershipMatrix.md

## Purpose

Define accountable ownership for QuasarOS domains and prevent unreviewed cross-domain changes.

## RACI meanings

- **A — Accountable:** final decision owner; exactly one per decision.
- **R — Responsible:** performs the work.
- **C — Consulted:** reviews or advises before completion.
- **I — Informed:** notified of material changes.

## Domain matrix

| Domain | A | R | C | I |
|---|---|---|---|---|
| Product requirements | Product owner | Product agent | Science, design, engineering | Project team |
| System architecture | Architecture owner | Architecture agent | Platform, frontend, backend, rendering | Project team |
| Scientific semantics | Scientific owner | Science/data agents | Backend, rendering, test | Product owner |
| Frontend application | Frontend owner | Frontend agent | Design, accessibility, test | Architecture |
| Cesium overview | Geospatial owner | Cesium agent | Science, frontend, rendering | Test |
| Volume rendering | Rendering owner | Rendering agent | Science, GPU test, frontend | Architecture |
| API contracts | Backend owner | Backend agent | Frontend, data, security | Architecture |
| Data ingestion | Data owner | Data agent | Science, platform, security | Backend |
| Database schema | Database owner | Database agent | Backend, platform, data | Architecture |
| Accessibility | Accessibility owner | UI/test agents | Design, product | Project team |
| Security | Security owner | Security and implementation agents | Platform, architecture | Project lead |
| Infrastructure | Platform owner | Platform agent | Security, backend | Operations |
| Testing strategy | Quality owner | Test agent | All domain owners | Project team |
| Documentation | Documentation owner | Documentation agent | Relevant domain owner | Project team |
| Integration | Integration owner | Integrator | Affected owners | Project team |
| Release | Release manager | Platform/integrator | Product, science, security, quality | Stakeholders |

## File ownership

Repository ownership rules map paths to one or more responsible teams. Changes to shared schemas, renderer contracts, database migrations, security configuration, release gates, and scientific libraries require the corresponding accountable owner’s review.

## Cross-domain changes

The task identifies one primary owner and all required consulted owners. The primary owner coordinates the combined acceptance criteria and cannot omit a consultation because another agent wrote the affected code.

## Absence and delegation

Accountable owners may delegate explicitly for a defined scope and period. Delegation is recorded and does not create permanent authority.

## Disputes

Conflicting ownership claims follow `ConflictResolution.md`. Until resolved, the orchestrator prevents integration of the disputed change.
