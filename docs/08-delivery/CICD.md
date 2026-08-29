# CICD.md

## Purpose

Define the continuous-integration and continuous-delivery pipeline used to build, verify, sign, and promote QuasarOS artifacts.

## Pipeline principles

- Every release artifact is built once and promoted unchanged.
- Builds are reproducible from a commit and dependency lockfiles.
- Pull-request code never receives production credentials.
- Deployment requires passing quality gates.
- Production promotion requires explicit approval.
- Generated artifacts, manifests, and provenance are retained.

## Pull-request pipeline

Run in this order:

1. Repository policy and changed-file detection.
2. Secret, license, and dependency scanning.
3. Markdown and documentation validation.
4. TypeScript formatting, linting, and type checking.
5. Python formatting, linting, and type checking.
6. Unit and scientific numerical tests.
7. OpenAPI, JSON Schema, and generated-client checks.
8. Frontend and backend builds.
9. Container image builds.
10. Integration tests with disposable services.
11. Shader and Chromium end-to-end smoke tests.
12. Infrastructure validation and policy checks.
13. Software composition and image vulnerability scans.

Required checks must not be bypassed by changing pipeline files in the same untrusted execution context.

## Main-branch pipeline

In addition to pull-request checks:

- Publish immutable container images tagged by commit digest.
- Generate an SBOM.
- Sign images and attest build provenance.
- Deploy automatically to development.
- Run deployment smoke tests.
- Run complete integration and end-to-end suites.
- Publish test, coverage, security, and build reports.

## Release pipeline

A release tag triggers:

1. Verification that the tag references an approved main-branch commit.
2. Release-quality gate evaluation.
3. Artifact signature and provenance verification.
4. Staging promotion.
5. Database migration rehearsal.
6. Browser, accessibility, renderer, and scientific acceptance tests.
7. Human approval.
8. Production canary deployment.
9. Automated smoke and health checks.
10. Progressive traffic increase.
11. Release annotation in monitoring systems.

## Artifact identity

Artifacts use immutable digests. Mutable environment tags may point to a digest but are not deployment evidence. The release record includes:

- Git commit and release tag.
- Container digests.
- SBOM and signatures.
- Build provenance.
- Schema revision.
- frontend asset manifest.
- Infrastructure revision.
- Test reports and approvals.

## Pipeline security

Use workload identity or short-lived credentials. Pin third-party CI actions by immutable revision. Separate build, signing, and deployment permissions. Production environments require protected approvals and cannot be modified by pull-request jobs.

## Failure behavior

A failed stage stops promotion. Retrying a job must not produce a differently identified artifact. Flaky failures require investigation; repeated retry until success is prohibited.

Reference:

- https://slsa.dev/spec/v1.2/
