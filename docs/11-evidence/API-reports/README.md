# API Reports

This directory stores generated evidence that QuasarOS APIs conform to their published OpenAPI, JSON Schema, authentication, error, pagination, and scientific-response contracts.

## Required reports

Release qualification should provide:

- OpenAPI schema validation report.
- Runtime response conformance report.
- Generated-client consistency report.
- Breaking-change assessment.
- Authentication and authorization test report.
- Error-model conformance report.
- Pagination, filtering, and sorting report.
- Exact-query scientific metadata report.
- Signed-asset access report.

## Naming

Use:

`<release>-<environment>-<suite>-<timestamp>.<extension>`

Example:

`v1.4.0-staging-openapi-conformance-20260829.json`

Timestamps use UTC in `YYYYMMDDTHHMMSSZ` form.

## Required metadata

Every report must identify:

- Release and Git commit.
- API and schema version.
- Environment.
- Test suite and tool version.
- Execution timestamp.
- Result status.
- Passed, failed, skipped, and expected-failure counts.
- Failure details.
- Artifact checksum.
- Related task or release identifier.

## Accepted formats

- Markdown for reviewed summaries.
- JSON for machine-readable results.
- HTML for generated interactive reports.
- JUnit XML for CI ingestion.

## Security

Reports must not contain access tokens, cookies, passwords, unrestricted signed URLs, private connection details, or complete sensitive request payloads. Redaction must occur before publication.

## Retention

Reports used by a production release are retained with the release evidence. Pull-request reports may follow normal CI artifact expiry unless referenced by an incident, accepted exception, or scientific investigation.

## Policy

Generated reports must not be edited to change results. Corrections require a new run or an accompanying signed review note explaining the discrepancy.
