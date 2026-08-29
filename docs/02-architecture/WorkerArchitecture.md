# Worker Architecture

**File:** `docs/02-architecture/WorkerArchitecture.md`  
**Status:** Normative

## Worker classes

### Browser decode workers

Responsibilities:

- Validate brick headers.
- Decompress payloads.
- Apply approved unpacking.
- Prepare transferable upload buffers.
- Parse Arrow observation payloads.
- Compute bounded non-authoritative display metadata.

They shall not own WebGPU or WebGL resources unless a later approved architecture explicitly adopts offscreen rendering.

### Acquisition workers

Responsibilities:

- Authenticate to approved providers.
- Download bounded source assets.
- Resume where supported.
- Verify checksums.
- Record source metadata.
- Store authoritative bytes.

### Processing workers

Responsibilities:

- Validate scientific metadata.
- Normalize coordinates and units.
- Create canonical arrays.
- Regrid only under configured policy.
- Generate LODs, bricks, halos, masks, and acceleration metadata.
- Produce validation reports.

### Analysis workers

Responsibilities:

- Exact profile extraction.
- Collocation.
- Derived fields.
- Statistics.
- Climatological comparisons.
- Reproducibility artifacts.

## Job contract

Every job contains:

- Job ID and type.
- Input immutable identities.
- Parameters and schema version.
- Algorithm version.
- Requesting identity and policy scope.
- Priority and resource class.
- Idempotency key.
- Cancellation state.
- Output destination.
- Retry policy.

## Resource classes

Workers are assigned to bounded classes such as:

- Small metadata.
- Standard analysis.
- High-memory processing.
- I/O-intensive acquisition.
- Future GPU-enabled processing.

Schedulers shall not send a high-memory job to an undersized worker.

## Cancellation

Workers check cancellation:

- Before acquiring large inputs.
- Between partitions.
- Before committing outputs.
- During lengthy iterative processing where safe.

Cancelled jobs remove uncommitted temporary assets according to cleanup policy.

## Retry

Retries are allowed for transient network, provider, queue, or storage failures. Scientific validation failures, incompatible coordinates, unsupported grids, and malformed source data are not automatically retried without changed inputs or configuration.

## Idempotency

Outputs are written to temporary versioned locations. After validation, workers atomically publish immutable result references. Repeated jobs with identical identities may reuse validated outputs.

## Browser-worker messaging

Messages shall:

- Be typed and versioned.
- Use transferable buffers.
- Avoid copying large arrays.
- Include request and generation IDs.
- Support cancellation.
- Reject stale results.

## Observability

Workers emit progress, memory class, input identity, output identity, timing, retry count, and terminal status. Scientific workers additionally emit provenance and validation references.

