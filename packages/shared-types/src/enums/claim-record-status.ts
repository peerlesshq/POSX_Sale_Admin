/**
 * Claim record status.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §10.9
 *   - 07_state_machines_and_exception_flows.md §18
 *
 * Claim records are immutable. No transitions occur after creation.
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ClaimRecordStatus = {
  Confirmed: 'confirmed',
  Failed: 'failed',
} as const;

export type ClaimRecordStatus =
  (typeof ClaimRecordStatus)[keyof typeof ClaimRecordStatus];

export const CLAIM_RECORD_STATUS_VALUES = [
  ClaimRecordStatus.Confirmed,
  ClaimRecordStatus.Failed,
] as const satisfies ReadonlyArray<ClaimRecordStatus>;

export const isClaimRecordStatus = createEnumGuard(CLAIM_RECORD_STATUS_VALUES);
