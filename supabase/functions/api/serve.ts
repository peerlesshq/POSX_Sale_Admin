/**
 * Generic `Request → envelope → Response` adapter.
 *
 * Pure TypeScript, no Deno-specific imports. The Deno entry file
 * (`index.ts`) wires this to `Deno.serve(...)`; Node harnesses and
 * integration tests can import `handleApiRequest` directly.
 */
import type { HandlerResult } from '@posx/backend-core';

import { buildHandlerContext } from './context';
import { dispatchRoute, type RouteRequest } from './router';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

/**
 * BE-83: hard ceiling on request body size. One malformed client or
 * attacker who pipes a multi-MB payload into the edge function must
 * NOT be able to stall the handler. 1 MiB is generous for every
 * legitimate endpoint in this API (the biggest ones are config JSON
 * patches) and matches the Supabase edge-function default.
 */
const MAX_REQUEST_BODY_BYTES = 1024 * 1024; // 1 MiB

/**
 * BE-84: CORS. Without preflight support the admin frontend and the
 * user frontend can't talk to the edge function at all from a
 * browser. We allow every configured origin for now and surface the
 * Authorization header so the session token can flow. Narrowing to a
 * configured allowlist is a follow-up tracked in the remediation doc.
 */
const CORS_ALLOW_ORIGIN = '*';
const CORS_ALLOW_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const CORS_ALLOW_HEADERS = 'authorization, content-type';
const CORS_MAX_AGE = '600';

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': CORS_ALLOW_ORIGIN,
  'access-control-allow-methods': CORS_ALLOW_METHODS,
  'access-control-allow-headers': CORS_ALLOW_HEADERS,
  'access-control-max-age': CORS_MAX_AGE,
};

function withCors(headers: Record<string, string>): Record<string, string> {
  return { ...headers, ...CORS_HEADERS };
}

/**
 * Download sentinel returned by the export-download handler. When the
 * dispatcher sees an object with `__download: true`, it ships the
 * body as raw bytes instead of wrapping it in the JSON envelope.
 */
interface DownloadSentinel {
  readonly __download: true;
  readonly contentType: string;
  readonly filename: string;
  readonly body: string;
}

function isDownloadSentinel(value: unknown): value is DownloadSentinel {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__download' in value &&
    (value as DownloadSentinel).__download === true
  );
}

/**
 * Normalise the incoming pathname to the form the router table
 * expects. The Supabase edge runtime delivers requests at
 * `/functions/v1/<function-name>/<actual-path>`, where `<actual-path>`
 * is our `/api/v1/...` route. Node/test harnesses craft
 * `new Request('http://x/api/v1/...')` directly. We want one router
 * table, so we strip any prefix up to and including `/api/v1/` here.
 *
 * Examples:
 *   `/functions/v1/api/api/v1/auth/nonce` -> `/api/v1/auth/nonce`
 *   `/api/v1/auth/nonce`                  -> `/api/v1/auth/nonce`
 *   `/anything-else`                      -> `/anything-else`
 */
function normalizePathname(raw: string): string {
  const marker = '/api/v1/';
  const idx = raw.indexOf(marker);
  if (idx >= 0) return raw.slice(idx);
  return raw;
}

/**
 * Error codes whose free-form `message` is safe to relay to the
 * client verbatim. Everything else — notably anything that can hold a
 * raw database error, stack trace, or internal invariant violation —
 * is replaced by a canned string so the API never leaks backend state
 * to a caller. BE-86.
 */
const SAFE_ERROR_CODES: ReadonlySet<string> = new Set([
  'INVALID_REQUEST',
  'INVALID_SIGNATURE',
  'INVALID_TX_HASH',
  'INVALID_REFERRAL',
  'INVALID_CONFIG_VALUE',
  'INVALID_CONFIG_SCOPE',
  'MIN_PURCHASE_NOT_MET',
  'CLAIM_MIN_AMOUNT_NOT_MET',
  'CLAIM_NOTHING_AVAILABLE',
  'SELF_REFERRAL_NOT_ALLOWED',
  'REFERRAL_CYCLE_NOT_ALLOWED',
  'UNAUTHORIZED',
  'NONCE_EXPIRED',
  'NONCE_ALREADY_USED',
  'SESSION_EXPIRED',
  'CLAIM_SIGNATURE_REQUIRED',
  'FORBIDDEN',
  'ADMIN_DISABLED',
  'PURCHASE_NOT_ALLOWED',
  'CLAIM_NOT_ALLOWED',
  'ADMIN_ROLE_REQUIRED',
  'RECOMPUTE_APPLY_FORBIDDEN',
  'USER_STATUS_RESTRICTED',
  'NOT_FOUND',
  'PURCHASE_NOT_FOUND',
  'CONFLICT',
  'PURCHASE_DUPLICATE',
  'PURCHASE_ALREADY_RECOVERED',
  'CLAIM_ALREADY_IN_PROGRESS',
  'REFERRAL_ALREADY_BOUND',
  'RATE_LIMITED',
  'CLAIM_BROADCAST_FAILED',
  'SERVICE_UNAVAILABLE',
]);

/**
 * BE-86: scrub the envelope's `message` for error codes whose
 * messages are NOT curated. The audit found raw Postgres exception
 * text bubbling out through 500 responses — that kind of byproduct
 * tells an attacker the database layout and sometimes column names.
 *
 * Mutates nothing; returns a new envelope with a sanitized message.
 */
function scrubEnvelope(envelope: HandlerResult<unknown>): HandlerResult<unknown> {
  if (envelope.success) return envelope;
  const code = envelope.error_code ?? 'INTERNAL_ERROR';
  if (SAFE_ERROR_CODES.has(code)) return envelope;
  return {
    ...envelope,
    message: 'an internal error occurred',
  };
}

function jsonErrorResponse(
  status: number,
  payload: HandlerResult<unknown>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: withCors(JSON_HEADERS),
  });
}

export async function handleApiRequest(request: Request): Promise<Response> {
  // BE-84: handle the CORS preflight before anything else — the
  // browser's OPTIONS probe doesn't carry a body and doesn't need
  // routing, but it MUST come back with the allow-headers set or
  // every actual request is blocked.
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  const url = new URL(request.url);

  // BE-83: cap the body BEFORE parsing. Reading `request.text()`
  // without a size guard means a 200 MiB POST will tie up the edge
  // worker for as long as it takes to buffer. We refuse anything
  // larger than the configured ceiling up front.
  let body: unknown = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentLengthHeader = request.headers.get('content-length');
    if (contentLengthHeader !== null) {
      const declared = Number.parseInt(contentLengthHeader, 10);
      if (!Number.isFinite(declared) || declared < 0) {
        return jsonErrorResponse(400, {
          success: false,
          data: null,
          error_code: 'INVALID_REQUEST',
          message: 'invalid content-length header',
          request_id: 'req_unknown',
        });
      }
      if (declared > MAX_REQUEST_BODY_BYTES) {
        return jsonErrorResponse(413, {
          success: false,
          data: null,
          error_code: 'INVALID_REQUEST',
          message: `request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes`,
          request_id: 'req_unknown',
        });
      }
    }
    const text = await request.text();
    if (text.length > MAX_REQUEST_BODY_BYTES) {
      return jsonErrorResponse(413, {
        success: false,
        data: null,
        error_code: 'INVALID_REQUEST',
        message: `request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes`,
        request_id: 'req_unknown',
      });
    }
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        return jsonErrorResponse(400, {
          success: false,
          data: null,
          error_code: 'INVALID_REQUEST',
          message: 'request body is not valid JSON',
          request_id: 'req_unknown',
        });
      }
    }
  }

  const routeReq: RouteRequest = {
    method: request.method,
    pathname: normalizePathname(url.pathname),
    query: url.searchParams,
    body,
    authorization: request.headers.get('authorization'),
  };

  const ctx = buildHandlerContext({
    ipAddress: request.headers.get('x-forwarded-for') ?? null,
    userAgent: request.headers.get('user-agent') ?? null,
  });

  const result = (await dispatchRoute(ctx, routeReq)) as unknown;

  // Download short-circuit: the export-download handler returns a
  // sentinel instead of the normal envelope so we can stream the
  // raw CSV with a file-name header. The dispatcher still wraps
  // errors in an envelope — those flow through the JSON branch.
  if (isDownloadSentinel(result)) {
    return new Response(result.body, {
      status: 200,
      headers: withCors({
        'content-type': result.contentType,
        'content-disposition': `attachment; filename="${result.filename}"`,
      }),
    });
  }

  const envelope = scrubEnvelope(result as HandlerResult<unknown>);
  const status = envelope.success ? 200 : inferErrorStatus(envelope.error_code);
  return new Response(JSON.stringify(envelope), {
    status,
    headers: withCors(JSON_HEADERS),
  });
}

function inferErrorStatus(code: string): number {
  switch (code) {
    case 'INVALID_REQUEST':
    case 'INVALID_SIGNATURE':
    case 'INVALID_TX_HASH':
    case 'MIN_PURCHASE_NOT_MET':
    case 'CLAIM_MIN_AMOUNT_NOT_MET':
    case 'CLAIM_NOTHING_AVAILABLE':
      return 400;
    case 'UNAUTHORIZED':
    case 'NONCE_EXPIRED':
    case 'NONCE_ALREADY_USED':
    case 'SESSION_EXPIRED':
      return 401;
    case 'FORBIDDEN':
    case 'ADMIN_DISABLED':
    case 'PURCHASE_NOT_ALLOWED':
    case 'CLAIM_NOT_ALLOWED':
    case 'ADMIN_ROLE_REQUIRED':
    case 'USER_STATUS_RESTRICTED':
      return 403;
    case 'NOT_FOUND':
    case 'PURCHASE_NOT_FOUND':
      return 404;
    case 'CONFLICT':
    case 'PURCHASE_DUPLICATE':
    case 'CLAIM_ALREADY_IN_PROGRESS':
      return 409;
    case 'RATE_LIMITED':
      return 429;
    case 'SERVICE_UNAVAILABLE':
      return 503;
    default:
      return 500;
  }
}
