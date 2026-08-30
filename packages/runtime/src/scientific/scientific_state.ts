/**
 * @quasar/runtime Scientific State
 *
 * Preserves canonical variable identity, units, processing classification,
 * valid observed ranges, and authoritative exact query delegation hooks.
 *
 * Governed by AGENTS.md:
 * - Scientific correctness is more important than visual novelty.
 * - Units must never be silently changed.
 * - Missing values must never be interpreted as physical zero.
 * - Displayed color / half-float sample is NOT an authoritative scientific value.
 */

import { CoordinateBoundsError } from '../errors.ts';
import type { ScientificVariableMetadata } from '../types.ts';
import type {
  QuasarQueryClient,
  ExactValueQueryRequest,
  ExactValueQueryResponse,
  ReconcilePickRequest,
  ProvisionalRenderPickResponse,
} from '../../../client/src/index.ts';

export class ScientificState {
  private readonly _metadata: ScientificVariableMetadata;
  private readonly _queryClient?: QuasarQueryClient;

  constructor(metadata: ScientificVariableMetadata, queryClient?: QuasarQueryClient) {
    if (metadata.maxValue <= metadata.minValue) {
      throw new CoordinateBoundsError('scalar_bounds', [metadata.minValue, metadata.maxValue], [metadata.minValue, Infinity], 'Invalid scientific scalar domain: max must exceed min.');
    }
    this._metadata = { ...metadata };
    this._queryClient = queryClient;
  }

  get variableId(): string {
    return this._metadata.variableId;
  }

  get canonicalUnits(): string {
    return this._metadata.canonicalUnits;
  }

  get cfStandardName(): string | undefined {
    return this._metadata.cfStandardName;
  }

  get minValue(): number {
    return this._metadata.minValue;
  }

  get maxValue(): number {
    return this._metadata.maxValue;
  }

  get classification(): string {
    return this._metadata.classification;
  }

  get isEligibleForExactQuery(): boolean {
    return this._metadata.isEligibleForExactQuery;
  }

  get metadata(): ScientificVariableMetadata {
    return { ...this._metadata };
  }

  /**
   * Validate if a physical value is within known domain range.
   */
  isInDomain(value: number): boolean {
    return !Number.isNaN(value) && value >= this._metadata.minValue && value <= this._metadata.maxValue;
  }

  /**
   * Authoritative exact point query delegation hook.
   * Dispatches to TASK-05 backend service (POST /api/v1/queries/value).
   */
  async queryExactValue(
    request: Omit<ExactValueQueryRequest, 'variable_id'>,
    options?: { signal?: AbortSignal }
  ): Promise<ExactValueQueryResponse> {
    if (!this._queryClient) {
      throw new Error('Exact query delegation requires an initialized QuasarQueryClient instance.');
    }

    const fullRequest: ExactValueQueryRequest = {
      ...request,
      variable_id: this._metadata.variableId,
    };

    const resp = await this._queryClient.queryExactValue(fullRequest, options);
    return resp.data;
  }

  /**
   * Authoritative pick reconciliation hook.
   * Dispatches to TASK-05 backend service (POST /api/v1/queries/reconcile-pick).
   */
  async reconcileProvisionalPick(
    request: ReconcilePickRequest,
    options?: { signal?: AbortSignal }
  ): Promise<ReconcilePickResponse> {
    if (!this._queryClient) {
      throw new Error('Pick reconciliation requires an initialized QuasarQueryClient instance.');
    }

    const resp = await this._queryClient.reconcileProvisionalPick(request, options);
    return resp.data;
  }
}
