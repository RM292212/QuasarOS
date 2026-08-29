# Brick and Page Table

**File:** `docs/04-rendering/BrickAndPageTable.md`  
**Status:** Normative

## Brick model

Large volumes are partitioned into independently addressable bricks. The initial recommended interior shape is:

    64 × 64 × 32 voxels

Alternative shapes require benchmark evidence.

Each brick contains:

- Interior scalar voxels.
- One-voxel halo when trilinear interpolation requires it.
- Validity information.
- Scalar minimum and maximum.
- Valid voxel count.
- Occupancy or histogram mask.
- LOD and brick coordinates.
- Quantization scale and offset.
- Checksum and compression metadata.

## Virtual address

A brick address is identified by:

    renderProductId
    variableId
    validTime
    lod
    brickX
    brickY
    brickZ
    representationVersion

## Page table

The page table maps virtual brick coordinates to physical GPU cache slots.

Each entry includes:

- Resident flag.
- Physical slot coordinates.
- Resident LOD.
- Generation number.
- Validity or occupancy reference.
- Optional parent fallback reference.

A page-table entry becomes resident only after upload completion.

## GPU atlas

The atlas shall:

- Use fixed or bounded capacity.
- Avoid filtering across unrelated slots.
- Include halo handling.
- Support deterministic slot eviction.
- Expose memory use.
- Be recreated safely after device or context loss.

## Stale-data protection

Every request and upload carries a generation ID. Results from obsolete dataset, variable, time, backend, or manifest generations shall be discarded.

## Eviction

Weighted LRU considers:

- Current visibility.
- Projected size.
- Current time.
- Coarse fallback importance.
- Recent use.
- Reload cost.

Visible coarse bricks should remain pinned while finer bricks refine.

## Missing entries

A missing page-table entry means unavailable residency, not scalar zero. The renderer shall use a parent LOD, skip the segment, or display an incomplete-data state.

## Validation

Verify page-table addressing, atlas boundaries, halos, generation changes, eviction, parent fallback, time switching, and context recovery.
