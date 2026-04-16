# `supabase/seed`

Placeholder for Phase 3.

Seed scripts will insert source-of-truth rows (admin accounts, config
versions, users, purchases, etc.) and then trigger summary rebuild jobs to
populate derived tables. Derived summary tables must **never** be hand-seeded
as business truth — see `13_seed_data_and_mock_data.md §25.2` and the
architectural guardrails in the repo `README.md`.
