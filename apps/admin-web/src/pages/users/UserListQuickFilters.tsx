/**
 * UserListQuickFilters — segmented quick-view switcher for the list.
 *
 * Sits between the KPI strip and the filter bar. Clicking a segment
 * pre-filters the list without touching the persistent
 * `GlobalFilters` state — segment is a separate concept.
 */
import { Segmented } from 'antd';
import type { FC } from 'react';

import { useT } from '../../lib/i18n';
import type { UserSegment } from '../../services/user/userListAnalytics';

interface UserListQuickFiltersProps {
  readonly value: UserSegment;
  readonly onChange: (next: UserSegment) => void;
  readonly counts?: Partial<Record<UserSegment, number>>;
}

const SEGMENTS: readonly UserSegment[] = [
  'all',
  'active',
  'high_value',
  'restricted',
  'has_team',
  'new',
  'rewarded',
];

export const UserListQuickFilters: FC<UserListQuickFiltersProps> = ({
  value,
  onChange,
  counts,
}) => {
  const t = useT();

  const options = SEGMENTS.map((seg) => ({
    value: seg,
    label: (
      <span className="up-seg__item">
        <span>{t(`users.segment.${seg}`)}</span>
        {counts && counts[seg] !== undefined && (
          <span className="up-seg__count">{counts[seg]}</span>
        )}
      </span>
    ),
  }));

  return (
    <div className="up-segments">
      <Segmented
        className="up-segments__seg"
        value={value}
        onChange={(v) => onChange(v as UserSegment)}
        options={options}
      />
    </div>
  );
};
