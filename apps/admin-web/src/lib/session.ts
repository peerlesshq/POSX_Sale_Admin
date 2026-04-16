const KEY = 'posx.admin.session';

export interface StoredAdminSession {
  token: string;
  adminUserId: string;
  role: 'super_admin' | 'operator' | 'viewer';
  name: string;
  expiresAt: string;
}

export function loadSession(): StoredAdminSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAdminSession;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredAdminSession): void {
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(KEY);
}
