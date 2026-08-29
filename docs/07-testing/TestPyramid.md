# TestPyramid.md

## Purpose

Define where tests belong so the suite remains fast, reliable, and capable of detecting cross-system failures.

## Pyramid model

### Level 1: static verification

Runs first and most frequently:

- Type checking.
- Linting and formatting.
- Import and package-boundary rules.
- Schema validation.
- Migration and infrastructure syntax checks.
- Secret and dependency scanning.

### Level 2: unit and numerical tests

The largest test layer. Unit tests cover domain rules, coordinate conversions, state reducers, cache selection, manifest decoding, API services, and scientific algorithms. They run without network services, wall-clock dependence, or a real GPU unless the unit is specifically a GPU kernel.

### Level 3: shader and component tests

Shader harnesses verify focused GPU behavior. UI component tests verify semantics, keyboard interaction, validation, and state transitions without duplicating full browser journeys.

### Level 4: contract tests

Validate API, event, manifest, and worker-message compatibility. Contract tests isolate producer-consumer drift before expensive deployment tests.

### Level 5: integration tests

Exercise real databases, object storage, queues, workers, identity stubs, and browser data pipelines. Mock only systems outside the selected integration boundary.

### Level 6: end-to-end tests

A deliberately small set protects P0 journeys through a deployed system. End-to-end tests should not duplicate every input combination already covered below.

### Cross-cutting suites

Scientific validation, accessibility, security, performance, memory, browser compatibility, failure injection, and real-data testing span multiple levels rather than forming one additional layer.

## Placement rule

Use the lowest layer capable of detecting the defect with confidence. Move upward only when the behavior depends on a real boundary, browser engine, GPU, deployment, or user workflow.

## Anti-patterns

- Testing all numerical edge cases through the UI.
- Mocking the database in an integration test.
- Using screenshots as the only scientific assertion.
- Repeating the same workflow across many nearly identical end-to-end tests.
- Replacing a failing low-level test with a slower high-level test.
- Allowing test-only implementations to diverge from production contracts.

## Suite health metrics

Track duration, failure rate, flake rate, quarantine age, test distribution by layer, and requirement coverage. Coverage percentages inform review but do not substitute for meaningful assertions.
