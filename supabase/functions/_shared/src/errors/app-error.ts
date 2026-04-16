/**
 * `AppError` — the single exception type every backend handler
 * converts into an API error envelope.
 *
 * Services throw `AppError` with a stable `error_code` from
 * `@posx/shared-types/enums/error-code`. Handlers catch it and
 * render the envelope verbatim so the frontend's i18n error
 * dictionary can map the code to a localized message.
 *
 * Never throw raw `Error` from a service that can reach a handler —
 * every user-visible failure must carry an `error_code`.
 */
import { type ErrorCode } from '@posx/shared-types';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    errorCode: ErrorCode,
    message: string,
    options: { statusCode?: number; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.errorCode = errorCode;
    this.statusCode = options.statusCode ?? AppError.defaultStatus(errorCode);
    this.details = options.details;
  }

  static defaultStatus(code: ErrorCode): number {
    switch (code) {
      case 'INVALID_REQUEST':
      case 'INVALID_SIGNATURE':
      case 'INVALID_TX_HASH':
      case 'INVALID_REFERRAL':
      case 'INVALID_CONFIG_VALUE':
      case 'INVALID_CONFIG_SCOPE':
      case 'MIN_PURCHASE_NOT_MET':
      case 'CLAIM_MIN_AMOUNT_NOT_MET':
      case 'CLAIM_NOTHING_AVAILABLE':
      case 'SELF_REFERRAL_NOT_ALLOWED':
      case 'REFERRAL_CYCLE_NOT_ALLOWED':
        return 400;
      case 'UNAUTHORIZED':
      case 'NONCE_EXPIRED':
      case 'NONCE_ALREADY_USED':
      case 'SESSION_EXPIRED':
      case 'CLAIM_SIGNATURE_REQUIRED':
        return 401;
      case 'FORBIDDEN':
      case 'ADMIN_DISABLED':
      case 'PURCHASE_NOT_ALLOWED':
      case 'CLAIM_NOT_ALLOWED':
      case 'ADMIN_ROLE_REQUIRED':
      case 'RECOMPUTE_APPLY_FORBIDDEN':
      case 'USER_STATUS_RESTRICTED':
        return 403;
      case 'NOT_FOUND':
      case 'PURCHASE_NOT_FOUND':
        return 404;
      case 'CONFLICT':
      case 'PURCHASE_DUPLICATE':
      case 'PURCHASE_ALREADY_RECOVERED':
      case 'CLAIM_ALREADY_IN_PROGRESS':
      case 'REFERRAL_ALREADY_BOUND':
        return 409;
      case 'RATE_LIMITED':
        return 429;
      case 'CLAIM_BROADCAST_FAILED':
      case 'INTERNAL_ERROR':
        return 500;
      case 'SERVICE_UNAVAILABLE':
        return 503;
      default:
        return 500;
    }
  }

  toEnvelope(requestId: string): {
    success: false;
    data: null;
    error_code: ErrorCode;
    message: string | null;
    request_id: string;
  } {
    return {
      success: false,
      data: null,
      error_code: this.errorCode,
      message: this.message || null,
      request_id: requestId,
    };
  }
}

/**
 * Re-throw `err` as an `AppError` with a generic `INTERNAL_ERROR`
 * code if it isn't one already. Used at handler boundaries to keep
 * the error-envelope contract watertight.
 */
export function toAppError(err: unknown, fallbackMessage: string): AppError {
  if (err instanceof AppError) return err;
  const message =
    err instanceof Error && err.message ? err.message : fallbackMessage;
  return new AppError('INTERNAL_ERROR', message);
}
