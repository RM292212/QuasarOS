# Authentication Implementation

**File:** `docs/05-implementation/AuthenticationImplementation.md`  
**Status:** Normative

## Model

Production deployments should use OpenID Connect with OAuth 2.1 authorization code flow and PKCE.

Supported identities:

- Anonymous public viewer.
- Authenticated user.
- Service account.
- Administrator.
- Data publisher.

## Frontend

The frontend shall:

- Redirect through the configured identity provider.
- Keep access tokens in memory where practical.
- Avoid local-storage token persistence by default.
- Never place tokens in URLs, logs, exports, or analytics.
- Refresh sessions through the approved OIDC client.
- Clear protected state on logout.
- Treat UI permission checks as presentation only.

## Backend

The API shall:

- Validate issuer, audience, signature, expiry, and required claims.
- Map trusted claims to internal roles.
- Enforce authorization on every protected operation.
- Return `401` for missing or invalid authentication.
- Return `403` for valid identity without permission.
- Record privileged operations in audit logs.

## Authorization checks

Policy inputs include:

- Subject.
- Role.
- Tenant or organization.
- Dataset access class.
- Requested operation.
- Export permission.
- Resource quota.
- Spatial or temporal restrictions.

## Service accounts

Service-to-service access uses short-lived workload identity or managed credentials. Static long-lived keys are prohibited where a managed alternative exists.

## Object storage

Restricted assets use short-lived signed URLs generated only after authorization. URLs shall be object-scoped, time-limited, and omitted from logs and reproducibility exports.

## Local development

Development may use a clearly labelled mock identity provider or local development identity. Authentication bypasses shall be impossible in production builds.

## Security tests

Test expired tokens, wrong issuer, wrong audience, altered signatures, role escalation, restricted datasets, signed-URL expiry, logout, CORS, and anonymous access boundaries.
