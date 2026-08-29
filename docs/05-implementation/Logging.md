# Logging

**File:** `docs/05-implementation/Logging.md`  
**Status:** Normative

## Format

Production logs shall use structured JSON.

Required fields:

- Timestamp.
- Severity.
- Service.
- Environment.
- Version.
- Message.
- Event code.
- Request or correlation ID.
- Operation.
- Duration where applicable.
- Outcome.

Optional safe fields include dataset, product, variable, job, render-product, and provider IDs.

## Levels

- `DEBUG`: development diagnostics.
- `INFO`: normal lifecycle events.
- `WARNING`: degraded but recoverable conditions.
- `ERROR`: failed operation.
- `CRITICAL`: service integrity or security threat.

## Prohibited content

Never log:

- Passwords.
- Tokens.
- Cookies.
- Authorization headers.
- Provider credentials.
- Signed URLs.
- Database connection strings.
- Raw restricted datasets.
- Full user-submitted file content.
- Unnecessary personal data.

## Scientific operations

Log scientific identity, not complete values:

- Input dataset IDs.
- Algorithm ID and version.
- QC policy.
- Output identity.
- Validation status.
- Processing duration.

Complete provenance belongs in provenance records.

## Browser logging

Browser logs use a centralized logger. Production suppresses verbose shader and frame logs. User-facing diagnostics may export sanitized capability and error information with consent.

## Correlation

The browser sends a request ID or accepts one from the server. API, job, worker, storage, and result logs retain the same correlation chain.

## Error logging

Unexpected exceptions include protected stack traces server-side. User responses contain stable codes and request IDs only.

## Retention

Retention varies by environment and security policy. Debug logs have short retention. Audit and security logs follow dedicated policy.

## Testing

Automated tests scan representative logs for secrets, tokens, signed URLs, and accidental large payloads.
