# Ingestion Implementation

**File:** `docs/05-implementation/IngestionImplementation.md`  
**Status:** Normative

## Pipeline

    discover
      → authorize
      → acquire
      → checksum
      → register source
      → inspect metadata
      → validate
      → normalize
      → generate canonical product
      → generate rendering products
      → validate outputs
      → publish

## Source adapters

Adapters implement:

- Discovery.
- Metadata inspection.
- Bounded acquisition.
- Retry and resume.
- Licence metadata.
- Source identity.
- Variable listing.
- Subset reading where supported.

Provider-specific logic shall remain inside adapters.

## Acquisition

- Use provider-supported APIs and protocols.
- Respect rate limits.
- Stream downloads to temporary storage.
- Enforce maximum sizes.
- Verify checksum when supplied.
- Compute a local checksum otherwise.
- Record retrieval timestamp and response metadata.
- Never log credentials.

## Validation

Validate:

- File format.
- Dimensions.
- Coordinates.
- Time.
- Units.
- Fill values.
- Grid topology.
- Vertical coordinates.
- Variable mappings.
- QC metadata.
- Licence state.

## Canonical processing

- Preserve source variable names.
- Map registry identities.
- Normalize approved units.
- Retain source and normalized QC.
- Preserve provenance.
- Rechunk for supported access.
- Avoid irreversible source replacement.

## Publication

Outputs are written to temporary versioned locations. After validation:

1. Promote immutable object references.
2. Commit database records transactionally.
3. Mark dataset `PUBLISHED`.
4. Emit `dataset.published`.

## Idempotency

The source checksum plus processing-configuration version defines processing identity. Repeated ingestion shall reuse or verify existing outputs.

## Failure

Failed runs retain diagnostics but do not publish partial data. Temporary assets are cleaned according to retention policy.
