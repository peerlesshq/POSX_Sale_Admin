# Staging Smoke Test

Checklist for verifying a staging deployment is healthy. Run after every deploy.

---

## 1. Environment markers

| Check | Expected | Pass? |
|---|---|---|
| Admin topbar shows env badge | Amber "STAGING" | [ ] |
| Admin sidebar footer shows env | Amber "STAGING" dot | [ ] |
| Admin login page shows env | Amber "STAGING" tag | [ ] |
| User-web header shows env | Amber "STAGING" pill | [ ] |
| No "MOCK" or "DEV" badges visible | True (mock API disabled) | [ ] |

## 2. Admin authentication

| Check | Expected | Pass? |
|---|---|---|
| Login as `superadmin@staging.local` / `Staging2025!!` | Success, redirect to dashboard | [ ] |
| Login as `operator@staging.local` / `Staging2025!!` | Success | [ ] |
| Login as `viewer@staging.local` / `Staging2025!!` | Success | [ ] |
| Login as `disabled@staging.local` / `Staging2025!!` | Rejected (account disabled) | [ ] |
| Login with wrong password | Rejected, error message shown | [ ] |
| Logout | Redirects to login page | [ ] |

## 3. Admin dashboard

| Check | Expected | Pass? |
|---|---|---|
| Dashboard page loads | No loading spinner stuck, no error banner | [ ] |
| Total users KPI | ~20 (seeded users) | [ ] |
| Total deposit KPI | > 0 (sum of seeded purchases) | [ ] |
| Tier distribution chart | Shows data (not empty) | [ ] |
| 14-day trend chart | Shows data points | [ ] |

## 4. Admin data pages

| Check | Expected | Pass? |
|---|---|---|
| Users list shows ~20 rows | Paginated, filterable | [ ] |
| User detail page loads for any user | Profile, rewards, team tabs | [ ] |
| Settlement jobs page shows ~5 jobs | Various statuses | [ ] |
| Admin accounts page shows 4 accounts | super_admin, operator, viewer, disabled | [ ] |
| Rewards pages load (all 4 sub-pages) | Direct, team, equal-level, burns | [ ] |
| Reports page loads | Shows seeded export jobs | [ ] |
| System overview page loads | Health, jobs, chain sync | [ ] |
| Audit logs page loads | Shows seeded admin actions | [ ] |
| Config page loads | Shows seeded config versions | [ ] |

## 5. Role-based access

| Check | Expected | Pass? |
|---|---|---|
| Viewer: no "New" button on Admin Accounts | Hidden | [ ] |
| Viewer: no "Trigger" on Settlement | Hidden | [ ] |
| Viewer: no "Export" on Reports | Hidden | [ ] |
| Viewer: no status change action in Users list | Hidden | [ ] |
| Operator: sees all action buttons | Visible | [ ] |
| Super admin: sees admin account management | Full access | [ ] |

## 6. Error states

| Check | Expected | Pass? |
|---|---|---|
| Disconnect network → refresh page | InlineError with retry button | [ ] |
| Filter users with no results | EmptyHint message, not blank table | [ ] |

## 7. User-web

| Check | Expected | Pass? |
|---|---|---|
| Landing page renders | Hero section, connect wallet CTA | [ ] |
| STAGING badge visible in header | Amber pill | [ ] |
| Mock API is disabled | No persona picker on landing page | [ ] |
| Dev auth bypass is disabled | No dev-mode banner | [ ] |

## 8. API health

| Check | Expected | Pass? |
|---|---|---|
| `GET /api/v1/config/public` | `{ "success": true, "data": {...} }` | [ ] |
| `POST /api/v1/admin/auth/login` with valid creds | Returns session token | [ ] |
| `POST /api/v1/admin/auth/login` with bad creds | Returns `UNAUTHORIZED` | [ ] |
| `OPTIONS /api/v1/admin/auth/login` | 204 with CORS headers | [ ] |
| Body > 1MB | 413 `INVALID_REQUEST` | [ ] |

## 9. Isolation verification

| Check | Expected | Pass? |
|---|---|---|
| Staging API URL is NOT production | Different Supabase project URL | [ ] |
| Admin login creds don't work on production | Rejected | [ ] |
| Edge function logs show `[POSX] Environment: staging` | Correct | [ ] |
| Edge function logs show staging broadcaster name | `staging-claim-broadcaster` | [ ] |

## 10. Data integrity

| Check | Expected | Pass? |
|---|---|---|
| `SELECT count(*) FROM users` | ~20 | [ ] |
| `SELECT count(*) FROM admin_users` | 4 | [ ] |
| `SELECT count(*) FROM config_versions` | 14 | [ ] |
| `SELECT count(*) FROM settlement_jobs` | 5+ | [ ] |
| `SELECT count(*) FROM purchases` | 15+ | [ ] |
| `SELECT count(*) FROM team_rewards_daily` | 20+ | [ ] |

---

## Result

| Section | Status |
|---|---|
| Environment markers | __ / 5 |
| Admin authentication | __ / 6 |
| Admin dashboard | __ / 5 |
| Admin data pages | __ / 9 |
| Role-based access | __ / 6 |
| Error states | __ / 2 |
| User-web | __ / 4 |
| API health | __ / 5 |
| Isolation | __ / 4 |
| Data integrity | __ / 6 |
| **Total** | **__ / 52** |

**Staging is healthy when: all 52 checks pass.**

Date: ____________  
Tester: ____________  
Admin URL: ____________  
User URL: ____________  
Supabase project: ____________
