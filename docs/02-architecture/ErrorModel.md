# Error Model

**File:** `docs/02-architecture/ErrorModel.md`  
**Status:** Normative

## Principles

Errors shall be:

- Specific.
- Machine-readable.
- Safe for users.
- Correlated across services.
- Recoverable where possible.
- Distinct from scientific missing-data states.

## API error schema

    {
      "error": {
        "code": "DATASET_NOT_FOUND",
        "message": "The requested dataset is unavailable.",
        "requestId": "uuid",
        "retryable": false,
        "details": {}
      }
    }

`details` shall contain only safe, structured information.

## Error categories

| Prefix | Category |
|---|---|
| `AUTH_*` | Authentication or authorization |
| `VALIDATION_*` | Invalid request or metadata |
| `CATALOG_*` | Catalog and publication |
| `SOURCE_*` | External provider |
| `DATA_*` | Canonical data or coordinates |
| `RENDER_*` | Manifest, brick, shader, or GPU |
| `ANALYSIS_*` | Scientific analysis |
| `STORAGE_*` | Object or database storage |
| `JOB_*` | Job lifecycle |
| `RATE_*` | Quota or rate limit |
| `INTERNAL_*` | Unexpected internal failure |

## HTTP mapping

- `400`: malformed request.
- `401`: authentication required.
- `403`: access denied.
- `404`: resource absent or not visible.
- `409`: version, state, or idempotency conflict.
- `413`: request too large.
- `422`: scientifically or structurally invalid request.
- `429`: rate or quota exceeded.
- `500`: unexpected server failure.
- `502/503/504`: dependency or temporary availability failure.

## Scientific missing states

The following are values, not transport errors:

- Missing in source.
- Land.
- Below seabed.
- Outside model domain.
- QC rejected.
- Not observed.
- Not loaded.
- Temporally unavailable.
- Incompatible for analysis.

They use typed validity fields and shall not be represented as zero or generic server failure.

## Client behavior

- Retry only when `retryable` is true or policy explicitly permits it.
- Use bounded exponential backoff with jitter.
- Cancel retries after state changes.
- Preserve lower-resolution data during brick failure.
- Prevent stale responses from replacing current state.
- Show user action and request ID for support-relevant failures.

## Logging

Server logs include full internal context, request ID, safe resource IDs, stack trace, and dependency status. Client messages exclude stack traces, credentials, internal paths, and signed URLs.

## Unknown errors

Unexpected failures map to `INTERNAL_UNEXPECTED`. The original exception is retained only in protected logs and monitoring.

