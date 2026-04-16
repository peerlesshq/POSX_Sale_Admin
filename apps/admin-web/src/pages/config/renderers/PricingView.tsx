/**
 * PricingView — renderer for `pricing.token_price`.
 *
 * Shows the single-token price as a hero stat with currency
 * underneath. This is not a key/value dump — it's meant to look
 * like a first-class pricing readout on a financial ops screen.
 */
import type { FC } from 'react';

import { useT } from '../../../lib/i18n';

interface PricingValue {
  readonly token_price?: string;
  readonly currency?: string;
}

export const PricingView: FC<{ value: Record<string, unknown> }> = ({ value }) => {
  const t = useT();
  const v = value as PricingValue;
  const price = v.token_price ?? '—';
  const currency = v.currency ?? 'USDT';

  return (
    <div className="cfg-render cfg-render--pricing">
      <div className="cfg-render-pricing__hero">
        <div className="cfg-render-pricing__label">{t('config.render.pricing.label')}</div>
        <div className="cfg-render-pricing__value">
          <span className="cfg-render-pricing__price">{price}</span>
          <span className="cfg-render-pricing__unit">{currency}</span>
        </div>
        <div className="cfg-render-pricing__hint">
          {t('config.render.pricing.hint')}
        </div>
      </div>
    </div>
  );
};
