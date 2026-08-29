# Deployment.md

## Purpose

Define deployment topology and the safe procedure for releasing QuasarOS to a managed environment.

## Production topology

The recommended deployment uses Kubernetes or an equivalent orchestrator:

- Stateless web replicas behind a CDN and ingress.
- Stateless API replicas behind a load balancer.
- Independently scaled worker pools by resource class.
- A singleton or leader-elected scheduler.
- Managed PostgreSQL/PostGIS.
- Managed Redis-compatible queue/cache.
- Versioned object storage and CDN delivery.
- OpenTelemetry collectors and monitoring services.
- External OIDC identity provider.

Stateful production services should use managed offerings where they satisfy recovery, security, and observability requirements.

## Deployment artifact

Each environment release is described by:

- Application image digests.
- Frontend asset version.
- Database migration revision.
- Infrastructure and Helm or manifest revision.
- Public configuration.
- feature-flag snapshot.
- Scientific product compatibility range.

## Standard procedure

1. Verify release-quality gates.
2. Confirm backup freshness and recovery readiness.
3. Rehearse migrations in staging.
4. Verify signed image and provenance metadata.
5. Apply backward-compatible database migrations.
6. Deploy API and workers with zero unavailable replicas where capacity permits.
7. Deploy web assets under immutable names.
8. Run internal health and dependency checks.
9. Run P0 smoke tests.
10. Start a canary with limited traffic.
11. Monitor error rate, latency, saturation, queue depth, and scientific probes.
12. Increase traffic progressively.
13. Mark the release complete and retain evidence.

## Kubernetes requirements

- Deployments use readiness, liveness, and startup probes.
- Pod disruption budgets protect required availability.
- Anti-affinity or topology spread prevents single-node concentration.
- Resource requests and limits are defined.
- Horizontal scaling uses service-appropriate metrics.
- Network policies restrict service communication.
- Service accounts use least privilege.
- Secrets are mounted or injected from the approved secrets system.
- Database migrations run as a controlled one-time job.

## Frontend deployment

HTML entry points use short cache lifetimes. Content-addressed JavaScript, CSS, shader, and asset files use immutable long-lived caching. Rollback must restore a compatible HTML entry point without deleting newer immutable assets.

## Failure handling

Stop rollout when health checks, smoke tests, SLOs, or scientific probes fail. Roll back application traffic immediately when compatible; follow `Rollback.md` when database or data-product changes are involved.

Reference:

- https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
