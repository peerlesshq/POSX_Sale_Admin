-- =============================================================================
-- 0100_optional_views.sql
--
-- Phase 3 intentionally ships NO views. The optional helper views
-- listed in 03 §22 (`vw_active_purchase_facts`,
-- `vw_user_claimable_reward_items`, `vw_user_team_direct_subordinates`,
-- `vw_daily_reward_totals`) will be added when the query shapes they
-- simplify are actually used by a Phase 4 handler or a Phase 6 report.
--
-- Adding views this early would couple the schema to a query plan that
-- does not yet exist, which violates the Phase 3 constraint of
-- avoiding premature complexity.
-- =============================================================================

select 1 as noop;
