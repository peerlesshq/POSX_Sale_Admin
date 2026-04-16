/**
 * Session token storage. Kept in localStorage so the wallet stays
 * logged in across refreshes. NEVER stored inside React state as
 * the source of truth — React state is a cache of localStorage.
 */
const KEY = 'posx.user.session';

export interface StoredSession {
  token: string;
  wallet: string;
  expiresAt: string;
  userStatus: string;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(KEY);
}
