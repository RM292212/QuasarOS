/**
 * @quasar/runtime Domain Error Types
 *
 * Conforms strictly to docs/02-architecture/ErrorModel.md.
 */

export class QuasarRuntimeError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(message: string, code = 'RUNTIME_ERROR', details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'QuasarRuntimeError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidStateTransitionError extends QuasarRuntimeError {
  readonly fromState: string;
  readonly toState: string;
  readonly event: string;

  constructor(fromState: string, toState: string, event: string) {
    super(
      `Invalid FSM transition from state '${fromState}' to '${toState}' via event '${event}'.`,
      'INVALID_STATE_TRANSITION',
      { fromState, toState, event }
    );
    this.name = 'InvalidStateTransitionError';
    this.fromState = fromState;
    this.toState = toState;
    this.event = event;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CoordinateBoundsError extends QuasarRuntimeError {
  readonly coordinateType: string;
  readonly value: number | number[];
  readonly validRange: [number, number];

  constructor(coordinateType: string, value: number | number[], validRange: [number, number], message?: string) {
    super(
      message || `Coordinate '${coordinateType}' value ${JSON.stringify(value)} out of valid bounds [${validRange[0]}, ${validRange[1]}].`,
      'COORDINATE_BOUNDS_ERROR',
      { coordinateType, value, validRange }
    );
    this.name = 'CoordinateBoundsError';
    this.coordinateType = coordinateType;
    this.value = value;
    this.validRange = validRange;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SessionIntegrityError extends QuasarRuntimeError {
  readonly pinnedSnapshotId: string;
  readonly incomingSnapshotId: string;

  constructor(pinnedSnapshotId: string, incomingSnapshotId: string) {
    super(
      `Session integrity violation: Attempted mutation from pinned snapshot '${pinnedSnapshotId}' to '${incomingSnapshotId}'.`,
      'SESSION_INTEGRITY_VIOLATION',
      { pinnedSnapshotId, incomingSnapshotId }
    );
    this.name = 'SessionIntegrityError';
    this.pinnedSnapshotId = pinnedSnapshotId;
    this.incomingSnapshotId = incomingSnapshotId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class StaleTemporalRequestError extends QuasarRuntimeError {
  readonly requestGeneration: number;
  readonly activeGeneration: number;

  constructor(requestGeneration: number, activeGeneration: number) {
    super(
      `Stale temporal request discarded: Request generation ${requestGeneration} does not match active generation ${activeGeneration}.`,
      'STALE_TEMPORAL_REQUEST',
      { requestGeneration, activeGeneration }
    );
    this.name = 'StaleTemporalRequestError';
    this.requestGeneration = requestGeneration;
    this.activeGeneration = activeGeneration;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ClippingRangeError extends QuasarRuntimeError {
  readonly axis: string;
  readonly min: number;
  readonly max: number;

  constructor(axis: string, min: number, max: number, reason: string) {
    super(
      `Invalid clipping range on axis '${axis}' [${min}, ${max}]: ${reason}`,
      'INVALID_CLIPPING_RANGE',
      { axis, min, max, reason }
    );
    this.name = 'ClippingRangeError';
    this.axis = axis;
    this.min = min;
    this.max = max;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
