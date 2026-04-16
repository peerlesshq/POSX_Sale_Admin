/**
 * Error event severity.
 *
 * Source of truth: 03_database_schema_spec.md §14.4
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ErrorSeverity = {
  Info: 'info',
  Warn: 'warn',
  Error: 'error',
  Critical: 'critical',
} as const;

export type ErrorSeverity = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

export const ERROR_SEVERITY_VALUES = [
  ErrorSeverity.Info,
  ErrorSeverity.Warn,
  ErrorSeverity.Error,
  ErrorSeverity.Critical,
] as const satisfies ReadonlyArray<ErrorSeverity>;

export const isErrorSeverity = createEnumGuard(ERROR_SEVERITY_VALUES);
