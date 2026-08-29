# TestEnvironments.md

## Purpose

Define reproducible environments for local, continuous-integration, staging, physical-GPU, and production validation.

## Environment classes

### Local

- Containerized PostgreSQL/PostGIS, queue/cache, and object storage.
- Seeded catalog and deterministic scientific fixtures.
- Mock OIDC provider.
- WebGPU or WebGL 2 selected through supported test configuration.
- No dependency on live external data.

### Pull-request CI

- Pinned runtime and browser versions.
- Unit, contract, integration, lint, build, and Chromium smoke tests.
- Software renderer where hardware GPU is unavailable.
- Disposable database and storage namespaces.

### Nightly

- Full browser matrix.
- Extended end-to-end, visual, accessibility, memory, and performance suites.
- Large generated fixtures.
- Selected external-source availability checks.

### Physical-GPU laboratory

- Representative integrated and discrete GPUs.
- Supported operating systems and browser engines.
- WebGPU and WebGL 2.
- Fixed viewport, display scaling, power profile, and driver inventory.
- Renderer conformance, performance, memory, and device-loss tests.

### Staging

- Production-equivalent topology and security controls.
- Isolated nonproduction identity and storage.
- Migration rehearsal, operational alerts, failure injection, and release-candidate testing.
- No uncontrolled production data copying.

## Reproducibility

Each run records:

- Commit and build artifact.
- Container image digests.
- Dependency lockfile hashes.
- Browser and engine versions.
- Operating system and architecture.
- GPU adapter and driver where available.
- Feature flags and public configuration.
- Dataset and fixture versions.
- Test seed, locale, timezone, viewport, and device-pixel ratio.

## Data isolation

Tests use unique schemas, object prefixes, queue namespaces, and identity subjects. Parallel runs cannot observe or delete one another’s state. Cleanup is automatic, with retention available for failed-run diagnostics.

## Secrets

CI secrets are short-lived, least-privileged, masked, and unavailable to untrusted pull requests. Test reports must not contain access tokens, cookies, connection strings, or unrestricted signed URLs.

## Drift control

Environment definitions are version-controlled. Scheduled jobs compare deployed configuration with the declared configuration. Unreviewed drift invalidates benchmark comparisons and blocks release qualification until resolved.
