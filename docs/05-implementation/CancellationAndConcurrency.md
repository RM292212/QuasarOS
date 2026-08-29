# Cancellation and Concurrency

**File:** `docs/05-implementation/CancellationAndConcurrency.md`  
**Status:** Normative

## Browser cancellation

Use `AbortController` for:

- Catalog requests.
- Manifest requests.
- Brick downloads.
- Observation queries.
- Exact-value queries.
- Analysis submissions and polling.

Every operation carries a generation ID. Late results from an obsolete generation shall be discarded.

## Generation changes

Increment generation when changing:

- Dataset.
- Variable.
- Valid time.
- ROI.
- Render-product version.
- Renderer backend.
- Incompatible quality configuration.

## Browser limits

Configure hard limits for:

- Concurrent brick downloads.
- Compressed bytes in flight.
- Decode-worker tasks.
- Decoded CPU bytes.
- GPU uploads per frame.
- Active exact queries.
- Prefetch operations.

Interactive visible work takes priority over background prefetch.

## Backend concurrency

- API handlers perform bounded I/O.
- Long scientific operations use workers.
- Jobs declare resource class.
- Queue routing separates ingestion from interactive analysis.
- Database transactions remain short.
- Distributed locks are used only for publication, singleton scheduling, or deduplication.

## Job cancellation

Cancellation lifecycle:

    QUEUED → CANCELLED
    RUNNING → CANCELLING → CANCELLED

Workers check cancellation between partitions, before expensive reads, before output commit, and during iterative work where safe.

## Idempotency

Job creation accepts an idempotency key. Identical completed results may be reused when inputs, policy, algorithm, and version match exactly.

## Race prevention

- Use optimistic locking for mutable records.
- Use unique constraints for immutable identities.
- Publish object outputs before committing database references.
- Never update current state from stale asynchronous callbacks.
- Associate uploads with page-table generations.

## Backpressure

When limits are reached:

1. Stop prefetch.
2. Cancel obsolete work.
3. Lower interactive quality.
4. Evict low-priority cache entries.
5. Reject excessive server jobs with a typed quota response.
