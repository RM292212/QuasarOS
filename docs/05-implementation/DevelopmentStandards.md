# Development Standards

**File:** `docs/05-implementation/DevelopmentStandards.md`  
**Status:** Normative

## General

- Prefer clear, typed, maintainable code over premature abstraction.
- Keep changes scoped to the assigned task.
- Do not change architecture or scientific meaning silently.
- Delete dead code rather than leaving commented implementations.
- No placeholders, fake operational data, or hidden fallbacks.

## TypeScript

- Strict mode enabled.
- Avoid `any`; use `unknown` with validation.
- Public functions require explicit types.
- Prefer immutable domain objects.
- Validate external data at boundaries.
- Dispose Babylon, WebGPU, WebGL, worker, and event resources explicitly.
- Do not store large arrays in React state.

## Python

- Type annotations for public interfaces.
- Pydantic for external schemas.
- NumPy/xarray operations preferred over unbounded Python loops.
- Scientific functions shall be deterministic where practical.
- Docstrings state units, dimensions, coordinate assumptions, and missing-data policy.
- CPU-heavy work shall not execute in API event loops.

## Naming

- IDs: `camelCase` in JSON, `snake_case` in Python internals where conventional.
- Scientific variables use registry identities, not informal abbreviations.
- Units shall not be encoded ambiguously into variable names.
- Boolean names describe positive state.

## Reviews

Every change shall address:

- Scientific correctness.
- Data provenance.
- Resource lifecycle.
- Cancellation.
- Error handling.
- Security.
- Accessibility.
- Tests.
- Documentation.

## Commits

Commits should be focused and reference task IDs. Generated outputs shall identify their source.

## Definition of done

A feature is done only when implementation, tests, documentation, error paths, telemetry, cleanup, and acceptance evidence are complete.
