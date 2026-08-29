# IncidentResponse.md

## Purpose

Define how QuasarOS incidents are declared, coordinated, contained, communicated, resolved, and reviewed.

## Severity

| Severity | Definition | Initial response |
|---|---|---:|
| SEV-1 | Broad outage, confirmed scientific corruption, major security event, or unrecoverable data risk | 15 minutes |
| SEV-2 | Major feature unavailable, severe degradation, or limited incorrect results | 30 minutes |
| SEV-3 | Partial degradation with workaround | 4 business hours |
| SEV-4 | Minor operational defect | Normal backlog |

Scientific correctness incidents are never downgraded solely because the service remains available.

## Roles

- **Incident commander:** owns coordination and decisions.
- **Operations lead:** investigates and mitigates service impact.
- **Scientific lead:** assesses data and result integrity.
- **Security lead:** handles suspected compromise.
- **Communications lead:** maintains internal and external updates.
- **Scribe:** records timeline, evidence, and decisions.

One person may hold multiple roles for a small incident, but command ownership must remain explicit.

## Response process

1. Detect or receive a report.
2. Open an incident record and assign severity.
3. Establish a communication channel and roles.
4. Preserve logs, traces, deployment records, and relevant objects.
5. Determine user, data, region, dataset, and time impact.
6. Contain the problem.
7. Disable affected products or features when correctness is uncertain.
8. Restore safe service using rollback, failover, or recovery procedures.
9. Validate exact queries and scientific reference cases.
10. Communicate resolution and remaining limitations.
11. Monitor for recurrence.
12. Complete a blameless post-incident review.

## Scientific incident handling

When displayed or queried results may be wrong:

- Mark affected products unavailable or prominently invalid.
- Preserve product versions and processing provenance.
- Identify every affected dataset, variable, time, and region.
- Do not silently replace published immutable assets.
- Publish corrected product versions.
- Notify affected users when saved analyses or exports may be invalid.

## Security incidents

Rotate exposed credentials, revoke sessions, preserve forensic evidence, and involve the security lead before destructive cleanup. Legal or regulatory notification follows organizational policy.

## Communication cadence

- SEV-1: every 30 minutes.
- SEV-2: every 60 minutes.
- Lower severities: on material changes.

Updates state impact, current action, workaround, and next-update time without speculation.

## Post-incident review

Complete within five business days for SEV-1 and SEV-2 incidents. Include timeline, root and contributing causes, detection gaps, recovery performance, user impact, corrective actions, owners, and due dates.

Reference:

- https://csrc.nist.gov/pubs/sp/800/61/r3/final
