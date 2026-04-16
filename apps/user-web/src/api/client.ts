/**
 * API client — fetch wrapper that speaks the POSX envelope.
 */
import type { ErrorCode } from '@posx/shared-types';

import { loadEnv } from '../env';
import { clearSession, loadSession } from '../lib/session';

export interface ApiError extends Error {
  readonly errorCode: ErrorCode;
  readonly status: number;
  readonly requestId: string | null;
}

export class PosxApiError extends Error implements ApiError {
  readonly errorCode: ErrorCode;
  readonly status: number;
  readonly requestId: string | null;

  constructor(
    errorCode: ErrorCode,
    message: string,
    status: number,
    requestId: string | null,
  ) {
    super(message);
    this.name = 'PosxApiError';
    this.errorCode = errorCode;
    this.status = status;
    this.requestId = requestId;
  }
}

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error_code: ErrorCode | null;
  message: string | null;
  request_id: string;
}

export interface ApiRequestOptions<B> {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: B;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
}

function buildUrl(path: string, query?: ApiRequestOptions<unknown>['query']): string {
  const env = loadEnv();
  const base = env.apiBaseUrl.replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiRequest<T, B = unknown>(
  options: ApiRequestOptions<B>,
): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (options.auth !== false) {
    const session = loadSession();
    if (session) {
      headers['authorization'] = `Bearer ${session.token}`;
    }
  }

  const response = await fetch(buildUrl(options.path, options.query), {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  let envelope: Envelope<T>;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    throw new PosxApiError(
      'INTERNAL_ERROR',
      'invalid response from server',
      response.status,
      null,
    );
  }

  if (!envelope.success || envelope.data === null) {
    if (envelope.error_code === 'UNAUTHORIZED' || envelope.error_code === 'SESSION_EXPIRED') {
      clearSession();
    }
    throw new PosxApiError(
      (envelope.error_code ?? 'INTERNAL_ERROR') as ErrorCode,
      envelope.message ?? 'request failed',
      response.status,
      envelope.request_id ?? null,
    );
  }
  return envelope.data;
}
