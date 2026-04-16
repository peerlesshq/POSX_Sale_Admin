/**
 * Endpoint schema registry — full Phase 4.5 surface.
 *
 * User-side:
 *   - auth            (nonce / verify / logout)
 *   - public-config   (GET /config/public)
 *   - user            (profile / dashboard)
 *   - purchase        (create / attach-tx / get / recover)
 *   - purchase-list   (GET /purchases)
 *   - vesting         (GET /vesting)
 *   - reward          (overview / direct / team / team detail /
 *                      equal-level / burn-status / claims)
 *   - claim           (create / sign / get)
 *   - team            (overview / members / daily-details)
 *   - invite          (overview / referrals)
 *
 * Admin-side:
 *   - admin-auth      (login / logout)
 *   - admin-dashboard
 *   - admin-users     (list / detail / tree / patch status)
 *   - admin-rewards   (direct / team / team detail / equal-level / burns)
 *   - admin-config    (list / create / history)
 *   - admin-settlement (trigger / list / detail / recompute preview / apply)
 *   - admin-reports   (summary / rankings / export)
 *   - admin-system    (chain-sync / jobs / health / logs)
 *   - admin-accounts  (list / create / update)
 */
export * from './auth';
export * from './public-config';
export * from './user';
export * from './purchase';
export * from './purchase-list';
export * from './vesting';
export * from './reward';
export * from './claim';
export * from './team';
export * from './invite';
export * from './admin-auth';
export * from './admin-dashboard';
export * from './admin-users';
export * from './admin-rewards';
export * from './admin-config';
export * from './admin-settlement';
export * from './admin-reports';
export * from './admin-system';
export * from './admin-accounts';
