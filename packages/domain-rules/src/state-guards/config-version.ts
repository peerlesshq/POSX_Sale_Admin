/**
 * Config version lifecycle guard.
 *
 * Source of truth: 07_state_machines_and_exception_flows.md §22 and
 * 09_config_center_spec.md §11.
 */
import {
  ConfigVersionStatus,
  type ConfigVersionStatus as Status,
} from '@posx/shared-types';

const ALLOWED: Readonly<Record<Status, ReadonlyArray<Status>>> = {
  [ConfigVersionStatus.Draft]: [
    ConfigVersionStatus.Active,
    ConfigVersionStatus.Disabled,
  ],
  [ConfigVersionStatus.Active]: [
    ConfigVersionStatus.Superseded,
    // 09 §11.4 notes that disabling an Active version is rare and
    // must be audited. The guard still allows it.
    ConfigVersionStatus.Disabled,
  ],
  [ConfigVersionStatus.Superseded]: [
    ConfigVersionStatus.Disabled,
  ],
  [ConfigVersionStatus.Disabled]: [],
};

export function canTransitionConfigVersion(from: Status, to: Status): boolean {
  return ALLOWED[from].includes(to);
}

export function assertConfigVersionTransition(from: Status, to: Status): void {
  if (!canTransitionConfigVersion(from, to)) {
    throw new Error(`Forbidden config_version transition: ${from} -> ${to}`);
  }
}
