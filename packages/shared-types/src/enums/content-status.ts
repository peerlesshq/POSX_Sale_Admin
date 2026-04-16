/**
 * Dynamic content entry status.
 *
 * Source of truth: 03_database_schema_spec.md §12.3
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ContentStatus = {
  Draft: 'draft',
  Active: 'active',
  Disabled: 'disabled',
} as const;

export type ContentStatus = (typeof ContentStatus)[keyof typeof ContentStatus];

export const CONTENT_STATUS_VALUES = [
  ContentStatus.Draft,
  ContentStatus.Active,
  ContentStatus.Disabled,
] as const satisfies ReadonlyArray<ContentStatus>;

export const isContentStatus = createEnumGuard(CONTENT_STATUS_VALUES);
