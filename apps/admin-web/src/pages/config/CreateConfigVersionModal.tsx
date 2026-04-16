/**
 * CreateConfigVersionModal — 3-step "create new config version" flow.
 *
 * Step 1  Pick group + key, see current version alongside
 * Step 2  Edit the value + effective_from + apply_scope + note
 * Step 3  Review diff, confirm risk, submit
 *
 * This is not a dressed-up AntD form — it is a real multi-step wizard
 * with a progress rail, per-step validation, side-by-side comparison
 * against the currently active version, and a final review screen
 * with field-level diff summary.
 */
import { DatePicker, Input, Modal, Select, Steps, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Send } from 'lucide-react';
import type { FC, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { JsonViewer, TimeCell } from '../../components/shared';
import { useT } from '../../lib/i18n';

import { ConfigValueRenderer } from './ConfigValueRenderer';
import {
  CONFIG_TAXONOMY,
  effectiveRisk,
  getGroupMeta,
  getKeyMeta,
} from './configTaxonomy';
import { RiskChip } from './ConfigGroupNav';
import { diffConfigValue, keepChanged, summarizeDiff } from './diff';
import type { ConfigVersionLike } from './derive';

interface CreateConfigVersionModalProps {
  readonly open: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (payload: CreatePayload) => Promise<void>;
  readonly currentVersionLookup: (
    group: string,
    key: string,
  ) => ConfigVersionLike | null;
  readonly prefillGroup?: string | null;
  readonly prefillKey?: string | null;
}

export interface CreatePayload {
  readonly config_group: string;
  readonly config_key: string;
  readonly config_value: Record<string, unknown>;
  readonly effective_from: string;
  readonly apply_scope: string;
  readonly description: string;
}

type Scope = 'all_users' | 'new_users_only' | 'new_orders_only' | 'next_settlement_day';

/* --------------------------------------------------------------------- */
/*  Component                                                            */
/* --------------------------------------------------------------------- */

export const CreateConfigVersionModal: FC<CreateConfigVersionModalProps> = ({
  open,
  onCancel,
  onSubmit,
  currentVersionLookup,
  prefillGroup = null,
  prefillKey = null,
}) => {
  const t = useT();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [group, setGroup] = useState<string | null>(prefillGroup);
  const [key, setKey] = useState<string | null>(prefillKey);

  const [valueJson, setValueJson] = useState('');
  const [valueParsed, setValueParsed] = useState<Record<string, unknown> | null>(null);
  const [valueError, setValueError] = useState<string | null>(null);

  const [effectiveFrom, setEffectiveFrom] = useState<Dayjs | null>(null);
  const [applyScope, setApplyScope] = useState<Scope>('next_settlement_day');
  const [description, setDescription] = useState('');

  // Reset everything when the modal opens fresh.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setGroup(prefillGroup);
    setKey(prefillKey);
    setValueJson('');
    setValueParsed(null);
    setValueError(null);
    setEffectiveFrom(dayjs().add(1, 'day').startOf('day'));
    setApplyScope('next_settlement_day');
    setDescription('');
  }, [open, prefillGroup, prefillKey]);

  // When a key is chosen, seed the editor with the current value as
  // a starting point so the operator has a diffable baseline.
  useEffect(() => {
    if (!group || !key) return;
    const keyMeta = getKeyMeta(group, key);
    if (keyMeta?.recommendedScope) {
      setApplyScope(keyMeta.recommendedScope);
    }
    const current = currentVersionLookup(group, key);
    if (current) {
      const seeded = JSON.stringify(current.config_value, null, 2);
      setValueJson(seeded);
      try {
        setValueParsed(JSON.parse(seeded));
        setValueError(null);
      } catch {
        setValueParsed(null);
      }
    } else {
      setValueJson('{}');
      setValueParsed({});
      setValueError(null);
    }
  }, [group, key, currentVersionLookup]);

  const groupMeta = group ? getGroupMeta(group) : undefined;
  const keyMeta = group && key ? getKeyMeta(group, key) : undefined;
  const current = group && key ? currentVersionLookup(group, key) : null;
  const risk = group ? effectiveRisk(group, key ?? undefined) : 'low';

  const canAdvanceStep0 = Boolean(group && key);
  const canAdvanceStep1 =
    Boolean(valueParsed) &&
    valueError === null &&
    Boolean(effectiveFrom) &&
    Boolean(applyScope);

  const diffEntries = useMemo(() => {
    if (!current || !valueParsed) return [];
    return keepChanged(diffConfigValue(current.config_value, valueParsed));
  }, [current, valueParsed]);

  const diffSummary = useMemo(() => summarizeDiff(diffEntries), [diffEntries]);

  const handleValueChange = (raw: string) => {
    setValueJson(raw);
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setValueError(t('config.create.err.must_be_object'));
        setValueParsed(null);
      } else {
        setValueParsed(parsed as Record<string, unknown>);
        setValueError(null);
      }
    } catch {
      setValueError(t('config.create.err.invalid_json'));
      setValueParsed(null);
    }
  };

  const handleNext = () => setStep((s) => Math.min(2, s + 1));
  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSubmit = async () => {
    if (!group || !key || !valueParsed || !effectiveFrom) return;
    setSubmitting(true);
    try {
      await onSubmit({
        config_group: group,
        config_key: key,
        config_value: valueParsed,
        effective_from: effectiveFrom.toISOString(),
        apply_scope: applyScope,
        description: description.trim(),
      });
      void message.success(t('config.create.submitted'));
    } catch (err) {
      void message.error(
        err instanceof Error ? err.message : t('common.failed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* --------------------------------------------------------------- */
  /*  Footer buttons                                                 */
  /* --------------------------------------------------------------- */

  const footer: ReactNode = (
    <div className="cfg-create__footer">
      <button
        type="button"
        className="ant-btn"
        onClick={onCancel}
        disabled={submitting}
      >
        {t('common.cancel')}
      </button>
      <div className="cfg-create__footer-spacer" />
      {step > 0 && (
        <button
          type="button"
          className="ant-btn"
          onClick={handleBack}
          disabled={submitting}
        >
          <ArrowLeft size={14} />
          {t('config.create.back')}
        </button>
      )}
      {step < 2 && (
        <button
          type="button"
          className="ant-btn ant-btn-primary"
          onClick={handleNext}
          disabled={step === 0 ? !canAdvanceStep0 : !canAdvanceStep1}
        >
          {t('config.create.next')}
          <ArrowRight size={14} />
        </button>
      )}
      {step === 2 && (
        <button
          type="button"
          className={`ant-btn ant-btn-primary ${risk === 'high' ? 'ant-btn-dangerous' : ''}`.trim()}
          onClick={handleSubmit}
          disabled={submitting || !diffSummary.hasChanges}
        >
          <Send size={14} />
          {t('config.create.submit')}
        </button>
      )}
    </div>
  );

  /* --------------------------------------------------------------- */
  /*  Render                                                         */
  /* --------------------------------------------------------------- */

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={null}
      footer={footer}
      width={880}
      className="cfg-create-modal"
      maskClosable={!submitting}
      centered
    >
      <div className="cfg-create">
        <header className="cfg-create__header">
          <div>
            <div className="cfg-create__title">{t('config.create.title')}</div>
            <div className="cfg-create__subtitle">
              {t('config.create.subtitle')}
            </div>
          </div>
          {group && <RiskChip level={risk} size="md" />}
        </header>

        <Steps
          current={step}
          size="small"
          className="cfg-create__steps"
          items={[
            { title: t('config.create.step1') },
            { title: t('config.create.step2') },
            { title: t('config.create.step3') },
          ]}
        />

        {risk === 'high' && step === 2 && (
          <div className="cfg-create__risk-banner">
            <AlertTriangle size={16} />
            <div>
              <div className="cfg-create__risk-title">
                {t('config.create.risk_title')}
              </div>
              <div className="cfg-create__risk-body">
                {t('config.create.risk_body')}
              </div>
            </div>
          </div>
        )}

        {step === 0 && (
          <Step0Select
            group={group}
            setGroup={(g) => {
              setGroup(g);
              setKey(null);
            }}
            keyName={key}
            setKey={setKey}
            current={current}
          />
        )}
        {step === 1 && group && key && (
          <Step1Edit
            group={group}
            keyName={key}
            valueJson={valueJson}
            onValueChange={handleValueChange}
            valueError={valueError}
            valueParsed={valueParsed}
            effectiveFrom={effectiveFrom}
            setEffectiveFrom={setEffectiveFrom}
            applyScope={applyScope}
            setApplyScope={setApplyScope}
            description={description}
            setDescription={setDescription}
            current={current}
          />
        )}
        {step === 2 && group && key && valueParsed && (
          <Step2Review
            group={group}
            keyName={key}
            valueParsed={valueParsed}
            effectiveFrom={effectiveFrom}
            applyScope={applyScope}
            description={description}
            current={current}
            diffSummary={diffSummary}
          />
        )}

        {!group && step === 0 && (
          <div className="cfg-create__hint">
            {t('config.create.hint_select_group')}
          </div>
        )}
        {groupMeta && !keyMeta && step === 0 && (
          <div className="cfg-create__hint">
            {t('config.create.hint_select_key')}
          </div>
        )}
      </div>
    </Modal>
  );
};

/* --------------------------------------------------------------------- */
/*  Step 0 — pick group + key                                            */
/* --------------------------------------------------------------------- */

const Step0Select: FC<{
  group: string | null;
  setGroup: (g: string) => void;
  keyName: string | null;
  setKey: (k: string) => void;
  current: ConfigVersionLike | null;
}> = ({ group, setGroup, keyName, setKey, current }) => {
  const t = useT();
  const groupMeta = group ? getGroupMeta(group) : undefined;

  return (
    <div className="cfg-create__grid">
      <div>
        <Field label={t('config.create.field.group')}>
          <Select<string>
            className="cfg-create__select"
            value={group ?? undefined}
            onChange={(g) => setGroup(g)}
            placeholder={t('config.create.placeholder.group')}
            options={CONFIG_TAXONOMY.map((m) => ({
              value: m.group,
              label: (
                <span className="cfg-create__opt">
                  <span>{m.labelZh}</span>
                  <code className="cfg-create__opt-code">{m.group}</code>
                </span>
              ),
            }))}
          />
        </Field>
        <Field label={t('config.create.field.key')}>
          <Select<string>
            className="cfg-create__select"
            value={keyName ?? undefined}
            onChange={(k) => setKey(k)}
            disabled={!groupMeta}
            placeholder={t('config.create.placeholder.key')}
            options={
              groupMeta?.keys.map((k) => ({
                value: k.key,
                label: (
                  <span className="cfg-create__opt">
                    <span>{k.labelZh}</span>
                    <code className="cfg-create__opt-code">{k.key}</code>
                  </span>
                ),
              })) ?? []
            }
          />
        </Field>
      </div>
      <div className="cfg-create__side">
        <div className="cfg-create__side-title">
          {t('config.create.current_baseline')}
        </div>
        {current ? (
          <div className="cfg-create__side-card">
            <div className="cfg-create__side-meta">
              <span>v{current.version_no}</span>
              <span className="cfg-create__side-sep">·</span>
              <TimeCell value={current.effective_from} />
            </div>
            <JsonViewer value={current.config_value} maxHeight={220} />
          </div>
        ) : (
          <div className="cfg-create__side-empty">
            {t('config.create.no_baseline')}
          </div>
        )}
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------- */
/*  Step 1 — edit                                                        */
/* --------------------------------------------------------------------- */

const Step1Edit: FC<{
  group: string;
  keyName: string;
  valueJson: string;
  onValueChange: (v: string) => void;
  valueError: string | null;
  valueParsed: Record<string, unknown> | null;
  effectiveFrom: Dayjs | null;
  setEffectiveFrom: (v: Dayjs | null) => void;
  applyScope: Scope;
  setApplyScope: (v: Scope) => void;
  description: string;
  setDescription: (v: string) => void;
  current: ConfigVersionLike | null;
}> = ({
  group,
  keyName,
  valueJson,
  onValueChange,
  valueError,
  valueParsed,
  effectiveFrom,
  setEffectiveFrom,
  applyScope,
  setApplyScope,
  description,
  setDescription,
  current,
}) => {
  const t = useT();

  return (
    <div className="cfg-create__grid">
      <div>
        <Field label={t('config.create.field.value')}>
          <Input.TextArea
            className="cfg-create__textarea"
            rows={12}
            value={valueJson}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder='{"token_price":"0.0750","currency":"USDT"}'
            spellCheck={false}
          />
          {valueError && (
            <div className="cfg-create__err">{valueError}</div>
          )}
        </Field>
        <div className="cfg-create__row">
          <Field label={t('config.create.field.effective_from')}>
            <DatePicker
              showTime
              value={effectiveFrom}
              onChange={(d) => setEffectiveFrom(d)}
              className="cfg-create__datepicker"
            />
          </Field>
          <Field label={t('config.create.field.apply_scope')}>
            <Select<Scope>
              className="cfg-create__select"
              value={applyScope}
              onChange={(v) => setApplyScope(v)}
              options={[
                { value: 'next_settlement_day', label: t('config.scope.next_settlement_day') },
                { value: 'all_users', label: t('config.scope.all_users') },
                { value: 'new_users_only', label: t('config.scope.new_users_only') },
                { value: 'new_orders_only', label: t('config.scope.new_orders_only') },
              ]}
            />
          </Field>
        </div>
        <Field label={t('config.create.field.description')}>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('config.create.placeholder.description')}
          />
        </Field>
      </div>
      <div className="cfg-create__side">
        <div className="cfg-create__side-title">
          {t('config.create.live_preview')}
        </div>
        {valueParsed ? (
          <div className="cfg-create__side-card">
            <ConfigValueRenderer
              group={group}
              configKey={keyName}
              value={valueParsed}
            />
          </div>
        ) : (
          <div className="cfg-create__side-empty">
            {t('config.create.invalid_preview')}
          </div>
        )}
        {current && (
          <div className="cfg-create__baseline-note">
            <span>{t('config.create.baseline_note')}:</span>{' '}
            <code>v{current.version_no}</code>
          </div>
        )}
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------- */
/*  Step 2 — review                                                      */
/* --------------------------------------------------------------------- */

const Step2Review: FC<{
  group: string;
  keyName: string;
  valueParsed: Record<string, unknown>;
  effectiveFrom: Dayjs | null;
  applyScope: Scope;
  description: string;
  current: ConfigVersionLike | null;
  diffSummary: { added: number; removed: number; changed: number; hasChanges: boolean };
}> = ({
  group,
  keyName,
  valueParsed,
  effectiveFrom,
  applyScope,
  description,
  current,
  diffSummary,
}) => {
  const t = useT();
  const groupMeta = getGroupMeta(group);
  const keyMeta = getKeyMeta(group, keyName);

  return (
    <div className="cfg-create__review">
      <div className="cfg-create__review-head">
        <CheckCircle2 size={16} />
        <span>{t('config.create.review_title')}</span>
      </div>

      <div className="cfg-create__review-grid">
        <ReviewField label={t('config.detail.field.group')}>
          {groupMeta?.labelZh ?? group} · <code>{group}</code>
        </ReviewField>
        <ReviewField label={t('config.detail.field.key')}>
          {keyMeta?.labelZh ?? keyName} · <code>{keyName}</code>
        </ReviewField>
        <ReviewField label={t('config.detail.field.effective_from')}>
          {effectiveFrom ? effectiveFrom.toISOString() : '—'}
        </ReviewField>
        <ReviewField label={t('config.detail.field.apply_scope')}>
          <span className={`cfg-scope-tag cfg-scope-tag--${applyScope}`}>
            {t(`config.scope.${applyScope}`, applyScope)}
          </span>
        </ReviewField>
        <ReviewField label={t('config.detail.field.description')} full>
          {description || <span className="cfg-create__muted">—</span>}
        </ReviewField>
      </div>

      <div className="cfg-create__review-diff">
        <div className="cfg-create__review-diff-title">
          {t('config.create.diff_summary')}
        </div>
        <div className="cfg-create__review-diff-chips">
          <span className="cfg-diff__chip cfg-diff__chip--changed">
            {t('config.diff.changed')} · {diffSummary.changed}
          </span>
          <span className="cfg-diff__chip cfg-diff__chip--added">
            {t('config.diff.added')} · {diffSummary.added}
          </span>
          <span className="cfg-diff__chip cfg-diff__chip--removed">
            {t('config.diff.removed')} · {diffSummary.removed}
          </span>
        </div>
        {!diffSummary.hasChanges && (
          <div className="cfg-create__review-nochange">
            {t('config.create.no_changes')}
          </div>
        )}
        {!current && (
          <div className="cfg-create__review-firstversion">
            {t('config.create.first_version')}
          </div>
        )}
      </div>

      <div className="cfg-create__review-preview">
        <div className="cfg-create__review-preview-title">
          {t('config.create.new_value_preview')}
        </div>
        <div className="cfg-create__side-card">
          <ConfigValueRenderer
            group={group}
            configKey={keyName}
            value={valueParsed}
          />
        </div>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------- */
/*  Helpers                                                              */
/* --------------------------------------------------------------------- */

const Field: FC<{ label: ReactNode; children: ReactNode }> = ({
  label,
  children,
}) => (
  <div className="cfg-create__field">
    <label className="cfg-create__label">{label}</label>
    {children}
  </div>
);

const ReviewField: FC<{ label: ReactNode; children: ReactNode; full?: boolean }> = ({
  label,
  children,
  full = false,
}) => (
  <div className={`cfg-create__review-field ${full ? 'cfg-create__review-field--full' : ''}`}>
    <div className="cfg-create__review-field-label">{label}</div>
    <div className="cfg-create__review-field-value">{children}</div>
  </div>
);
