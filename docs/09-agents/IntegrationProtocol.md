# IntegrationProtocol.md

## Purpose

Define how independently completed tasks are combined into a coherent, validated QuasarOS change.

## Preconditions

A task is eligible for integration when:

- Implementation is committed and traceable.
- Acceptance criteria are mapped to evidence.
- Required tests pass.
- Review gates are approved.
- Public contracts are updated.
- Generated artifacts are current.
- No unresolved ownership conflict exists.
- Handoff information is complete.

## Integration order

Integrate in dependency order:

1. Shared schemas and contracts.
2. Domain models and migrations.
3. Backend producers.
4. Client or worker consumers.
5. Shared renderer contracts.
6. Backend-specific renderer implementations.
7. UI workflows.
8. Documentation and operational configuration.
9. Cross-system validation.

When possible, additive contracts land before consumers and removals occur only after all consumers migrate.

## Integrator responsibilities

The integrator:

- Verifies artifact and dependency versions.
- Detects semantic, not only textual, conflicts.
- Confirms package-boundary compliance.
- Regenerates derived files from authoritative sources.
- Runs affected test suites.
- Verifies feature-flag defaults.
- Confirms migration and deployment order.
- Records the integrated revision.
- Reopens tasks when integration invalidates prior evidence.

## Integration environment

Use an isolated environment with:

- Current database migrations.
- Seeded validation data.
- Object-storage fixtures.
- Queue and workers.
- Browser test projects.
- Both rendering backends where supported.
- Production-like configuration without production secrets.

## Required checks

Depending on scope:

- Build, lint, type, and unit tests.
- API and event contract tests.
- Database migration checks.
- Integration and P0 end-to-end tests.
- Scientific reference tests.
- Renderer conformance.
- Accessibility.
- Security scanning.
- Performance and memory comparison.
- Deployment smoke tests.

## Conflict handling

Do not resolve scientific, contract, or architecture conflicts solely in the integration branch. Return the issue to the responsible owner through `ConflictResolution.md`.

## Completion

Integration is complete when the combined revision passes its gates, downstream tasks point to the integrated artifact, temporary compatibility mechanisms are tracked, and the integration report identifies residual risks and release requirements.
