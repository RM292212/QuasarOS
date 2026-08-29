# Component Architecture

**File:** `docs/02-architecture/ComponentArchitecture.md`  
**Status:** Normative

## Layering

QuasarOceanScope uses dependency direction from presentation toward domain contracts:

    UI components
        ↓
    Application controllers and state
        ↓
    Domain models and use cases
        ↓
    Ports and contracts
        ↓
    API, storage, Cesium, Babylon, WebGPU/WebGL2 adapters

Domain packages shall not import React, CesiumJS, Babylon.js, FastAPI, or database implementations.

## Frontend components

### Application shell

Owns routing, workspace selection, global status, error boundaries, authentication state, and accessibility landmarks.

### Dataset browser

Handles provider, product, dataset, variable, run, and time discovery.

### Ocean Overview

Wraps CesiumJS for footprints, ROI selection, geographic context, observations, and synchronized camera targets.

### Scientific Volume Lab

Wraps Babylon.js and the renderer abstraction for volumes, surfaces, vectors, observations, clipping, and picking.

### Timeline

Represents valid time, reference time, lead time, observation windows, playback, and prefetch intent.

### Transfer-function editor

Edits physical-value color and opacity mappings and emits renderer-independent transfer-function state.

### Inspector

Displays exact and approximate values, coordinates, QC, grid information, and provenance.

### Observation explorer

Searches platforms and profiles and displays source metadata and measurements.

### Analysis panel

Submits collocation jobs and displays profile overlays, residuals, statistics, and provenance.

## Backend components

- API gateway/router.
- Authentication and authorization adapter.
- Catalog repository.
- Dataset publication service.
- Scientific query engine.
- Observation repository.
- Collocation engine.
- Analysis job coordinator.
- Object-storage signer.
- Provenance service.
- Audit and observability adapters.

## Rendering components

- Capability detector.
- Backend selector.
- Render coordinator.
- Brick scheduler.
- CPU cache.
- GPU residency manager.
- Page table.
- Transfer-function manager.
- WebGPU backend.
- WebGL2 backend.
- Surface and bathymetry renderer.
- Vector renderer.
- Observation renderer.
- Picking and inspection mapper.

## Component communication

- React components communicate through typed application actions and selectors.
- Network state uses TanStack Query.
- Domain interaction state uses Zustand or approved stores.
- Workers communicate using versioned messages through Comlink or typed channels.
- Rendering components consume immutable frame-state snapshots.
- Backend components use explicit service interfaces and repository ports.

## Rules

- No component reads another component’s private state.
- No UI component constructs object-storage URLs.
- No shader owns scientific unit conversion.
- No rendering component performs authoritative scientific analysis.
- No backend route embeds provider-specific parsing.
- Cross-component events must use `EventContracts.md`.

