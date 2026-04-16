/**
 * TeamLaddersView — renderer for `team_reward_rules.team_ladders`.
 *
 * Renders one ladder table per qualifying tier, plus the max team
 * rate callout. Each row is a performance bracket with its reward
 * rate. Closed and open-ended brackets are both supported.
 */
import type { FC } from 'react';

import { formatCompactUsdt } from '../../../lib/format';
import { useT } from '../../../lib/i18n';

interface LadderEntry {
  performance_min: string;
  performance_max: string | null;
  team_rate: string;
}

interface TeamLaddersValue {
  readonly ladders?: Readonly<Record<string, readonly LadderEntry[]>>;
  readonly max_team_rate?: string;
}

export const TeamLaddersView: FC<{ value: Record<string, unknown> }> = ({ value }) => {
  const t = useT();
  const v = value as TeamLaddersValue;
  const ladders = v.ladders ?? {};
  const entries = Object.entries(ladders);
  const maxRate = v.max_team_rate;

  if (entries.length === 0) {
    return <div className="cfg-render-empty">{t('config.render.empty')}</div>;
  }

  return (
    <div className="cfg-render cfg-render--ladders">
      <div className="cfg-render__legend">
        <span>{t('config.render.ladders.legend')}</span>
        {maxRate && (
          <span className="cfg-render-ladders__cap">
            {t('config.render.ladders.max_rate')}: {formatRate(maxRate)}
          </span>
        )}
      </div>
      <div className="cfg-ladder-wrap">
        {entries.map(([tier, rows]) => (
          <div key={tier} className="cfg-ladder">
            <div className="cfg-ladder__title">
              <span className={`cfg-tier-dot cfg-tier-dot--${tier}`} />
              <span className="cfg-ladder__tier">{tier.toUpperCase()}</span>
              <span className="cfg-ladder__rows">
                {rows.length} {t('config.render.ladders.brackets')}
              </span>
            </div>
            <div className="cfg-ladder__table">
              <div className="cfg-ladder__head">
                <span>{t('config.render.ladders.col.bracket')}</span>
                <span>{t('config.render.ladders.col.rate')}</span>
              </div>
              {rows.map((row, idx) => (
                <div key={idx} className="cfg-ladder__row">
                  <span className="cfg-ladder__range px-tabular">
                    {formatCompactUsdt(row.performance_min)}
                    {' – '}
                    {row.performance_max ? formatCompactUsdt(row.performance_max) : '∞'}
                  </span>
                  <span className="cfg-ladder__rate px-tabular">
                    {formatRate(row.team_rate)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function formatRate(value: string | undefined): string {
  if (!value) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return `${(num * 100).toFixed(num < 0.1 ? 1 : 0)}%`;
}
