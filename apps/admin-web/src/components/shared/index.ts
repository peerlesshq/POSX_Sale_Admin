/**
 * Shared component barrel. Pages should import from this one place.
 *
 *   import { PageHeader, SectionCard, KpiStatCard } from '../components/shared';
 */
export { PageHeader } from './PageHeader';
export { PageShell } from './PageShell';
export { SectionCard } from './SectionCard';
export type { SectionStatus, SectionTone } from './SectionCard';
export { KpiStatCard } from './KpiStatCard';
export { KpiDeltaCard } from './KpiDeltaCard';
export { DataTable } from './DataTable';
export { FilterBar, FilterField } from './FilterBar';
export { TimeRangeFilter } from './TimeRangeFilter';
export { GlobalFilterBar, defaultFilters } from './GlobalFilterBar';
export type { GlobalFilters } from './GlobalFilterBar';
export {
  FilterFieldFrame,
  TimeRangeField,
  WalletField,
  TierField,
  StatusField,
  SelectField,
  AmountRangeField,
  TextField,
} from './filterFields';
export type { SelectOption } from './filterFields';
export { RiskActionModal } from './RiskActionModal';
export { JsonViewer } from './JsonViewer';
export { KeyValuePanel } from './KeyValuePanel';
export type { KvItem } from './KeyValuePanel';
export { Sparkline } from './Sparkline';
export { RewardDrillDrawer } from './RewardDrillDrawer';
export type { DrillRow, DrillContribution, DrillKind } from './RewardDrillDrawer';

export {
  StatusBadge,
  SeverityBadge,
  EnvironmentBadge,
  TierBadge,
  Badge,
} from './badges';

export {
  CopyableHashCell,
  WalletCell,
  AmountCell,
  CountCell,
  PercentCell,
  TimeCell,
  ErrorCell,
  ThresholdCell,
  RoleBadge,
} from './cells';

export { RowActionMenu } from './RowActionMenu';
export type { RowActionItem, RowActionEntry, RowActionDivider } from './RowActionMenu';

export { EmptyState, ErrorState, LoadingState, InlineError, EmptyHint, SkeletonGroup } from './states';
export { Skeleton } from '../ui/primitives';
