/**
 * Config version lifecycle status.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §12.1
 *   - 07_state_machines_and_exception_flows.md §22
 *   - 09_config_center_spec.md §11
 *
 * Resolution rule (09 §7.1, §11.2–11.4):
 *   - `active` and `superseded` are both eligible for historical
 *     resolution — the resolver picks the most recent applicable version
 *     by effective_from.
 *   - `draft` and `disabled` are NOT resolved for new evaluations.
 *   - Disabling does not retroactively break historical lookups, because
 *     prior effective versions remain stored.
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ConfigVersionStatus = {
  Draft: 'draft',
  Active: 'active',
  Superseded: 'superseded',
  Disabled: 'disabled',
} as const;

export type ConfigVersionStatus =
  (typeof ConfigVersionStatus)[keyof typeof ConfigVersionStatus];

export const CONFIG_VERSION_STATUS_VALUES = [
  ConfigVersionStatus.Draft,
  ConfigVersionStatus.Active,
  ConfigVersionStatus.Superseded,
  ConfigVersionStatus.Disabled,
] as const satisfies ReadonlyArray<ConfigVersionStatus>;

export const isConfigVersionStatus = createEnumGuard(
  CONFIG_VERSION_STATUS_VALUES,
);

/**
 * Config statuses that are eligible to be returned by the config
 * resolver. See `@posx/config` ConfigResolver implementation.
 */
export const CONFIG_VERSION_RESOLVABLE_STATUSES = [
  ConfigVersionStatus.Active,
  ConfigVersionStatus.Superseded,
] as const satisfies ReadonlyArray<ConfigVersionStatus>;
