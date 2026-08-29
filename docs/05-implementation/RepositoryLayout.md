# Repository Layout

**File:** `docs/05-implementation/RepositoryLayout.md`  
**Status:** Normative

## Layout

    QuasarOS/
      README.md
      AGENTS.md
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
        monitoring/
      data/
        manifests/
        licences/
        fixtures/
      tests/
        unit/
        integration/
        scientific/
        rendering/
        e2e/
        performance/
        security/
        accessibility/
      docs/
        00-governance/
        01-product/
        02-architecture/
        03-science-data/
        04-rendering/
        05-implementation/
        06-design/
        07-testing/
        08-delivery/
        09-agents/
        10-decisions/
        11-evidence/

## Application responsibilities

- `apps/web`: browser entry point and route composition.
- `apps/api`: FastAPI entry point and HTTP composition.
- `services`: deployable or worker-oriented service entry points.
- `packages`: reusable TypeScript libraries.
- `python`: reusable scientific Python libraries.
- `infrastructure`: deployment and operational assets.
- `data`: manifests and legally permitted small fixtures.
- `tests`: cross-package verification.
- `docs`: normative specifications and evidence.

## Rules

- Large datasets and generated bricks are excluded from Git.
- Build outputs are generated, not manually edited.
- Package internals are accessed only through public exports.
- Environment secrets are never committed.
- Architecture changes update documentation and ADRs.
- New root folders require architecture approval.
- Each package shall include ownership, build, test, and public-interface metadata.
