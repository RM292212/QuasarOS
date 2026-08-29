# QuasarOS Documentation Index

## Purpose

This directory contains the authoritative V1 specifications for QuasarOS and QuasarOceanScope.

## Reading order

| Order | Document | Purpose |
|---:|---|---|
| 1 | `../AGENTS.md` | Mandatory rules for all agents |
| 2 | `Plan.md` | Product scope, milestones, and delivery plan |
| 3 | `Arc.md` | System architecture and component boundaries |
| 4 | `Tech.md` | Approved technologies and rationale |
| 5 | `DataModeling.md` | Canonical scientific data model |
| 6 | `DataSources.md` | Approved real-data sources and acquisition policy |
| 7 | `Implement.md` | Implementation strategy and repository organization |
| 8 | `Design.md` | User experience and interface specification |
| 9 | `Test.md` | Verification, validation, and release gates |

## Authority order

If documents conflict, use this precedence:

1. `AGENTS.md`
2. `DataModeling.md` for scientific semantics
3. `Arc.md` for architecture
4. `Tech.md` for technology decisions
5. `Test.md` for release requirements
6. `Implement.md` for implementation conventions
7. `Design.md` for UI behavior
8. `Plan.md` for scheduling

A conflict must still be reported and corrected. Precedence is not permission to leave contradictory documents unresolved.

## Project terminology

- **QuasarOS:** overall browser-native scientific visualization platform.
- **QuasarOceanScope:** oceanographic application inside QuasarOS.
- **Ocean Overview:** CesiumJS geospatial workspace.
- **Scientific Volume Lab:** Babylon.js scientific rendering workspace.
- **Canonical data:** analysis-ready scientific representation preserving source meaning and precision.
- **Rendering product:** optimized, potentially quantized data used by the GPU.
- **Authoritative data:** original provider data or a traceable canonical transformation.
- **Fixture:** test-only data that must never be presented as operational data.

## Document status

All documents in this directory define the V1 target. Implementation may initially be incomplete, but agents must not silently redefine the target based on incomplete code.

## Change policy

A major change to architecture, technology, scientific semantics, or release criteria requires:

- Description of the problem.
- Proposed decision.
- Alternatives.
- Scientific consequences.
- Performance consequences.
- Migration impact.
- Testing impact.
- Maintainer/orchestrator approval.

