# Staging Test Accounts

All accounts listed here exist **only in the staging environment**. They are created by the staging seed (`supabase/seeds/admin-fixtures.sql` and `supabase/seeds/user-fixtures.sql`). Never reuse these credentials in production.

---

## Admin accounts

| Email | Password | Role | Status | UUID |
|---|---|---|---|---|
| `superadmin@staging.local` | `Staging2025!!` | `super_admin` | active | `a0000001-0000-0000-0000-000000000001` |
| `operator@staging.local` | `Staging2025!!` | `operator` | active | `a0000002-0000-0000-0000-000000000002` |
| `viewer@staging.local` | `Staging2025!!` | `viewer` | active | `a0000003-0000-0000-0000-000000000003` |
| `disabled@staging.local` | `Staging2025!!` | `operator` | disabled | `a0000004-0000-0000-0000-000000000004` |

### How to log in

1. Navigate to `https://admin-staging.example.com/login`
2. Enter email and password from the table above
3. The topbar and sidebar will show an amber "STAGING" badge

### Role-permission mapping

| Capability | super_admin | operator | viewer |
|---|---|---|---|
| View all pages | Yes | Yes | Yes |
| Trigger settlement | Yes | Yes | No |
| Create config version | Yes | Yes | No |
| Create/update admin accounts | Yes | No | No |
| Apply recompute | Yes | No | No |
| Change user status (suspended/blacklisted) | Yes | No | No |
| Change user status (other) | Yes | Yes | No |
| Export reports | Yes | Yes | No |

### Rotation

To reset admin passwords:
1. Generate new bcrypt hash: `node -e "console.log(require('bcryptjs').hashSync('NewPassword!!', 12))"`
2. Update `supabase/seeds/admin-fixtures.sql`
3. Run `pnpm reset:staging`

---

## User test accounts

User accounts authenticate via wallet signature (no email/password). In staging, use the dev auth bypass or mock API to simulate wallet sessions.

| Wallet | Scenario | Status | Deposit | Key traits |
|---|---|---|---|---|
| `0x...0001` | Normal active | active | 10,000 USDT | Has referrer, basic tier |
| `0x...0002` | Rewards heavy | active | 300,000 USDT | Elite tier, team leader |
| `0x...0003` | No rewards | active | 2,000 USDT | Basic, no reward snapshots |
| `0x...0004` | Suspended | suspended | 5,000 USDT | Shows RestrictedBanner |
| `0x...0005` | Blacklisted | blacklisted | 3,000 USDT | Shows RestrictedBanner |
| `0x...0006` | Restricted purchase | restricted_purchase | 8,000 USDT | Can't buy |
| `0x...0007` | Restricted claim | restricted_claim | 15,000 USDT | Can't claim |
| `0x...0008` | Pending purchase | active | 0 | Has pending order |
| `0x...0009` | Confirmed purchase | active | 50,000 USDT | Advanced tier |
| `0x...0010` | Failed purchase | active | 0 | Has failed order |
| `0x...0011` | Queued claim | active | 20,000 USDT | Claim in queued state |
| `0x...0012` | Failed claim | active | 25,000 USDT | Claim in failed state |
| `0x...0013` | Finalized claim | active | 30,000 USDT | Claim confirmed + record |
| `0x...0014` | Team leader | active | 100,000 USDT | 5+ direct referrals |
| `0x...0015` | No inviter | active | 40,000 USDT | Root node, no referral |
| `0x...0016` | New user | active | 0 | Created today, no history |
| `0x...0017` | Whale | active | 500,000 USDT | Max tier |
| `0x...0018` | Burn affected | active | 25,000 USDT | Rewards partially burned |
| `0x...0019` | Partial vesting | active | 250,000 USDT | 75k released of 250k |
| `0x...0020` | Multi purchase | active | 120,000 USDT | Mixed order statuses |

### How to test user-web

**Option A — Mock API (local dev only)**:
Set `VITE_USE_MOCK_API=true` and `VITE_ENABLE_DEV_AUTH_BYPASS=true`. Use the persona picker on the landing page.

**Option B — Staging backend**:
Set `VITE_APP_ENV=staging` and the staging API URL. The dev auth bypass is disabled in staging by design. To test authenticated user flows, you need to either:
1. Use the wallet signature flow with a test wallet that matches a seeded user
2. Or temporarily enable `VITE_ENABLE_DEV_AUTH_BYPASS=true` in a local build pointing at the staging API (not recommended for shared staging deployments)

---

## Security notes

- These accounts use weak, shared passwords — acceptable for staging QA only
- The `@staging.local` email domain is intentionally non-routable
- Staging admin sessions are stored in the staging Supabase project's `admin_sessions` table, completely isolated from production
- Resetting staging (via `pnpm reset:staging`) destroys all sessions
