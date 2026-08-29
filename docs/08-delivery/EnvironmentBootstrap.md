# EnvironmentBootstrap.md

## Purpose

Create a complete QuasarOS environment from infrastructure code and validate that it is ready for application deployment.

## Supported environments

| Environment | Purpose | Data policy |
|---|---|---|
| Local | Developer work | Synthetic and approved small fixtures |
| Development | Shared integration | Non-sensitive test data |
| Staging | Production-like qualification | Approved representative data |
| Production | User service | Governed production data |
| Ephemeral | CI and previews | Generated or isolated fixtures |

## Prerequisites

- Approved cloud or cluster account.
- Remote infrastructure-state backend.
- Workload identity for automation.
- DNS zone and TLS authority.
- Encryption keys.
- Secrets-manager namespace.
- Network and storage quotas.
- Environment owner and cost labels.

## Bootstrap order

1. Create or select the infrastructure-state backend.
2. Establish identity roles and deployment trust.
3. Create network boundaries, private subnets, and egress controls.
4. Provision cluster or compute platform.
5. Provision PostgreSQL/PostGIS with backup policy.
6. Provision queue/cache.
7. Create versioned object-storage buckets and lifecycle rules.
8. Configure CDN and ingress.
9. Configure DNS and TLS.
10. Install secrets, policy, and certificate integrations.
11. Install observability collectors and alert routing.
12. Create application namespaces and service identities.
13. Apply quotas, network policies, and disruption policies.
14. Deploy database migration job.
15. Deploy application services.
16. Execute `DataBootstrap.md` for the approved profile.
17. Run readiness and P0 smoke tests.

## Idempotency

Infrastructure bootstrap uses declarative, version-controlled code. Reapplying unchanged configuration must produce no destructive change. State imports and manual repairs require review and documentation.

## Validation

The environment is ready only when:

- DNS and TLS validate.
- Private services are not publicly reachable.
- Workload identities have expected permissions.
- Database backup and WAL archiving are active.
- Object versioning and encryption are enabled.
- Logs, metrics, and traces reach the monitoring backend.
- Alerts route to a test destination.
- API and worker health checks pass.
- A synthetic dataset can be published, queried, rendered, and removed.
- Environment metadata appears in deployment and incident tooling.

## Destruction

Ephemeral and development environments may have reviewed destruction workflows. Production destruction is denied by policy and requires a separately approved disaster or decommissioning procedure.
