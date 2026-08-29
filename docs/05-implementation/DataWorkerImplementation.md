# Data Worker Implementation

**File:** `docs/05-implementation/DataWorkerImplementation.md`  
**Status:** Normative

## Browser workers

Browser workers handle:

- Brick decompression.
- Checksum verification where configured.
- Binary header parsing.
- Quantized value unpacking.
- Arrow IPC parsing.
- Transferable upload-buffer preparation.
- Bounded histogram or display-only calculations.

## Worker contract

Every request includes:

- Request ID.
- Generation ID.
- Operation.
- Schema version.
- Input identity.
- Transferable buffers.
- Cancellation signal or cancellation token.

Every response includes:

- Request ID.
- Generation ID.
- Status.
- Output metadata.
- Transferable buffers.
- Typed error where applicable.

## Memory policy

- Transfer buffers instead of copying.
- Reuse pools only with strict ownership.
- Release references after transfer.
- Limit decoded bytes per worker.
- Reject declared decompressed sizes above policy.
- Never retain complete datasets in workers.

## Worker pool

Pool size is derived from:

- Hardware concurrency.
- Memory budget.
- Active quality profile.
- Browser capability.

At least one main-thread core should remain available for UI and rendering.

## Cancellation

Workers check cancellation before decompression, after decompression, before conversion, and before returning results. Stale generations are dropped.

## Validation

Before output:

- Verify format version.
- Check compressed and uncompressed sizes.
- Validate brick identity.
- Validate datatype and dimensions.
- Validate checksum if provided.
- Verify finite scale and offset.
- Enforce resource bounds.

## Failure behavior

Malformed or oversized payloads return typed errors and are never uploaded to the GPU. Repeated worker crashes reduce concurrency and surface a recoverable renderer error.

## Testing

Test malformed headers, decompression bombs, cancellation, stale results, buffer transfer, memory reuse, worker restart, and deterministic decoding.
