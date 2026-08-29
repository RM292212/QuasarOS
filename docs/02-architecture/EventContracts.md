# Event Contracts

**File:** `docs/02-architecture/EventContracts.md`  
**Status:** Normative

## Purpose

Events coordinate asynchronous components without creating hidden dependencies. Events describe completed facts or explicit requests and use versioned payloads.

## Standard envelope

    {
      "eventId": "uuid",
      "eventType": "dataset.published",
      "eventVersion": 1,
      "occurredAt": "ISO-8601",
      "correlationId": "uuid",
      "causationId": "uuid-or-null",
      "producer": "catalog-service",
      "subject": "dataset-id",
      "payload": {}
    }

## Backend events

| Event | Meaning |
|---|---|
| `source.discovered` | Provider asset discovered |
| `source.acquired` | Source bytes acquired and verified |
| `dataset.validation_succeeded` | Canonical validation passed |
| `dataset.validation_failed` | Validation failed |
| `render_product.ready` | Immutable render product completed |
| `dataset.published` | Dataset became catalog-visible |
| `dataset.withdrawn` | Dataset removed from normal discovery |
| `job.queued` | Job accepted |
| `job.started` | Worker began execution |
| `job.progressed` | Meaningful bounded progress changed |
| `job.succeeded` | Result committed |
| `job.failed` | Job terminated with error |
| `job.cancelled` | Job cancellation completed |

## Frontend domain events

- `selection.dataset_changed`
- `selection.variable_changed`
- `selection.time_changed`
- `selection.roi_changed`
- `selection.observation_changed`
- `renderer.backend_selected`
- `renderer.device_lost`
- `renderer.quality_changed`
- `brick.requested`
- `brick.resident`
- `brick.failed`
- `analysis.requested`
- `analysis.completed`
- `inspection.completed`

Frontend events remain in-process unless explicitly exported to telemetry.

## Delivery semantics

Backend event delivery is at least once. Consumers shall:

- Deduplicate by `eventId`.
- Be idempotent.
- Reject unsupported major event versions.
- Persist checkpoints where required.
- Avoid relying on total global ordering.

Ordering is guaranteed only where explicitly implemented for the same subject.

## Privacy and security

Events shall not contain:

- Credentials.
- Access tokens.
- Signed URLs.
- Unnecessary personal data.
- Large scientific arrays.
- Raw exception traces.

Events carry object references, not heavy payloads.

## Evolution

Additive optional fields are permitted within an event version. Meaning changes, renamed required fields, or removed fields require a new `eventVersion`.

## Failure handling

Unprocessable events move to a dead-letter mechanism with error metadata, retry count, and original event identity. Redelivery shall be bounded and observable.

