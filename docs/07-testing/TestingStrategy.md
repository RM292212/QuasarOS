# TestingStrategy.md

## Purpose

Establish a risk-based testing system that protects scientific correctness, rendering parity, usability, security, and operational reliability.

## Quality principles

1. Scientific validity outranks visual plausibility.
2. Exact data queries and approximate rendering are tested separately.
3. WebGPU and WebGL 2 implement one shared behavioral contract.
4. Deterministic low-level tests provide most coverage.
5. Integration and end-to-end tests protect critical boundaries and journeys.
6. Real data complements synthetic analytic fixtures.
7. Failures must produce actionable evidence.
8. Flaky tests are defects, not acceptable background noise.

## Test pyramid

| Layer | Primary scope | Typical tools |
|---|---|---|
| Static | Types, lint, schemas, dependency rules | TypeScript, ESLint, mypy, Ruff |
| Unit | Pure domain and numerical logic | Vitest, pytest |
| Shader | GPU kernels and render invariants | Browser GPU harness |
| Contract | APIs, events, manifests | OpenAPI/JSON Schema tests |
| Integration | Database, storage, queue, workers | pytest, containers |
| Component | React controls and state interaction | Testing Library |
| End-to-end | Critical user journeys | Playwright |
| Specialized | Accessibility, security, performance, memory | axe-core and dedicated harnesses |
| Scientific | Independent numerical validation | Python reference calculations |

## Risk priorities

P0 areas receive complete automated and release-candidate coverage:

- Coordinate and unit interpretation.
- Missing data and QC.
- Dataset/version selection.
- Scalar-volume rendering.
- Exact inspection.
- Time semantics.
- Model-observation comparison.
- Backend fallback.
- Provenance export.
- Authentication and authorization.

## CI stages

1. Fast static and unit checks.
2. Build and generated-artifact verification.
3. Contract and integration suites.
4. Browser smoke and shader tests.
5. Main-branch complete deterministic suite.
6. Nightly matrix, real-data, performance, memory, and visual tests.
7. Release-candidate qualification in staging and physical-GPU environments.

## Ownership

The team changing behavior changes its tests. Scientific tests require scientific review; renderer tests require visualization review; security-sensitive changes require security review. Every test failure identifies an owning subsystem.

## Flakiness policy

A flaky test is investigated immediately. Temporary quarantine requires an issue, owner, diagnostic evidence, and expiry date. Quarantined tests remain visible and cannot satisfy a release gate.

## Completion criteria

A feature is complete only when requirements map to tests, failure paths are covered, accessibility is verified, telemetry supports diagnosis, documentation is updated, and all applicable release gates pass.
