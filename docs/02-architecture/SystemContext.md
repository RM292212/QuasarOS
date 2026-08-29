# System Context

**File:** `docs/02-architecture/SystemContext.md`  
**Status:** Normative

## System purpose

QuasarOS hosts scientific applications. QuasarOceanScope is its ocean-data visualization and analysis application.

## Context diagram

    Ocean-data providers
      ├── INCOIS
      ├── Copernicus Marine
      ├── Argo GDAC
      ├── HYCOM
      ├── GEBCO
      └── NOAA and approved sources
              │
              ▼
    QuasarOS ingestion and processing
              │
       ┌──────┴────────┐
       ▼               ▼
    Canonical data   Rendering products
       │               │
       └──────┬────────┘
              ▼
    QuasarOS control and data planes
              │
              ▼
    Browser application
      ├── Ocean Overview
      └── Scientific Volume Lab
              │
              ▼
    Researchers, analysts, educators,
    students, public users, and operators

## External actors

### Scientific user

Explores, inspects, compares, analyzes, and exports documented results.

### Data engineer

Configures providers, acquisition, validation, processing, and publication.

### Administrator

Manages deployment policy, access, quotas, monitoring, and recovery.

### External provider

Supplies authoritative source data and metadata under provider-specific access and licence conditions.

### Identity provider

Authenticates users and supplies trusted identity claims.

### Object-storage or CDN provider

Stores and delivers immutable scientific and rendering assets.

## System responsibilities

QuasarOS is responsible for:

- Source registration and acquisition records.
- Scientific metadata preservation.
- Canonical normalization.
- Rendering-product generation.
- Catalog publication.
- Browser-native 3-D rendering.
- Exact-value queries.
- Observation visualization.
- Model-observation comparison.
- Derived-product provenance.
- Access policy and reproducibility exports.

## External responsibilities

Providers remain responsible for:

- Original source production.
- Source scientific definitions.
- Upstream corrections.
- Access and licensing terms.

Identity providers remain responsible for authentication. Infrastructure providers remain responsible for contracted storage and network availability.

## Boundaries

QuasarOS does not:

- Run the source ocean models in V1.
- Replace provider archives.
- Guarantee official operational authority.
- Infer absent metadata as fact.
- Treat rendering approximations as canonical measurements.
- Provide navigation or safety-of-life guidance.

## Primary interfaces

- Provider download, API, OPeNDAP, ERDDAP, or object interfaces.
- REST/OpenAPI control plane.
- S3-compatible data plane.
- Browser application.
- OIDC/OAuth identity.
- Metrics, logs, and traces.

