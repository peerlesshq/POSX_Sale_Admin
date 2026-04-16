# POSX Token Sale System

Monorepo for the POSX token sale system: wallet-based user frontend, admin
panel, and Supabase-backed backend.

This repository is organised as a **pnpm workspace** and is being built in
phases. The source-of-truth business rules live in the numbered spec files at
the repo root (`00_master_prd.md` through `14_deployment_and_env_spec.md`).
Those documents are authoritative; code must follow them.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Architecture understanding + implementation plan | Approved |
| 2 | Monorepo scaffold, shared-types, shared-utils, api-contracts skeleton, env loader, config resolver skeleton | **This commit** |
| 3 | Migrations, seed scripts, domain rules, repositories | Pending |
| 4 | Auth, purchase, reward, claim, team, admin APIs | Pending |
| 5 | User frontend + admin frontend | Pending |
| 6 | Tests, mock data, runbook | Pending |

## Layout

```
.
├── apps/
│   ├── user-web/             # Phase 5 — Vite + React 18 + Tailwind (placeholder)
│   └── admin-web/            # Phase 5 — Vite + React 18 + Ant Design Pro (placeholder)
├── packages/
│   ├── shared-types/         # Enums + primitives + holding service interface
│   ├── shared-utils/         # amount / address / utc / clock / pagination / strings
│   ├── api-contracts/        # zod schemas for envelope, pagination, common types
│   ├── config/               # env loader + ConfigResolver interface
│   ├── domain-rules/         # Phase 3 — pure business rules (placeholder)
│   └── test-utils/           # Phase 6 — fixture builders (placeholder)
├── supabase/
│   ├── functions/_shared/    # Phase 4 — backend service layer (placeholder)
│   ├── migrations/           # Phase 3 — SQL migrations (placeholder)
│   └── seed/                 # Phase 3 — seed scripts (placeholder)
├── 00_master_prd.md          # Spec documents (source of truth, do not edit)
├── 01_business_rules_spec.md
├── ...
└── 14_deployment_and_env_spec.md
```

## Technology stack (committed for Phase 2+)

- **Package manager**: pnpm workspaces
- **Language**: TypeScript 5.3+
- **Runtime**: Node 18.18+ (local) / Deno-compatible edge functions
- **Validation**: `zod`
- **Amount math**: `decimal.js`
- **Auth crypto**: `bcrypt` (admin password hashing — Phase 3), `ethers` (wallet
  signature verification — Phase 4)
- **User frontend**: Vite + React 18 + Tailwind + `@tanstack/react-query` +
  `dayjs`
- **Admin frontend**: Vite + React 18 + `antd` + `@ant-design/pro-components` +
  `@tanstack/react-query` + `dayjs`

## Quickstart (Phase 2 scope)

```bash
# install dependencies
pnpm install

# typecheck all packages
pnpm typecheck

# lint
pnpm lint

# format check
pnpm format:check
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values. Backend-only
secrets (`SUPABASE_SERVICE_ROLE_KEY`, `*_SESSION_SECRET`) must never be
committed or exposed to frontend bundles.

The env loader lives in `packages/config/src/env/`. It parses `process.env` (or
any `Record<string, string | undefined>`) with a `zod` schema and fails fast on
missing or invalid values.

## Architectural guardrails

These rules protect business correctness and must not be violated by any later
phase code:

1. **Source-of-truth vs summary**: derived summary tables must always be
   rebuildable from fact tables; they must never be hand-seeded as business
   truth.
2. **UTC-only settlement**: every settlement / recompute / reporting metric
   uses UTC day boundaries.
3. **No destructive rewrites of claimed history**: corrections after claim
   must be represented as adjustment records.
4. **Holding isolation**: the value of `holding_posx_amount` must only be
   read through the `HoldingService` interface defined in
   `packages/shared-types/src/domain/holding.ts`. Business modules must never
   re-derive holding by reading `vesting_lots` or `purchases` directly.
5. **Frontend never re-implements sensitive formulas**: tier, team rate,
   equal-level, and burn calculations live in `packages/domain-rules/` (backend
   only); the frontend consumes already-computed values from APIs.
6. **Config resolution**: historical calculations must always resolve config
   versions that were valid at the original evaluation time, not the latest.
7. **MockClaimBroadcaster** is allowed only for local development. Staging must
   preserve `queued` and `broadcasted` intermediate states even if payout is
   simulated.

Violations of these rules are business bugs, not engineering preferences.

## Documentation

All design specifications are in the numbered `.md` files at the repo root.
When in doubt, read the spec first. The precedence order is:

1. `01_business_rules_spec.md`
2. `03_database_schema_spec.md`
3. `04_api_spec.md`
4. `07_state_machines_and_exception_flows.md`
5. `00_master_prd.md`
