# `supabase/functions/api`

Unified Edge Function serving every `/api/v1/*` route in Phase 4.5.

## Why one function

One `api` function handles every user + admin route instead of one
function per path. The rationale:

- **Cold start budget.** Each Supabase Edge Function is a separate
  Deno runtime; fewer functions = fewer cold starts.
- **Shared cache.** The in-memory `DbConfigResolver` cache stays warm
  across requests in a single worker.
- **Single import map.** One `import_map.json` configures Deno's
  `@posx/*` resolution for all routes.

When Phase 6 profiles the hot paths, we can peel specific endpoints
off into their own functions without touching handler code — only the
router and deploy config.

## Files

- `index.ts` — Deno `Deno.serve` entry. Node tests call `handleApiRequest` directly.
- `serve.ts` — parses the `Request`, builds the `HandlerContext`, dispatches via the router, serialises the envelope. Runtime-agnostic.
- `context.ts` — wires every service from `@posx/backend-core` into a `HandlerContext`. Chooses `MockClaimBroadcaster` locally and `StagingClaimBroadcaster` on staging (constraint from Phase 2 §6).
- `router.ts` — the full route table. Every entry maps a
  `(method, pattern)` to an auth mode and a handler dispatch
  function. Path params use `:name` syntax.

## Adding a new route

1. Write the contract schema under `packages/api-contracts/src/endpoints/`.
2. Write the handler under `supabase/functions/_shared/src/handlers/`
   and export it from `handlers/index.ts`.
3. Add one entry to `ROUTES` in `./router.ts`. Pick the right `mode`
   (`public` / `user` / `admin`) and call the matching schema parser
   inside the `dispatch` closure.
4. Done — no new file in `supabase/functions/api/` is required.
