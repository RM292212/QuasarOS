# FailureAndRetryPolicy.md

## Purpose

Define how task failures are classified, retried, escalated, and recorded.

## Failure classes

- **Transient:** temporary service, network, rate-limit, or runner failure.
- **Deterministic:** repeatable test, build, schema, or implementation failure.
- **Dependency:** required artifact or environment is unavailable.
- **Capacity:** insufficient memory, GPU, storage, quota, or time.
- **Permission:** missing or excessive authorization.
- **Contract:** input or output violates an approved interface.
- **Scientific:** numerical or semantic validation fails.
- **Security:** suspected exposure or unsafe behavior.
- **Orchestration:** duplicate assignment, stale state, or invalid dependency graph.
- **Unknown:** cause not yet established.

## Retry rules

Only transient failures are automatically retried. Automatic retries must:

- Be bounded.
- Use exponential backoff with jitter.
- Respect server retry guidance.
- Apply only to idempotent operations.
- Retain the original correlation and task identifiers.
- Stop when the failure becomes deterministic.

Recommended default: no more than three automated attempts unless a subsystem-specific policy states otherwise.

## Prohibited retries

Do not automatically retry:

- Destructive database operations.
- Product publication without idempotency guarantees.
- Credential or authorization failures.
- Scientific validation failures.
- Merge conflicts.
- Failed security checks.
- Operations that may have completed but lack a discoverable idempotency key.

## Failure handling

On failure, the agent:

1. Stops dependent destructive actions.
2. Preserves logs and relevant artifacts.
3. Classifies the failure.
4. Records attempt number and environment.
5. Determines whether state changed.
6. Retries only when policy permits.
7. Reports a blocker or requests intervention otherwise.

## Retry exhaustion

After retries are exhausted, the task becomes `blocked` or `failed`, not `in_progress`. The report includes:

- Failure summary.
- Reproduction steps.
- Attempts and timestamps.
- Evidence links.
- Suspected cause.
- State that may require cleanup.
- Recommended owner and next action.

## Security and scientific failures

Security failures are escalated immediately and may require secret revocation or incident response. Scientific failures block integration until explained; widening a tolerance solely to make a test pass is prohibited.

## Duplicate execution

Task operations must be designed to tolerate duplicate delivery where practical. The orchestrator uses task attempt IDs and artifact checksums to prevent duplicate completion records.
