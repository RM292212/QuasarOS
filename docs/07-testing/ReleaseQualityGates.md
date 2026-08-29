# ReleaseQualityGates.md

## Purpose

Define the mandatory evidence required to promote a release candidate.

## Gate table

| Gate | Required result |
|---|---|
| Build and packaging | Reproducible build; no uncommitted generated output |
| Unit tests | 100% pass |
| Integration tests | 100% pass |
| API contracts | Compatible and schema-valid |
| End-to-end P0 journeys | 100% pass |
| Scientific validation | All required tolerances met |
| Renderer conformance | WebGPU and WebGL 2 required cases pass |
| Browser compatibility | P0 matrix passes |
| Accessibility | No critical/serious automated issue; manual P0 checks pass |
| Security | No unresolved critical/high release-relevant finding |
| Performance | No unapproved blocking regression |
| Memory | No confirmed leak or budget failure |
| Data pipeline | Idempotency, provenance, and publication tests pass |
| Failure recovery | Required failure-injection scenarios pass |
| Visual regression | All changes reviewed and approved |
| Documentation | User, operator, API, and release notes current |
| Operations | Migration, rollback, backup, alerts, and dashboards verified |

## Additional requirements

- Dependency lockfiles and software bill of materials are generated.
- Production images are vulnerability-scanned and signed.
- Database migrations are tested forward and backward where rollback is supported.
- Object-storage and product-version compatibility are verified.
- Feature flags have owners, defaults, expiry policy, and rollback behavior.
- Known limitations are documented.
- No quarantined P0 test may be ignored without release authority approval.

## Evidence bundle

The release candidate must retain:

- Commit and immutable artifact identifiers.
- Test reports and coverage summaries.
- Browser and physical-GPU matrix.
- Scientific reference results.
- Performance and memory reports.
- Accessibility and security reports.
- Migration rehearsal output.
- Deployment smoke-test evidence.
- Approvals and accepted exceptions.

## Exceptions

An exception requires:

- Affected requirement and user impact.
- Scientific and operational risk.
- Compensating control.
- Named owner.
- Expiry date.
- Approval by engineering and product leadership.
- Scientific approval when correctness may be affected.
- Security approval for security findings.

Critical scientific corruption, inaccessible P0 workflows, exploitable critical security defects, unrecoverable migration risk, or failure of both supported renderers cannot be waived.

## Promotion

Promotion proceeds from development to staging, release candidate, canary, and production. Automated smoke tests run after each deployment. Any gate regression stops promotion and initiates rollback or remediation.
