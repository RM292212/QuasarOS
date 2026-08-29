# ADR-0002: CesiumJS as a Separate Geographic Workspace

- **Status:** Accepted
- **Decision type:** Frontend and rendering architecture
- **Owners:** Geospatial, rendering, and architecture teams

## Context

QuasarOS requires two related but distinct spatial experiences:

1. A globe-scale geographic overview for discovering datasets, understanding coverage, viewing observations, and selecting regions.
2. A local scientific Volume Lab for high-detail volumetric rendering, clipping, slicing, transfer functions, and exact inspection.

CesiumJS is well suited to global terrain, imagery, geodetic coordinates, camera navigation, and large-scale geospatial layers. Babylon.js is selected for the specialized local Volume Lab. Attempting to operate both engines in one canvas or one shared scene graph would create fragile lifecycle, coordinate, event, depth-buffer, and GPU-resource coupling.

## Decision

Use CesiumJS in a dedicated **Ocean Overview** workspace and Babylon.js in a separate **Volume Lab** workspace.

Each workspace has:

- Its own canvas.
- Its own rendering lifecycle.
- Its own camera model.
- Its own GPU resource ownership.
- Its own quality and failure state.
- An explicit activation and disposal policy.

The workspaces share application-level scientific context rather than renderer objects.

## Shared context

The following state may transfer between workspaces:

- Dataset and product version.
- Variable.
- Selected time.
- Geographic region.
- Depth range.
- Observation selection.
- Selected geographic point.
- Transfer-function preset where meaningful.
- User mode and saved configuration.

The transfer contract uses serializable domain values. Cesium entities, Babylon meshes, GPU textures, camera objects, and engine-specific coordinate types must not cross the workspace boundary.

## Coordinate handoff

The Overview operates primarily in geographic and Earth-centered coordinate systems. The Volume Lab uses a local coordinate frame with an explicit origin and transforms.

On entry to the Volume Lab:

1. Resolve the selected geographic region.
2. Choose and record a local origin.
3. Generate geographic-to-local and local-to-data transforms.
4. Validate axis orientation and depth direction.
5. initialize the local camera from the selected region.
6. preserve the original geographic bounds for provenance and return navigation.

Coordinate transforms use double precision on the CPU. GPU values use the documented local-origin or high/low precision strategy.

## Lifecycle

Only the active 3-D workspace receives animation frames and high-priority streaming requests. An inactive workspace may preserve serializable state but must release resources according to memory policy.

Switching workspaces must not:

- Create duplicate uncontrolled render loops.
- retain obsolete GPU atlases.
- lose selected dataset or time.
- reinterpret longitude, depth, or units.
- trigger simultaneous high-volume prefetch from both engines.

## Consequences

### Positive

- Each engine is used for its strongest domain.
- Clear coordinate and resource boundaries.
- Independent renderer failure recovery.
- Simpler testing and performance analysis.
- Reduced coupling between global and local visualization.

### Negative

- Switching workspaces requires explicit state synchronization.
- Users do not see the globe and high-detail volume in one shared 3-D scene.
- Some visual layers require separate implementations.
- Both engines contribute to bundle and maintenance cost.

## Rejected alternatives

- One mixed Cesium/Babylon canvas.
- Babylon-only globe implementation.
- Cesium-only volume laboratory.
- Two continuously active canvases sharing uncontrolled state.

## Validation

Validate workspace transitions, coordinate round trips, state preservation, resource disposal, keyboard focus, renderer recovery, and reproducibility export.
