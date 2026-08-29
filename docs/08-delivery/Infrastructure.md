# Infrastructure.md

## Purpose

Define infrastructure architecture, ownership, security boundaries, and change-management requirements.

## Infrastructure as code

All persistent infrastructure is declared in version-controlled infrastructure code. This includes:

- Networks and routing.
- Kubernetes or compute clusters.
- PostgreSQL/PostGIS.
- Queue and cache services.
- Object storage and lifecycle policy.
- CDN, DNS, certificates, and ingress.
- Identity and access policies.
- Encryption keys.
- Monitoring and alerting integrations.
- Backup and replication policy.

Manual console changes are prohibited except during an incident. Emergency changes must be imported into code or reverted immediately afterward.

## Network zones

- Public edge: CDN, web entry point, and approved API ingress.
- Application zone: API, worker, scheduler, and observability agents.
- Data zone: database, queue/cache, and private storage endpoints.
- Management zone: deployment, monitoring, and recovery access.

Default-deny policies restrict traffic between zones. Database and queue services are never publicly exposed.

## Identity

Prefer workload identity over static credentials. Each service receives a distinct identity with least-privileged access. Human production access requires strong authentication, short-lived elevation, and audit logging.

## Availability

Production design uses:

- Multiple availability zones where supported.
- Redundant stateless replicas.
- Pod or instance topology spreading.
- Managed database failover.
- Durable queues.
- Versioned object storage.
- Health-based traffic routing.
- Tested backup and recovery.

Region-level redundancy is adopted when required by recovery objectives.

## Capacity

Track and plan:

- API CPU, memory, and concurrency.
- Worker CPU, memory, and temporary disk by job type.
- Database storage, connections, IOPS, and WAL.
- Queue depth and oldest-message age.
- Object count, bytes, request rate, and egress.
- CDN hit ratio.
- Monitoring-cardinality growth.

Capacity alerts must fire before hard limits.

## Change control

Infrastructure plans are reviewed before application. Destructive changes require explicit approval. Production applies use protected automation, not developer workstations. Drift detection runs on a schedule.

## Required metadata

Every resource includes environment, service, owner, cost center, data classification, managed-by, and lifecycle labels.

## References

- https://kubernetes.io/docs/home/
- https://opentelemetry.io/docs/platforms/kubernetes/
