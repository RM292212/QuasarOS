# AgentRegistry.md

## Purpose

Define the available agent roles, their capabilities, restrictions, and routing metadata.

## Registry requirements

Every registered agent has:

- Stable agent identifier.
- Human-readable role.
- Owned domains.
- Supported task classes.
- Required context documents.
- Permitted tools and environments.
- Prohibited actions.
- Concurrency limit.
- Review authority.
- Escalation target.
- Maintainer.
- Active, restricted, or retired status.

The registry is version-controlled. An agent must not infer authority from technical capability.

## Standard roles

| Role | Primary responsibility | Typical outputs |
|---|---|---|
| Product agent | Requirements and acceptance criteria | Product specifications, requirement mapping |
| Architecture agent | Boundaries and technical decisions | Architecture updates, ADRs, contracts |
| Frontend agent | React UI and application state | Components, stores, accessibility tests |
| Cesium agent | Geographic overview | Globe layers, camera and picking behavior |
| Volume-rendering agent | Babylon, WebGPU, WebGL 2 | Renderer code, shaders, conformance evidence |
| Backend agent | APIs and service logic | Routes, services, contract tests |
| Data agent | Acquisition and processing | Adapters, products, provenance |
| Science agent | Scientific semantics and validation | Reference calculations, tolerance approval |
| Database agent | PostgreSQL/PostGIS and migrations | Schema changes, migration plans |
| Platform agent | CI, deployment, infrastructure | Pipelines, manifests, runbooks |
| Security agent | Threat and control review | Findings, mitigations, approvals |
| Accessibility agent | WCAG and assistive interaction | Audit results, accessible design changes |
| Test agent | Cross-system verification | Test plans, fixtures, release evidence |
| Documentation agent | User and engineering documentation | Updated documentation and indexes |
| Integrator | Merge coordination and system validation | Integration branch, conflict decisions |

## Routing

Tasks are routed using:

- Required domain.
- Risk classification.
- File ownership.
- Dependency readiness.
- Tool or environment requirement.
- Estimated effort.
- Agent availability.
- Required independence between implementer and reviewer.

A high-risk task may require paired agents. Scientific algorithms require science review; security-sensitive work requires security review; shared rendering contracts require both renderer and science review.

## Restrictions

Agents have no implicit permission to:

- Modify files outside assigned ownership.
- approve their own high-risk change.
- alter release gates.
- access production secrets.
- publish datasets.
- execute production deployments.
- resolve scientific disagreements without the science owner.

## Registry maintenance

Registry changes require orchestrator approval. Retired agents retain historical attribution but receive no new work. Changes to capability or authority must not retroactively alter completed task records.
