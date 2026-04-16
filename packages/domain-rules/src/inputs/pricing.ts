/**
 * Normalized pricing input.
 *
 * Source of truth: 09 §9.1 (`pricing.token_price`).
 *
 * `evaluation_price` is the price used to translate
 * `holding_posx_amount` into `holding_value_usdt` during tier / burn
 * evaluation. The domain-rules layer never fetches this value itself;
 * callers must resolve and pass it in.
 */
import type { AmountString } from '@posx/shared-types';

export interface Pricing {
  readonly token_price: AmountString;
  readonly currency: 'USDT';
}
