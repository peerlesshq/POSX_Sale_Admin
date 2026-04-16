/**
 * ConfigValueRenderer — dispatch entry for structured config values.
 *
 * Looks up the (group, key) taxonomy metadata to decide which
 * renderer to use. If no dedicated renderer exists, falls back to
 * the `GenericKeyValueView`, which is still meaningfully better than
 * a raw JSON dump.
 *
 * Raw JSON is ONLY available in the Raw tab of the detail panel —
 * never on the primary detail view.
 */
import type { FC } from 'react';

import { getKeyMeta, type ConfigRendererKind } from './configTaxonomy';
import { BurnPolicyView } from './renderers/BurnPolicyView';
import { ClaimPolicyView } from './renderers/ClaimPolicyView';
import { GenericKeyValueView } from './renderers/GenericKeyValueView';
import { PricingView } from './renderers/PricingView';
import { TeamLaddersView } from './renderers/TeamLaddersView';
import { TierDefinitionsView } from './renderers/TierDefinitionsView';
import { VestingPolicyView } from './renderers/VestingPolicyView';

interface ConfigValueRendererProps {
  readonly group: string;
  readonly configKey: string;
  readonly value: Record<string, unknown>;
}

export const ConfigValueRenderer: FC<ConfigValueRendererProps> = ({
  group,
  configKey,
  value,
}) => {
  const meta = getKeyMeta(group, configKey);
  const kind: ConfigRendererKind = meta?.renderer ?? 'generic';

  switch (kind) {
    case 'pricing':
      return <PricingView value={value} />;
    case 'tier_definitions':
      return <TierDefinitionsView value={value} />;
    case 'team_ladders':
      return <TeamLaddersView value={value} />;
    case 'burn_policy':
      return <BurnPolicyView value={value} />;
    case 'vesting_policy':
      return <VestingPolicyView value={value} />;
    case 'claim_policy':
      return <ClaimPolicyView value={value} />;
    case 'generic':
    default:
      return <GenericKeyValueView value={value} group={group} configKey={configKey} />;
  }
};
