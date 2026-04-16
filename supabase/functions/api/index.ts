/**
 * Supabase Edge Function entry — the unified `api` function that
 * serves every `/api/v1/*` route.
 *
 * Phase 4.5 deploy model: one edge function handles all user +
 * admin routes. This keeps the cold-start count down and lets the
 * in-memory config resolver cache stay warm across requests in a
 * given worker.
 *
 * Running locally (Deno):
 *   supabase functions serve api --env-file .env.local \
 *     --import-map supabase/functions/import_map.json
 *
 * Running in Node integration tests:
 *   import { handleApiRequest } from '.../serve';
 *   const res = await handleApiRequest(new Request(...));
 */
import { handleApiRequest } from './serve';

// Deno's `serve` is resolved at runtime via the Deno globals. In
// Node the import is a no-op because `globalThis.Deno` is undefined
// and the branch below is skipped entirely.
declare const Deno: { serve?: (handler: (req: Request) => Promise<Response>) => unknown } | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => handleApiRequest(req));
}

export { handleApiRequest };
