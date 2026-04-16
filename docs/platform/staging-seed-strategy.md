# Staging Seed Strategy

Staging seed is split into 4 ordered layers. Each layer is an independent SQL file run sequentially.

---

## Seed Layers

### Layer 1: `base.sql` -- Schema-level defaults

Sets system configuration that must exist before any fixtures.

Contents:
- Config version record (e.g., `system_config.version = '1.0.0'`)
- Default system settings (reward rates, claim limits, settlement thresholds)
- Enum seed values if any tables depend on reference data
- Feature flags with staging-appropriate defaults

```sql
-- Example: system config
INSERT INTO system_config (key, value, updated_at)
VALUES
  ('config_version', '1.0.0', now()),
  ('reward_rate_default', '0.05', now()),
  ('claim_min_amount', '10', now()),
  ('settlement_batch_size', '100', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### Layer 2: `admin-fixtures.sql` -- Staging admin accounts

Creates admin users and associated history records.

**Admin accounts (4):**

| Email | Role | Status | Purpose |
|---|---|---|---|
| `staging-super@example.com` | super_admin | active | Full access, settlement triggers |
| `staging-ops@example.com` | operator | active | Day-to-day operations |
| `staging-viewer@example.com` | viewer | active | Read-only dashboard access |
| `staging-disabled@example.com` | operator | disabled | Test disabled-admin flows |

**Associated data:**
- `admin_logs`: 20+ log entries across all admins (login, config change, settlement trigger, user suspension)
- `admin_sessions`: 5+ session records per active admin (mix of active and expired)
- Password hashes via Supabase auth staging project (created through auth API, not raw SQL)

### Layer 3: `user-fixtures.sql` -- User scenario coverage

Creates 20+ users covering every meaningful state. Each user has a descriptive email prefix for easy identification.

**User scenarios:**

| # | Email prefix | Scenario | Key state |
|---|---|---|---|
| 1 | `normal-user` | Standard active user | Has rewards, purchases, normal activity |
| 2 | `rewards-heavy` | User with many rewards | 50+ reward records, high balance |
| 3 | `rewards-zero` | User with zero rewards | Account exists, no reward activity |
| 4 | `suspended-user` | Suspended account | `status=suspended`, has pre-suspension activity |
| 5 | `blacklisted-user` | Blacklisted account | `status=blacklisted`, blocked from all actions |
| 6 | `pending-purchase` | Mid-purchase flow | Purchase record in `pending` state |
| 7 | `failed-purchase` | Failed purchase | Purchase record in `failed` state with error |
| 8 | `confirmed-purchase` | Completed purchase | Purchase `confirmed`, rewards credited |
| 9 | `queued-claim` | Claim in queue | Claim record in `queued` state |
| 10 | `failed-claim` | Failed claim | Claim in `failed` state with retry data |
| 11 | `finalized-claim` | Completed claim | Claim `finalized` with fake tx hash |
| 12 | `multi-claim` | Multiple claims | 5+ claims in mixed states |
| 13 | `team-leader` | Has referrals | 3+ direct referrals with rewards |
| 14 | `team-member` | Is a referral | Has inviter, referral bonus credited |
| 15 | `no-inviter` | No referral chain | Registered without invite code |
| 16 | `new-signup` | Just registered | No activity beyond account creation |
| 17 | `burn-active` | Active burn user | Multiple burn records |
| 18 | `burn-pending` | Pending burn | Burn in `pending` state |
| 19 | `reversal-user` | Has reversal | Purchase reversed, rewards clawed back |
| 20 | `edge-balance` | Edge-case balance | Balance at exact claim threshold |

### Layer 4: `ops-scenarios.sql` -- Operational state coverage

Creates backend operational records for admin dashboard and job testing.

**Settlement scenarios:**
- 1 `running` settlement job (in-progress, partial completion)
- 2 `completed` settlement jobs (one recent, one 30 days old)
- 1 `failed` settlement job (with error message and partial snapshot)
- 1 `partial` settlement (completed with skipped users)

**Job runs:**
- 10+ `job_runs` records across settlement, sync, rebuild
- Mix of success, failure, and timeout statuses
- Timestamps spanning last 30 days

**Chain sync states:**
- 1 `normal` sync state (last_block within 10 of chain head)
- 1 `lagging` sync state (last_block 1000+ behind, triggers warning)

**Report/dashboard data:**
- 3 report export records (completed CSV, pending, failed)
- Dashboard KPI aggregates for last 7 days (daily user signups, purchase volume, reward totals)
- 2 recompute preview records (one pending review, one applied)

---

## Commands

### Seed staging

```bash
pnpm seed:staging
```

Runs all 4 layers in order:
```
base.sql -> admin-fixtures.sql -> user-fixtures.sql -> ops-scenarios.sql
```

### Reset staging (full)

```bash
pnpm reset:staging
```

Executes:
1. `supabase db reset --db-url $SUPABASE_DB_URL` (drops all tables, re-runs migrations)
2. `pnpm seed:staging` (runs all 4 layers)

### Seed individual layer

```bash
pnpm seed:staging --layer admin    # runs admin-fixtures.sql only
pnpm seed:staging --layer users    # runs user-fixtures.sql only
pnpm seed:staging --layer ops      # runs ops-scenarios.sql only
```

---

## Differences from Local Seed

| Aspect | Local seed (`pnpm db:seed`) | Staging seed (`pnpm seed:staging`) |
|---|---|---|
| Admin count | 3 | 4 (adds disabled admin) |
| User count | ~14 (5 core + 5 burn + 1 reversal + optional 8) | 20+ with explicit scenario coverage |
| Ops data | None | Settlement jobs, chain sync, reports, KPIs |
| Idempotency | Not idempotent (fresh DB only) | Not idempotent (run after reset only) |
| Auth users | Created via seed script | Created via Supabase auth API against staging project |

---

## File Locations

```
packages/db/
  seeds/
    staging/
      base.sql
      admin-fixtures.sql
      user-fixtures.sql
      ops-scenarios.sql
    local/
      seed.ts          # existing local seed
```
