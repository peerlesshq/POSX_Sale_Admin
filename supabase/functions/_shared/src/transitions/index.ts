/**
 * State transition helpers.
 *
 * Constraint 2: NO service or handler may update status on a
 * purchase_order, claim_order, settlement_job, or users row outside
 * this folder. Reviewers searching for `update ... set status =`
 * outside `./src/transitions/` should treat any match as a bug.
 */
export * from './purchase-order';
export * from './claim-order';
export * from './settlement-job';
export * from './user-status';
