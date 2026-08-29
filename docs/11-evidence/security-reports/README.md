# Security Reports

This directory stores security assessment, scanning, threat-model, remediation, and release-approval evidence.

## Required report types

- Static application security analysis.
- Dependency vulnerability scan.
- Container and operating-system scan.
- Secret scan.
- Infrastructure policy scan.
- SBOM and provenance verification.
- Dynamic application security assessment.
- API authorization test report.
- Threat-model review.
- Penetration-test summary where required.
- Remediation and risk-acceptance record.

## Naming

Use:

`<release>-<scope>-security-<timestamp>.<extension>`

Sensitive reports may use an opaque evidence identifier rather than a descriptive public filename.

## Required metadata

Each report contains:

- Release and commit.
- Scanned artifact digest.
- Tool and rule-set version.
- Execution environment.
- Scan timestamp.
- Finding identifiers and severities.
- Affected components.
- Exploitability assessment.
- Remediation status.
- Owner and due date.
- Accepted-risk authority and expiry where applicable.

## Handling

Security reports may contain information useful to attackers. Store detailed findings in access-controlled evidence storage. Repository content should contain sanitized summaries and durable references.

Never include:

- Active credentials.
- Full authentication tokens.
- Exploit payloads.
- unrestricted signed URLs.
- Private keys.
- Sensitive production topology beyond approved disclosure.
- Personal information unrelated to the finding.

## Release policy

Unresolved critical or high exploitable findings block release. Medium and lower findings require triage, ownership, and remediation deadlines according to policy.

A risk acceptance must identify impact, compensating controls, approver, and expiry. Risk acceptance does not change the underlying finding result.

## Integrity and retention

Generated reports must not be edited to hide findings. Store the original report checksum. Security evidence follows the organization’s restricted-access and retention policy and may outlive normal CI artifacts.
