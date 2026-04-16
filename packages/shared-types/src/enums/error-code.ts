/**
 * Stable API error codes.
 *
 * Source of truth: 04_api_spec.md §4
 *
 * These strings are the contract between backend and frontend i18n.
 * Backend returns them in the error envelope; frontend maps each code to
 * a localized message via translation files (10 §10.2).
 *
 * Adding a new code is an additive change; renaming or repurposing a
 * code is a breaking change.
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ErrorCode = {
  // --- General ---
  InvalidRequest: 'INVALID_REQUEST',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  RateLimited: 'RATE_LIMITED',
  InternalError: 'INTERNAL_ERROR',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',

  // --- Auth ---
  NonceExpired: 'NONCE_EXPIRED',
  NonceAlreadyUsed: 'NONCE_ALREADY_USED',
  InvalidSignature: 'INVALID_SIGNATURE',
  SessionExpired: 'SESSION_EXPIRED',
  AdminDisabled: 'ADMIN_DISABLED',

  // --- Purchase ---
  PurchaseNotAllowed: 'PURCHASE_NOT_ALLOWED',
  MinPurchaseNotMet: 'MIN_PURCHASE_NOT_MET',
  InvalidTxHash: 'INVALID_TX_HASH',
  PurchaseAlreadyRecovered: 'PURCHASE_ALREADY_RECOVERED',
  PurchaseDuplicate: 'PURCHASE_DUPLICATE',
  PurchaseNotFound: 'PURCHASE_NOT_FOUND',

  // --- Claim ---
  ClaimNotAllowed: 'CLAIM_NOT_ALLOWED',
  ClaimMinAmountNotMet: 'CLAIM_MIN_AMOUNT_NOT_MET',
  ClaimNothingAvailable: 'CLAIM_NOTHING_AVAILABLE',
  ClaimAlreadyInProgress: 'CLAIM_ALREADY_IN_PROGRESS',
  ClaimSignatureRequired: 'CLAIM_SIGNATURE_REQUIRED',
  ClaimBroadcastFailed: 'CLAIM_BROADCAST_FAILED',

  // --- Config / Admin ---
  InvalidConfigValue: 'INVALID_CONFIG_VALUE',
  InvalidConfigScope: 'INVALID_CONFIG_SCOPE',
  AdminRoleRequired: 'ADMIN_ROLE_REQUIRED',
  RecomputeApplyForbidden: 'RECOMPUTE_APPLY_FORBIDDEN',

  // --- Business rules ---
  ReferralAlreadyBound: 'REFERRAL_ALREADY_BOUND',
  InvalidReferral: 'INVALID_REFERRAL',
  SelfReferralNotAllowed: 'SELF_REFERRAL_NOT_ALLOWED',
  ReferralCycleNotAllowed: 'REFERRAL_CYCLE_NOT_ALLOWED',
  UserStatusRestricted: 'USER_STATUS_RESTRICTED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ERROR_CODE_VALUES = [
  ErrorCode.InvalidRequest,
  ErrorCode.Unauthorized,
  ErrorCode.Forbidden,
  ErrorCode.NotFound,
  ErrorCode.Conflict,
  ErrorCode.RateLimited,
  ErrorCode.InternalError,
  ErrorCode.ServiceUnavailable,
  ErrorCode.NonceExpired,
  ErrorCode.NonceAlreadyUsed,
  ErrorCode.InvalidSignature,
  ErrorCode.SessionExpired,
  ErrorCode.AdminDisabled,
  ErrorCode.PurchaseNotAllowed,
  ErrorCode.MinPurchaseNotMet,
  ErrorCode.InvalidTxHash,
  ErrorCode.PurchaseAlreadyRecovered,
  ErrorCode.PurchaseDuplicate,
  ErrorCode.PurchaseNotFound,
  ErrorCode.ClaimNotAllowed,
  ErrorCode.ClaimMinAmountNotMet,
  ErrorCode.ClaimNothingAvailable,
  ErrorCode.ClaimAlreadyInProgress,
  ErrorCode.ClaimSignatureRequired,
  ErrorCode.ClaimBroadcastFailed,
  ErrorCode.InvalidConfigValue,
  ErrorCode.InvalidConfigScope,
  ErrorCode.AdminRoleRequired,
  ErrorCode.RecomputeApplyForbidden,
  ErrorCode.ReferralAlreadyBound,
  ErrorCode.InvalidReferral,
  ErrorCode.SelfReferralNotAllowed,
  ErrorCode.ReferralCycleNotAllowed,
  ErrorCode.UserStatusRestricted,
] as const satisfies ReadonlyArray<ErrorCode>;

export const isErrorCode = createEnumGuard(ERROR_CODE_VALUES);
