/**
 * Service layer — orchestration, NOT data access.
 *
 * Every file here either:
 *   - composes repositories behind a business-oriented API, or
 *   - wraps a `@posx/domain-rules` pure function with the config /
 *     DB lookups it needs.
 *
 * Services MUST NOT duplicate the pure logic in `@posx/domain-rules`.
 * When you find yourself re-implementing a tier / team-rate / burn /
 * equal-level formula inside a service, stop and move it to
 * `domain-rules` first.
 */
export * from './user-access-policy';
export * from './admin-action-guard';
export * from './config-resolver-db';
export * from './holding-service';
export * from './referral-binding-service';
export * from './tier-evaluation-service';
export * from './team-aggregate-service';
export * from './purchase-order-service';
export * from './purchase-fact-service';
export * from './purchase-recovery-service';
export * from './purchase-reversal-service';
export * from './chain-event-processor';
export * from './burn-service';
export * from './settlement-orchestrator';
export * from './claim-preparation-service';
export * from './claim-signing-service';
export * from './claim-finalization-service';
export * from './adjustment-service';
export * from './recompute-service';
export * from './claim-broadcast';
export * from './report-export-worker';
