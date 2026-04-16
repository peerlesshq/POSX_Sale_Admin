/**
 * System health check status.
 *
 * Source of truth: 03_database_schema_spec.md §14.3
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const HealthStatus = {
  Ok: 'ok',
  Warn: 'warn',
  Error: 'error',
} as const;

export type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

export const HEALTH_STATUS_VALUES = [
  HealthStatus.Ok,
  HealthStatus.Warn,
  HealthStatus.Error,
] as const satisfies ReadonlyArray<HealthStatus>;

export const isHealthStatus = createEnumGuard(HEALTH_STATUS_VALUES);
