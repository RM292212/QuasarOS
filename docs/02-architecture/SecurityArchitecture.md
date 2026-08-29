# Security Architecture

**File:** `docs/02-architecture/SecurityArchitecture.md`  
**Status:** Normative

## Security objectives

- Protect restricted scientific data.
- Prevent unauthorized publication, analysis, and export.
- Protect credentials and infrastructure.
- Safely process untrusted provider files and user input.
- Preserve integrity and provenance.

## Trust boundaries

1. Browser to reverse proxy.
2. Reverse proxy to API.
3. API to database, queue, and object storage.
4. Workers to external providers.
5. Workers parsing acquired files.
6. Browser loading object-storage assets.
7. Administrative interfaces.

Every boundary requires authentication where applicable, authorization, validation, and observability.

## Identity and authorization

Deployments should use OIDC/OAuth 2.1. Authorization is based on:

- Subject.
- Role.
- Dataset policy.
- Operation.
- Tenant or organization.
- Export permission.
- Quota.

UI visibility is not authorization.

## Data access

- Public immutable assets may use CDN URLs.
- Restricted assets use short-lived signed URLs.
- Signed URLs are scoped to specific objects or prefixes.
- Bucket listing is disabled for clients.
- Source credentials remain server-side.
- Exports are policy-checked before generation.

## Input security

Validate:

- IDs and enumerations.
- Coordinates and times.
- ROI size.
- File type and declared dimensions.
- Archive paths.
- Decompressed sizes.
- NetCDF/Zarr metadata.
- Job parameters.
- Pagination and output limits.

Provider files are parsed in constrained workers. Archive traversal, path traversal, and decompression bombs are explicitly blocked.

## Browser security

- Strict CSP.
- Restricted CORS.
- Subresource integrity where practical.
- No secrets in browser bundles.
- Safe URL handling.
- Dependency review.
- Protection against XSS through framework escaping and sanitized rich content.
- Clickjacking policy appropriate to embedding requirements.

## Service security

- Non-root containers.
- Least-privilege service accounts.
- Private databases and queues.
- TLS externally.
- Secrets from managed secret stores.
- Parameterized database access.
- Rate limiting.
- Audit logging for privileged operations.

## Supply chain

- Lockfiles are committed.
- CI scans dependencies, containers, licences, and secrets.
- Build artifacts are traceable to source commits.
- Production images are signed where infrastructure supports it.

## Incident response

Security events include unauthorized access, credential leakage, malicious source files, integrity failures, and abnormal export activity. Response procedures cover containment, credential rotation, asset invalidation, user notification policy, and evidence retention.

