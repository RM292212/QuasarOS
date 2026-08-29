# SecretsManagement.md

## Purpose

Define creation, storage, distribution, rotation, use, auditing, and revocation of secrets.

## Secret classes

- Database credentials.
- OIDC client credentials.
- Service-account tokens.
- Object-storage credentials.
- Signing keys.
- Encryption keys.
- Third-party API keys.
- Webhook credentials.
- TLS private keys.
- Backup and recovery credentials.

Public frontend configuration is not secret. No secret may be embedded in browser bundles.

## Storage

Production secrets reside only in the approved managed secrets system or hardware-backed key service. Kubernetes Secret objects alone are not the system of record. Repository files, container images, issue trackers, chat, logs, and documentation must not contain secret values.

Local development uses ignored local environment files populated from nonproduction examples or local-only credentials.

## Access

- Use workload identity whenever possible.
- Grant access by service and environment.
- Apply least privilege.
- Separate production and nonproduction secrets.
- Require strong authentication and audited elevation for human access.
- Prevent CI jobs from reading unrelated environment secrets.
- Do not expose production secrets to untrusted pull requests.

## Delivery

Secrets are mounted or injected at runtime. Applications read them through a configuration abstraction and must not print them. File-mounted secrets use restrictive permissions. Environment variables are permitted only when the platform and threat model accept their visibility characteristics.

## Rotation

Every secret has:

- Owner.
- Purpose.
- Scope.
- Creation date.
- Rotation policy.
- Expiry where supported.
- Revocation procedure.
- Dependent services.

Rotation should support overlap between old and new credentials. Automated rotation is preferred. After rotation, verify service health and revoke the old value.

## Incident response

On suspected exposure:

1. Treat the secret as compromised.
2. Revoke or rotate it immediately.
3. Identify access and audit history.
4. Search logs and artifacts for disclosure.
5. Rotate dependent credentials if necessary.
6. Open a security incident.
7. Remove the secret from repository history or artifacts without treating removal as sufficient remediation.

## Scanning and logging

Secret scanning runs before commit, in CI, and against built artifacts. Logging libraries and error handlers redact authorization headers, cookies, tokens, passwords, signed query strings, and connection URLs.

## Prohibited practices

- Shared human accounts.
- Long-lived unrestricted cloud keys.
- Secrets in command-line arguments.
- Hard-coded development backdoors.
- Reusing credentials across environments.
- Silent rotation without dependency verification.

Reference:

- https://kubernetes.io/docs/concepts/configuration/secret/
