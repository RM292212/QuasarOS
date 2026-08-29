# Error Handling

**File:** `docs/05-implementation/ErrorHandling.md`  
**Status:** Normative

## Error hierarchy

Application errors use typed categories from `docs/02-architecture/ErrorModel.md`.

Backend exception groups:

- `AuthenticationError`
- `AuthorizationError`
- `RequestValidationError`
- `DatasetError`
- `ScientificValidationError`
- `SourceProviderError`
- `StorageError`
- `AnalysisError`
- `JobError`
- `InternalError`

## Backend mapping

Exception handlers shall:

- Assign or retain request ID.
- Map exception to stable error code.
- Select HTTP status.
- Mark retryability.
- Emit structured logs.
- Return a safe message.
- Hide stack traces and internal paths.

## Frontend handling

Frontend error boundaries are separated for:

- Application shell.
- Ocean Overview.
- Scientific Volume Lab.
- Observation panel.
- Analysis panel.

Recoverable request failures use inline states or notifications. Fatal renderer failures trigger backend recovery or fallback.

## Rendering errors

- Failed brick: retain parent LOD and show incomplete state.
- Invalid brick: discard and report.
- Shader failure: disable affected variant or renderer.
- Device loss: rebuild or use WebGL2.
- Context loss: restore resources.
- Allocation failure: evict or lower quality.

## Scientific errors

Scientific incompatibility shall be explicit, including:

- Unit mismatch.
- Unsupported grid.
- Missing coordinate metadata.
- Insufficient valid pairs.
- Extrapolation required.
- Unsupported variable definition.

These shall not be converted into empty successful results.

## Retry policy

Retry only transient failures with bounded exponential backoff and jitter. Validation, authorization, and scientific incompatibility errors are not automatically retried.

## User messages

Messages shall explain:

- What failed.
- Whether existing data remain valid.
- What the user can do.
- Request ID when support may be needed.
