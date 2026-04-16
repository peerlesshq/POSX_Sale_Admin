# Phase 3 — Engineering Closure + Staging-RC Checkpoint

**Scope**: three targeted fixes (ConfigGroup import, ethers dependency, CI gates) plus a full verification pass.

---

## Items completed

### P3-1 — ConfigGroup value re-export

`packages/config/src/config-resolver/types.ts` previously had `import type { ConfigGroup }` from `@posx/shared-types`. The `type` keyword erased the value at compile time, so every `_shared` service that referenced `ConfigGroup.ClaimRules` (or similar) hit TS2305 "has no exported member".

**Fix**: changed to a value import + explicit `export { ConfigGroup }` so the barrel re-export chain (`types.ts` → `config-resolver/index.ts` → `config/src/index.ts` → `@posx/config`) carries both the type and value.

**Result**: 6 TS errors eliminated from `_shared`.

### P3-2 — ethers dependency

`supabase/functions/_shared` imports `ethers` in `crypto/wallet-signature.ts` but the package was never declared as a dependency. `persona-fixture.test.ts` failed to load because Vitest couldn't resolve it.

**Fix**: `pnpm add ethers` in the `_shared` workspace. Installed ethers 6.16.0.

**Result**: persona-fixture test suite now loads and passes (10 new tests). Total: **6 suites, 44 tests, all green**.

### P3-3 — CI workflow

Created `.github/workflows/ci.yml` with four jobs:

| Job | Gate | Blocks build? |
|---|---|---|
| `lint` | `pnpm lint` (eslint --max-warnings=0) | Yes (build depends on lint) |
| `typecheck` | `tsc -b --noEmit` on admin-web, user-web, backend-core | Yes |
| `test` | `pnpm test` (vitest run) | Yes |
| `build` | `vite build` on admin-web + user-web | Runs after lint+typecheck+test pass |

Concurrency: `cancel-in-progress` per ref. Triggers: push to `main`/`develop`, PRs to same.

**Note**: the `lint` and `typecheck` jobs will FAIL on the current repo because of the 43 pre-existing errors. The CI gate is deliberately strict so these errors are visible — they must be cleaned up before the first green CI run. This is intentional: a CI gate that silently passes while errors exist is worse than no gate at all.

---

## P3-4 — Full verification results

### Tests

```
Test Suites:  6 passed (6)
Tests:        44 passed (44)
Duration:     1.10s
```

| Suite | Tests | Status |
|---|---|---|
| `shared-utils/amount` | 7 | ✅ |
| `domain-rules/team-differential` | 4 | ✅ |
| `domain-rules/equal-level` | 10 | ✅ |
| `domain-rules/burn` | 10 | ✅ |
| `_shared/report-export-worker` | 3 | ✅ |
| `_shared/persona-fixture` | 10 | ✅ |

### Typecheck

| Target | Errors | Delta from pre-remediation | Category |
|---|---|---|---|
| `_shared tsc -b --noEmit` | **14** | **-9** (was 23) | 5 rootDir, 6 settlement mustHave, 1 IsoTimestamp, 1 postgres-js, 1 unused import |
| `admin-web tsc -b --noEmit` | **19** | **-19** (was 38) | 3 ECharts, 3 ErrorBoundary, 8 unused vars/imports, 2 SettlementPage body, 1 SectionTone, 1 graphBuilder, 1 recompute schema |
| `user-web tsc -b --noEmit` | **10** | **-8** (was 18) | 2 DonutMini, 3 ErrorBoundary, 5 lucide-react |

### Lint

```
58 problems (12 errors, 46 warnings)
```

12 errors are all unused imports/vars. 46 warnings are non-null assertions.

### Build

Both `admin-web` and `user-web` build via `vite build` (Vite bypasses tsc strict mode).

---

## Cumulative verification matrix (pre-remediation → now)

| Metric | Pre-remediation | Post-Pass-3 | Total Δ |
|---|---|---|---|
| Tests passing | 0 | **44** | **+44** |
| Test suites | 0 | **6 (all green)** | **+6** |
| `_shared` TS errors | 23 | **14** | **-9** |
| `admin-web` TS errors | 38 | **19** | **-19** |
| `user-web` TS errors | 18 | **10** | **-8** |
| `eslint` errors | 13 | **12** | **-1** |
| CI workflow | none | **4 jobs (lint, typecheck, test, build)** | new |

---

## Staging-RC assessment

The admin surface is **conditionally staging-RC**:

- ✅ All tests pass (44/44)
- ✅ Both apps build
- ✅ Money paths hardened (settlement tx + lock + idempotency, claim signed_message, production gate)
- ✅ Admin auth hardened (rate limit, lockout, full audit)
- ✅ Edge function hardened (body cap, CORS, error scrubbing)
- ✅ Dashboard shows real data (tier distribution, 14-day trend, filtered pagination)
- ✅ Recompute plumbing works end-to-end
- ✅ Report exports survive deploys
- ✅ CI gates defined
- ⚠️ 43 pre-existing TS errors remain (none introduced by remediation)
- ⚠️ 12 lint errors remain (all unused imports/vars)
- ⚠️ CI will fail until pre-existing errors are cleaned
- ❌ Claims do not pay out in production (safety gate — intentional)
- ❌ `current_tier: null` in 9 handler fields
- ❌ No role enforcement on admin read handlers (BE-17)

**Verdict**: the admin surface can be deployed to staging for UX testing and operator training, provided the team understands that (a) claims are gated and (b) the CI gate will need a cleanup pass to turn green. The backend correctness and safety posture is significantly improved over pre-remediation.

---

*Phase 3 compiled on 2026-04-15.*
