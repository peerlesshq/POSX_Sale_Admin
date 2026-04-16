/**
 * Handler plumbing — the shape every Phase 4 handler function
 * receives.
 *
 * Handlers are pure functions of `(ctx, input) → envelope`. They
 * do NOT know about HTTP transport. A Phase 5 edge function shim
 * will parse the `Request`, call the handler, and serialize the
 * envelope back to the wire.
 */
import type { ErrorCode } from '@posx/shared-types';

import type { AdminAuthService, UserSessionService } from '../auth';
import type { DbClient } from '../db';
import type { Logger } from '../observability';
import type {
  AdjustmentService,
  ClaimFinalizationService,
  ClaimPreparationService,
  ClaimSigningService,
  PurchaseFactService,
  PurchaseOrderService,
  PurchaseRecoveryService,
  RecomputeService,
  SettlementOrchestrator,
  UserAccessPolicyService,
} from '../services';
import type { NonceService, WalletVerifyService } from '../auth';

/**
 * Wide-open service bag. Handlers should destructure only what
 * they need. Not every service is guaranteed to be present in a
 * given function invocation (the chain event processor path does
 * not need a claim broadcaster, etc.) — use this as a convenience
 * container at the edge function entry.
 */
export interface HandlerServices {
  readonly userSessions: UserSessionService;
  readonly adminAuth: AdminAuthService;
  readonly nonces: NonceService;
  readonly walletVerify: WalletVerifyService;
  readonly purchaseOrder: PurchaseOrderService;
  readonly purchaseFact: PurchaseFactService;
  readonly purchaseRecovery: PurchaseRecoveryService;
  readonly claimPrep: ClaimPreparationService;
  readonly claimSigning: ClaimSigningService;
  readonly claimFinalization: ClaimFinalizationService;
  readonly settlement: SettlementOrchestrator;
  readonly recompute: RecomputeService;
  readonly adjustments: AdjustmentService;
  readonly userAccess: UserAccessPolicyService;
}

export interface HandlerContext {
  readonly db: DbClient;
  readonly services: HandlerServices;
  readonly logger: Logger;
  readonly requestId: string;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

export interface HandlerSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly error_code: null;
  readonly message: null;
  readonly request_id: string;
}

export interface HandlerError {
  readonly success: false;
  readonly data: null;
  readonly error_code: ErrorCode;
  readonly message: string | null;
  readonly request_id: string;
}

export type HandlerResult<T> = HandlerSuccess<T> | HandlerError;

export function success<T>(ctx: HandlerContext, data: T): HandlerSuccess<T> {
  return {
    success: true,
    data,
    error_code: null,
    message: null,
    request_id: ctx.requestId,
  };
}
