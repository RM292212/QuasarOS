# SecurityTests.md

## Purpose

Verify confidentiality, integrity, availability, authorization boundaries, and safe handling of untrusted input.

## Automated checks

- Static analysis for TypeScript, Python, infrastructure, and container definitions.
- Dependency and license scanning.
- Secret scanning.
- Container and operating-system package scanning.
- Software bill of materials generation.
- Infrastructure policy checks.
- Dynamic application and API security testing in an isolated environment.

## Authentication and sessions

Test:

- OIDC authorization-code flow with PKCE.
- State, nonce, redirect URI, issuer, audience, signature, and expiry validation.
- Rejection of malformed, expired, replayed, or incorrectly scoped tokens.
- Logout and session expiry.
- No token storage in unsafe persistent browser locations.
- Service-account scope and rotation behavior.
- Development authentication disabled in production.

## Authorization

For every protected endpoint and object, test anonymous, permitted, and forbidden identities. Verify tenant or project separation, administrative operations, dataset restrictions, job ownership, saved configuration access, and signed asset access. Object identifiers must not bypass authorization.

## Input and output handling

Test SQL injection, path traversal, unsafe object keys, oversized bodies, malformed JSON, Unicode edge cases, server-side request forgery defenses, header injection, cross-site scripting, content-type confusion, archive expansion, and scientific parser limits.

## Browser security

Verify:

- Content Security Policy.
- Secure, HttpOnly, and SameSite cookie policy where cookies are used.
- HTTPS enforcement and HSTS.
- Frame-ancestor restrictions.
- Referrer and permissions policies.
- CORS allowlist.
- Subresource and worker restrictions.
- No secrets or sensitive signed URLs in logs, analytics, or error messages.

## Abuse and resilience

Test rate limits, bounded pagination, job quotas, decompression limits, parser timeouts, repeated failed authentication, cancellation, and resource exhaustion. Security controls must not silently alter scientific output.

## Remediation gate

Critical and high exploitable findings block release. Medium findings require triage, ownership, and a remediation deadline. Reports must redact credentials and sensitive payloads.

Reference:

- https://owasp.org/www-project-web-security-testing-guide/
