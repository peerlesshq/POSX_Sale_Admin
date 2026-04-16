import { loadEnv } from '../env';
import { clearSession, loadSession } from '../lib/session';

export class PosxApiError extends Error {
  constructor(public readonly errorCode: string, message: string, public readonly status: number) {
    super(message);
    this.name = 'PosxApiError';
  }
}

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error_code: string | null;
  message: string | null;
  request_id: string;
}

interface Options<B> {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: B;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
}

function buildUrl(path: string, query?: Options<unknown>['query']): string {
  const base = loadEnv().apiBaseUrl.replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiRequest<T, B = unknown>(options: Options<B>): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.auth !== false) {
    const session = loadSession();
    if (session) headers['authorization'] = `Bearer ${session.token}`;
  }
  const res = await fetch(buildUrl(options.path, options.query), {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const envelope = (await res.json()) as Envelope<T>;
  if (!envelope.success || envelope.data === null) {
    if (envelope.error_code === 'UNAUTHORIZED' || envelope.error_code === 'SESSION_EXPIRED') {
      clearSession();
    }
    throw new PosxApiError(
      envelope.error_code ?? 'INTERNAL_ERROR',
      envelope.message ?? 'request failed',
      res.status,
    );
  }
  return envelope.data;
}
