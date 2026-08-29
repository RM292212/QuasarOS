# Repository Architecture

**File:** `docs/02-architecture/RepositoryArchitecture.md`  
**Status:** Normative

## Monorepo structure

    apps/
      web/
      api/
    packages/
      domain/
      schemas/
      api-client/
      state/
      ui/
      charts/
      render-core/
      render-webgpu/
      render-webgl2/
      cesium-overview/
      babylon-volume/
      workers/
    services/
      ingestion/
      processing/
      analysis/
    python/
      quasar_science/
      quasar_ingestion/
      quasar_analysis/
    infrastructure/
      containers/
      database/
      object-storage/
      deployment/
    data/
      manifests/
      licences/
    tests/
      e2e/
      scientific/
      performance/
      rendering/
    docs/

## Dependency rules

- `domain` depends on no framework.
- `schemas` may depend on domain-compatible validation libraries.
- UI packages depend on `domain`, `schemas`, `state`, and `api-client`.
- Render backends depend on `render-core`, never on React.
- Cesium and Babylon adapters remain separate.
- Python science packages do not depend on FastAPI routes.
- API routes depend on application services and schemas.
- Infrastructure does not define scientific business rules.

## Source ownership

- TypeScript source: `packages` and `apps/web`.
- Python source: `apps/api`, `services`, and `python`.
- Shaders: backend-specific renderer packages.
- Database migrations: `infrastructure/database`.
- Provider manifests: `data/manifests`.
- Architecture decisions: documentation and ADRs.

## Generated files

Generated API clients, schemas, shader bundles, and build outputs shall:

- Be clearly identified.
- Be reproducible.
- Not be manually edited.
- Be excluded from review where appropriate or reviewed through their source specification.

## Data policy

Large source datasets and generated bricks shall not be committed to Git. Only small manifests, checksums, licences, and test fixtures permitted by policy belong in the repository.

## Quality boundaries

Each package defines:

- Public exports.
- Owner.
- Test scope.
- Dependency constraints.
- Build command.
- Version compatibility.

Circular dependencies are prohibited.

## Change policy

Changes crossing package boundaries require contract review. Changes to scientific schemas, renderer contracts, public APIs, event schemas, or persistent storage require migration and compatibility analysis.

