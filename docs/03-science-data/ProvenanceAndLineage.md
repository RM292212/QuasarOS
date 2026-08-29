# Provenance and Lineage

**File:** `docs/03-science-data/ProvenanceAndLineage.md`  
**Status:** Normative

## Principle

Every published scientific or rendering product shall be traceable to its source assets and processing operations.

## Provenance entities

- Provider.
- Source asset.
- Acquisition event.
- Validation report.
- Processing run.
- Canonical dataset.
- Derived product.
- Render product.
- Analysis job.
- Export artifact.
- Software build.
- Algorithm version.

## Source provenance

Record:

- Provider and product.
- Source identifier and URI or query.
- Retrieval time.
- Source publication or update time.
- Checksum and size.
- Licence.
- Authentication class, excluding credentials.
- Original metadata snapshot.

## Processing provenance

Record:

- Input identities.
- Processing configuration.
- Software commit and image.
- Library versions.
- Coordinate transformations.
- Unit conversions.
- QC policy.
- Regridding.
- Precision and quantization.
- Chunking, LOD, and brick configuration.
- Start, completion, and operator/service identity.
- Validation result.

## Lineage graph

Lineage is a directed acyclic graph:

    source asset
      → canonical dataset
      → derived scientific product
      → rendering product
      → user analysis or export

Products may have multiple parents. Cycles are prohibited.

## Immutability

A provenance record is immutable after publication. Corrections create a superseding record linked to the prior identity.

## Reproducibility record

A reproducibility export includes:

- Dataset and variable IDs.
- Source and processing versions.
- Time and ROI.
- Coordinate and unit conventions.
- QC policy.
- Derivation and collocation parameters.
- Transfer function and rendering settings.
- Application and schema versions.

Temporary signed URLs and secrets are excluded.

## Validation

A dataset cannot be published if any required output lacks a complete path to an authoritative source or approved generated test fixture.
