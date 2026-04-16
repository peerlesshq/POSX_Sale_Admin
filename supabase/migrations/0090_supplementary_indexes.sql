-- =============================================================================
-- 0090_supplementary_indexes.sql
--
-- Phase 3 keeps this file minimal on purpose. Every non-obvious index
-- the query plans rely on has been inlined next to the table in its
-- own migration. Additional indexes should be added here (or in a new
-- numbered migration) when real workloads prove a specific plan is
-- suboptimal. Premature indexing is forbidden.
-- =============================================================================

-- No supplementary indexes in this phase.
select 1 as noop;
