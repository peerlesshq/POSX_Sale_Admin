/**
 * Settlement + Recompute — Phase 7 rewrite.
 *
 * Both pages are high-risk. They now use RiskActionModal to wrap their
 * confirmation flow, and use DataTable + StatusBadge for the job list.
 * Recompute has a dedicated diff viewer (JsonViewer) below the form.
 */
import { useQuery } from '@tanstack/react-query';
import { Button, DatePicker, Form, Input, Select, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { Play as PlayIcon, Plus as PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { api } from '../api/endpoints';
import {
  CountCell,
  DataTable,
  EmptyHint,
  InlineError,
  JsonViewer,
  PageHeader,
  RiskActionModal,
  SectionCard,
  StatusBadge,
  TimeCell,
} from '../components/shared';
import { toNumber } from '../lib/format';
import { useT } from '../lib/i18n';
import { useAdminRole } from '../lib/use-admin-role';

type Row = Record<string, unknown>;

/* ==================================================================
 * Settlement Jobs
 * ================================================================== */

export function SettlementJobsPage() {
  const t = useT();
  const { canMutate } = useAdminRole();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, isError, error: err, refetch } = useQuery<Row>({
    queryKey: ['admin', 'settlement-jobs', page, pageSize],
    queryFn: () => api.listSettlementJobs({ page, page_size: pageSize }),
    staleTime: 15_000,
  });

  const items = (data?.['items'] as Row[]) ?? [];
  const total = toNumber((data?.['pagination'] as Row)?.['total']);

  const handleTriggerConfirm = async (reason: string) => {
    try {
      const v = await form.validateFields();
      // settlement_date is a Dayjs via AntD DatePicker; serialise to ISO
      // YYYY-MM-DD for the API. The old free-text <Input> silently
      // accepted typos like "2026-13-32"; DatePicker + formatting
      // eliminates that whole class of bug.
      const dateStr: string =
        v.settlement_date && typeof (v.settlement_date as Dayjs).format === 'function'
          ? (v.settlement_date as Dayjs).format('YYYY-MM-DD')
          : String(v.settlement_date ?? '');
      await api.triggerSettlement({
        settlement_date: dateStr,
        mode: v.mode,
        reason: reason || v.reason,
      });
      void message.success(t('settlement.jobs.triggered'));
      setOpen(false);
      form.resetFields();
      void refetch();
    } catch (err) {
      void message.error(err instanceof Error ? err.message : t('common.failed'));
    }
  };

  return (
    <div>
      <PageHeader
        title={t('settlement.jobs.title')}
        subtitle={t('settlement.jobs.subtitle')}
        actions={
          canMutate && (
          <Button type="primary" icon={<PlusIcon size={14} />} onClick={() => setOpen(true)}>
            {t('settlement.jobs.trigger')}
          </Button>
          )
        }
      />

      <SectionCard padded={false}>
        {isError ? (
          <InlineError
            title={t('common.error')}
            description={err instanceof Error ? err.message : undefined}
            onRetry={() => void refetch()}
            retryLabel={t('common.retry')}
            compact
          />
        ) : (
        <DataTable<Row>
          rowKey={(r) => String(r['settlement_job_id'] ?? Math.random())}
          dataSource={items}
          loading={isLoading}
          locale={{ emptyText: <EmptyHint title={t('common.empty')} description={t('common.empty_hint')} /> }}
          columns={[
            { title: t('settlement.jobs.col.date'), dataIndex: 'settlement_date' },
            { title: t('settlement.jobs.col.type'), dataIndex: 'job_type' },
            { title: t('settlement.jobs.col.mode'), dataIndex: 'mode' },
            {
              title: t('settlement.jobs.col.status'),
              dataIndex: 'status',
              render: (v: string) => <StatusBadge value={v} />,
            },
            {
              title: t('settlement.jobs.col.processed'),
              dataIndex: 'processed_user_count',
              align: 'right',
              render: (v: unknown) => <CountCell value={v} />,
            },
            {
              title: t('settlement.jobs.col.snapshots'),
              dataIndex: 'created_snapshot_count',
              align: 'right',
              render: (v: unknown) => <CountCell value={v} />,
            },
            {
              title: t('settlement.jobs.col.errors'),
              dataIndex: 'error_count',
              align: 'right',
              render: (v: unknown) => (
                <span
                  className="px-tabular"
                  style={{ color: toNumber(v) > 0 ? 'var(--px-status-err)' : 'var(--px-text-primary)' }}
                >
                  {String(v ?? 0)}
                </span>
              ),
            },
            {
              title: t('settlement.jobs.col.started'),
              dataIndex: 'started_at',
              render: (v: unknown) => <TimeCell value={v} mode="relative" />,
            },
          ]}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
        )}
      </SectionCard>

      <RiskActionModal
        open={open}
        severity="high"
        title={t('settlement.jobs.modal_title')}
        description={t('settlement.jobs.subtitle')}
        consequences={[t('risk.irreversible')]}
        onCancel={() => {
          setOpen(false);
          form.resetFields();
        }}
        onConfirm={handleTriggerConfirm}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="settlement_date"
            label={t('settlement.jobs.date')}
            rules={[{ required: true }]}
            initialValue={dayjs().startOf('day').subtract(1, 'day')}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(d) => !!d && d.isAfter(dayjs().endOf('day'))}
              format="YYYY-MM-DD"
              allowClear={false}
            />
          </Form.Item>
          <Form.Item name="mode" label={t('settlement.jobs.mode')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'official', label: t('settlement.jobs.mode.official') },
                { value: 'backfill', label: t('settlement.jobs.mode.backfill') },
              ]}
            />
          </Form.Item>
        </Form>
      </RiskActionModal>
    </div>
  );
}

/* ==================================================================
 * Recompute
 * ================================================================== */

export function RecomputePage() {
  const t = useT();
  const { canMutate } = useAdminRole();
  const [form] = Form.useForm();
  const [previewResult, setPreviewResult] = useState<Record<string, unknown> | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const serializeForm = (v: Record<string, unknown>): Record<string, unknown> => {
    const date = v['settlement_date'];
    const dateStr: string =
      date && typeof (date as Dayjs).format === 'function'
        ? (date as Dayjs).format('YYYY-MM-DD')
        : String(date ?? '');
    return { ...v, settlement_date: dateStr };
  };

  const runPreview = async () => {
    try {
      const v = await form.validateFields();
      setLoading(true);
      const res = await api.recomputePreview(serializeForm(v) as { settlement_date: string; reason: string });
      setPreviewResult(res);
      void message.success(t('recompute.preview_complete'));
    } catch (err) {
      void message.error(err instanceof Error ? err.message : t('common.failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyConfirm = async (reason: string) => {
    try {
      const v = await form.validateFields();
      await api.recomputeApply({ ...serializeForm(v), reason } as { settlement_date: string; reason: string });
      void message.success(t('recompute.applied'));
      setApplyOpen(false);
    } catch (err) {
      void message.error(err instanceof Error ? err.message : t('common.failed'));
    }
  };

  return (
    <div>
      <PageHeader title={t('recompute.title')} subtitle={t('recompute.subtitle')} />

      <SectionCard title={t('recompute.title')} hint={t('recompute.description')} padded>
        <Form form={form} layout="vertical" style={{ maxWidth: 520 }}>
          <Form.Item
            name="settlement_date"
            label={t('recompute.date')}
            rules={[{ required: true }]}
            initialValue={dayjs().startOf('day').subtract(1, 'day')}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(d) => !!d && d.isAfter(dayjs().endOf('day'))}
              format="YYYY-MM-DD"
              allowClear={false}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label={t('recompute.reason')}
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
        {canMutate && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button icon={<PlayIcon size={14} />} loading={loading} onClick={runPreview}>
            {t('recompute.run_preview')}
          </Button>
          <Button type="primary" danger onClick={() => setApplyOpen(true)}>
            {t('recompute.apply')}
          </Button>
        </div>
        )}
      </SectionCard>

      {previewResult && (
        <div style={{ marginTop: 16 }}>
          <SectionCard title={t('recompute.diff.title')} padded>
            <JsonViewer value={previewResult} />
          </SectionCard>
        </div>
      )}

      <RiskActionModal
        open={applyOpen}
        severity="critical"
        title={t('recompute.confirm.title')}
        description={t('recompute.confirm.body')}
        consequences={[t('risk.irreversible'), t('risk.operator_required')]}
        confirmPhrase="APPLY"
        onCancel={() => setApplyOpen(false)}
        onConfirm={handleApplyConfirm}
      />
    </div>
  );
}
