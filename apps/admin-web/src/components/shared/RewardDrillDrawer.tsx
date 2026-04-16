/**
 * RewardDrillDrawer — drill-down detail panel for a reward row.
 *
 * Used by every Rewards sub-page. Opens a right-side Drawer with:
 *
 *   - Header: wallet + reward type + risk chip
 *   - KPI strip: raw / burned / actual / rate
 *   - Source breakdown: contribution chain (for team / equal-level)
 *   - Settlement metadata: date / scope / settlement_job id / rule
 *   - Raw JSON (read-only fallback)
 *
 * The drawer does not fetch anything — all data comes through props.
 * The page owning the drawer feeds it the selected row plus a lookup
 * helper for resolving the referrer chain.
 */
import { Drawer } from 'antd';
import {
  BadgeDollarSign,
  Flame,
  GitBranch,
  Info,
  ListChecks,
  ScrollText,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { formatCompactUsdt, formatUsdt, toNumber, truncateHash } from '../../lib/format';
import { useT } from '../../lib/i18n';

import { JsonViewer } from './JsonViewer';
import { KeyValuePanel, type KvItem } from './KeyValuePanel';
import { SectionCard } from './SectionCard';
import { StatusBadge } from './badges';
import { TimeCell, WalletCell } from './cells';

import './RewardDrillDrawer.css';

export type DrillKind = 'direct' | 'team' | 'equal_level' | 'burn';

export interface DrillRow {
  readonly kind: DrillKind;
  readonly id: string;
  readonly wallet: string;
  readonly counterpartyWallet?: string | null;
  readonly settleDate?: string | null;
  readonly rawAmount?: number | string;
  readonly burnedAmount?: number | string;
  readonly actualAmount?: number | string;
  readonly rate?: number | string | null;
  readonly status?: string | null;
  readonly reason?: string | null;
  readonly rewardType?: string | null;
  /**
   * Contribution chain: an ordered list of (wallet, amount) pairs that
   * made up this reward row. For direct rewards it's a single item
   * (the downline). For team rewards it's the L2..L7 descendants that
   * summed into the daily team total.
   */
  readonly contributions?: readonly DrillContribution[];
  /** Full original API row for the raw tab. */
  readonly raw: Record<string, unknown>;
}

export interface DrillContribution {
  readonly wallet: string;
  readonly amount: number;
  readonly depth?: number;
  readonly tier?: string | null;
}

interface RewardDrillDrawerProps {
  readonly open: boolean;
  readonly row: DrillRow | null;
  readonly onClose: () => void;
}

export const RewardDrillDrawer: FC<RewardDrillDrawerProps> = ({ open, row, onClose }) => {
  const t = useT();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      title={null}
      className="px-drill-drawer"
      destroyOnHidden
    >
      {row && <DrillContent row={row} />}
      {!row && (
        <div className="px-drill__empty">
          <Info size={18} />
          <span>{t('drill.empty')}</span>
        </div>
      )}
    </Drawer>
  );
};

const DrillContent: FC<{ row: DrillRow }> = ({ row }) => {
  const t = useT();

  const raw = toNumber(row.rawAmount);
  const burn = toNumber(row.burnedAmount);
  const actual = toNumber(row.actualAmount ?? raw - burn);
  const burnPct = raw > 0 ? (burn / raw) * 100 : 0;

  const metaItems: KvItem[] = [
    {
      label: t('drill.field.id'),
      value: <code className="px-drill__code">{row.id}</code>,
    },
    {
      label: t('drill.field.kind'),
      value: <KindTag kind={row.kind} />,
    },
    {
      label: t('drill.field.settle_date'),
      value: row.settleDate ? <TimeCell value={row.settleDate} /> : '—',
    },
    {
      label: t('drill.field.status'),
      value: row.status ? <StatusBadge value={row.status} /> : '—',
    },
    {
      label: t('drill.field.reward_type'),
      value: row.rewardType ?? '—',
    },
    {
      label: t('drill.field.rate'),
      value:
        row.rate === null || row.rate === undefined
          ? '—'
          : `${(toNumber(row.rate) * 100).toFixed(2)}%`,
    },
  ];

  if (row.reason) {
    metaItems.push({
      label: t('drill.field.reason'),
      value: <span className="px-drill__reason">{row.reason}</span>,
    });
  }

  return (
    <div className="px-drill">
      <header className="px-drill__header">
        <div className="px-drill__eyebrow">
          <KindTag kind={row.kind} />
        </div>
        <div className="px-drill__title">
          <WalletCell value={row.wallet} />
        </div>
        {row.counterpartyWallet && (
          <div className="px-drill__sub">
            <span className="px-drill__sub-label">
              {row.kind === 'direct' ? t('drill.from') : t('drill.related')}
            </span>
            <span className="px-drill__sub-value">
              {truncateHash(row.counterpartyWallet, 8, 6)}
            </span>
          </div>
        )}
      </header>

      <div className="px-drill__kpis">
        <DrillKpi
          icon={<BadgeDollarSign size={13} />}
          label={t('drill.kpi.raw')}
          value={formatUsdt(raw)}
          tone="neutral"
        />
        <DrillKpi
          icon={<Flame size={13} />}
          label={t('drill.kpi.burned')}
          value={formatUsdt(burn)}
          tone="danger"
          sub={`${burnPct.toFixed(1)}%`}
        />
        <DrillKpi
          icon={<BadgeDollarSign size={13} />}
          label={t('drill.kpi.actual')}
          value={formatUsdt(actual)}
          tone="success"
        />
      </div>

      <SectionCard
        title={
          <span className="px-drill__section-title">
            <ListChecks size={13} />
            {t('drill.metadata')}
          </span>
        }
      >
        <KeyValuePanel items={metaItems} columns={2} compact />
      </SectionCard>

      {row.contributions && row.contributions.length > 0 && (
        <SectionCard
          title={
            <span className="px-drill__section-title">
              <GitBranch size={13} />
              {t('drill.contributions')}
            </span>
          }
          hint={t('drill.contributions_hint')}
        >
          <div className="px-drill__contribs">
            <div className="px-drill__contrib-head">
              <span>{t('drill.contrib.wallet')}</span>
              <span>{t('drill.contrib.depth')}</span>
              <span>{t('drill.contrib.amount')}</span>
            </div>
            {row.contributions.map((c) => (
              <div key={c.wallet} className="px-drill__contrib-row">
                <span className="px-drill__contrib-wallet">
                  {truncateHash(c.wallet, 6, 4)}
                </span>
                <span className="px-drill__contrib-depth">
                  {c.depth !== undefined ? `L${c.depth}` : '—'}
                </span>
                <span className="px-drill__contrib-amount px-tabular">
                  {formatCompactUsdt(c.amount)}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title={
          <span className="px-drill__section-title">
            <ScrollText size={13} />
            {t('drill.raw')}
          </span>
        }
      >
        <JsonViewer value={row.raw} maxHeight={220} />
      </SectionCard>
    </div>
  );
};

/* --------------------------------------------------------------------- */
/*  Inline helpers                                                       */
/* --------------------------------------------------------------------- */

const DrillKpi: FC<{
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: 'neutral' | 'danger' | 'success';
}> = ({ icon, label, value, sub, tone }) => (
  <div className={`px-drill-kpi px-drill-kpi--${tone}`}>
    <div className="px-drill-kpi__head">
      {icon}
      <span>{label}</span>
    </div>
    <div className="px-drill-kpi__value px-tabular">{value}</div>
    {sub && <div className="px-drill-kpi__sub px-tabular">{sub}</div>}
  </div>
);

const KindTag: FC<{ kind: DrillKind }> = ({ kind }) => {
  const t = useT();
  return <span className={`px-drill-kind px-drill-kind--${kind}`}>{t(`drill.kind.${kind}`)}</span>;
};
