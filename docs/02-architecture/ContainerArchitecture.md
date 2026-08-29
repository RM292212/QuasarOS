# Container Architecture

**File:** `docs/02-architecture/ContainerArchitecture.md`  
**Status:** Normative

## Production containers

| Container | Responsibility |
|---|---|
| `web` | Static React/Vite application |
| `api` | FastAPI control-plane API |
| `worker` | Scientific and analysis jobs |
| `scheduler` | Scheduled acquisition and maintenance |
| `postgres` | Catalog, PostGIS metadata, jobs, provenance |
| `object-store` | Local S3-compatible storage when managed storage is unavailable |
| `reverse-proxy` | TLS termination, routing, headers, rate limits |
| `queue` | Optional durable job coordination |
| `monitoring` | Metrics, dashboards, and alerting where deployed |

## Images

Images shall:

- Use pinned base-image versions.
- Run as non-root.
- Include only runtime dependencies.
- Expose health checks.
- Support read-only root filesystems where practical.
- Write only to declared volumes.
- Contain OCI labels for source commit and build version.
- Pass vulnerability scanning.

Development tools shall not be included in production images.

## Network boundaries

- Only the reverse proxy is publicly exposed.
- API, workers, databases, queues, and internal object-storage endpoints use private networks.
- Browser object access uses approved public or signed endpoints.
- Database ports shall not be publicly reachable.
- Administrative endpoints require explicit authorization.

## Volumes

Persistent volumes are required for:

- PostgreSQL.
- Local object storage.
- Queue persistence where enabled.
- Monitoring state according to deployment policy.

Application containers shall remain disposable.

## Configuration

Configuration is supplied through:

- Environment variables.
- Mounted non-secret configuration.
- Secret-management integration.
- Dataset and provider registry records.

Secrets shall never be baked into images.

## Scaling

- `web`: CDN/static-host scaling.
- `api`: horizontal stateless replicas.
- `worker`: horizontal scaling by queue and resource class.
- `scheduler`: single active leader or distributed lease.
- `postgres`: managed HA or documented backup strategy.
- `object-store`: managed S3 or clustered compatible storage.

GPU processing workers, if later added, use a separate worker image and queue.

## Development profile

Local development may use Docker Compose with:

- Web development server.
- API.
- Worker.
- PostgreSQL/PostGIS.
- MinIO.
- Optional queue.
- Reverse proxy only when testing production routing.

## Shutdown

Containers shall handle termination signals, stop accepting new work, complete or safely checkpoint work, release leases, flush logs, and exit within the configured grace period.

