/**
 * Role-based action visibility hook.
 *
 * Every destructive admin action (create, update, disable, trigger,
 * apply) should be gated by `canMutate` so a viewer-role admin sees
 * the data but cannot accidentally (or intentionally) reach the
 * mutation buttons.
 *
 * Usage:
 *   const { role, canMutate } = useAdminRole();
 *   {canMutate && <Button onClick={...}>Trigger settlement</Button>}
 */
import { loadSession, type StoredAdminSession } from './session';

export type AdminRole = StoredAdminSession['role'];

export function useAdminRole(): {
  role: AdminRole;
  canMutate: boolean;
  isSuperAdmin: boolean;
} {
  const session = loadSession();
  const role: AdminRole = session?.role ?? 'viewer';
  return {
    role,
    canMutate: role === 'super_admin' || role === 'operator',
    isSuperAdmin: role === 'super_admin',
  };
}
