# Deployment Architecture

**File:** `docs/02-architecture/DeploymentArchitecture.md`  
**Status:** Normative

## Environments

- **Local:** developer workstation and Docker Compose.
- **Development:** shared integration environment.
- **Staging:** production-like release validation.
- **Production:** controlled user-facing deployment.

Data, credentials, buckets, databases, and queues shall be isolated by environment.

## Production topology

    Browser
       │ HTTPS
       ▼
    CDN / Reverse Proxy / WAF
       ├── Static web application
       ├── FastAPI control plane
       └── Object-storage data endpoint
                │
        ┌───────┴────────┐
        ▼                ▼
    PostgreSQL       Object storage
        │                ▲
        ▼                │
    Job queue ─────► Scientific workers

## Browser delivery

- Static assets use immutable hashed filenames.
- Security headers are applied at the proxy or CDN.
- API and data origins use explicit CORS policy.
- Service-worker use requires a documented cache and upgrade strategy.

## API deployment

- Multiple stateless replicas.
- Readiness requires database connectivity and required configuration.
- Liveness checks process health only.
- Graceful shutdown stops new requests before termination.
- Resource requests and limits are defined.

## Worker deployment

Workers are separated by workload:

- Metadata and lightweight query workers.
- Scientific-analysis workers.
- Ingestion and conversion workers.
- Optional high-memory workers.
- Future GPU workers only when justified.

Queue routing prevents heavy ingestion from starving interactive analyses.

## Storage

- Production should use managed PostgreSQL/PostGIS and S3-compatible object storage where available.
- Buckets separate source, canonical, render, result, and temporary assets.
- Lifecycle rules remove expired temporary outputs.
- Published assets are protected from accidental mutation.

## TLS and networking

- External traffic uses TLS.
- Internal service encryption follows infrastructure policy.
- Databases and queues are private.
- Administrative access uses restricted networks or identity-aware proxies.

## Deployment strategy

Web and API releases use rolling or blue-green deployment. Database migrations execute before incompatible application rollout. Schema changes follow expand-migrate-contract sequencing.

## Rollback

A release is rollback-capable when:

- Previous images remain available.
- Database changes are backward compatible or have a tested rollback.
- Catalog pointers can return to prior immutable render products.
- Static assets remain available during client-cache transition.

## Disaster recovery

Back up:

- PostgreSQL data and migrations.
- Provider and processing configuration.
- Provenance records.
- Necessary private object-store metadata.
- Access-policy configuration.

Recovery tests shall verify catalog consistency with object storage.

