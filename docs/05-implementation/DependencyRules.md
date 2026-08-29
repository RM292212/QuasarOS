# Dependency Rules

**File:** `docs/05-implementation/DependencyRules.md`  
**Status:** Normative

## Dependency direction

    UI
      → application/state
      → domain contracts
      → ports
      → infrastructure adapters

Infrastructure shall not define domain behavior.

## Frontend rules

- `domain` imports no framework.
- `schemas` may depend on validation libraries and domain types.
- `api-client` depends on schemas, not UI.
- `state` depends on domain and API client.
- `ui` depends on domain and state.
- `render-core` depends on domain-compatible types only.
- `render-webgpu` and `render-webgl2` depend on `render-core`.
- `babylon-volume` may depend on Babylon.js and render packages.
- `cesium-overview` may depend on CesiumJS but not Babylon.js.
- React components shall not be imported by renderer packages.

## Backend rules

- Route modules depend on application services and schemas.
- Services depend on repository and scientific interfaces.
- Repositories depend on database adapters.
- Scientific packages shall not import FastAPI.
- Provider adapters shall not write directly to catalog tables.
- Workers invoke application services or scientific packages, not route handlers.

## Prohibited dependencies

- CesiumJS inside Babylon renderer packages.
- Babylon.js inside Cesium packages.
- Database clients in frontend code.
- Provider-specific logic in shared domain models.
- API calls directly from shaders or low-level GPU classes.
- Rendering representations in exact scientific calculations.
- Circular package dependencies.
- Runtime imports from test-only packages.

## Enforcement

Use:

- TypeScript project references.
- ESLint import-boundary rules.
- Python import-lint rules.
- Dependency graph checks in CI.
- Package ownership review.

## Exceptions

An exception requires architecture approval, documented reason, expiration milestone, and a test preventing broader dependency leakage.
