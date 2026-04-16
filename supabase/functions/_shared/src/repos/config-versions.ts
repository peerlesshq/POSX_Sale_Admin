/**
 * `config_versions` repo — data access only.
 *
 * Resolution logic (picking the applicable version for a given
 * evaluation time and scope) lives in `@posx/config/config-resolver`.
 * This repo never makes such decisions — it only reads and writes
 * rows.
 */
import type {
  ApplyScope,
  ConfigGroup,
  ConfigVersionStatus,
  Uuid,
} from '@posx/shared-types';

import type { DbClient } from '../db';

export interface ConfigVersionRowRecord {
  id: Uuid;
  config_group: ConfigGroup;
  config_key: string;
  version_no: number;
  config_value: Record<string, unknown>;
  effective_from: string;
  apply_scope: ApplyScope;
  status: ConfigVersionStatus;
  description: string | null;
  created_by_admin_id: Uuid | null;
  created_at: string;
}

export interface ConfigVersionInsertInput {
  id?: Uuid;
  config_group: ConfigGroup;
  config_key: string;
  version_no: number;
  config_value: Record<string, unknown>;
  effective_from: string;
  apply_scope: ApplyScope;
  status?: ConfigVersionStatus;
  description?: string | null;
  created_by_admin_id?: Uuid | null;
}

export async function insertConfigVersion(
  db: DbClient,
  input: ConfigVersionInsertInput,
): Promise<ConfigVersionRowRecord> {
  return db.queryRequired<ConfigVersionRowRecord>(
    `insert into config_versions (
        id, config_group, config_key, version_no, config_value,
        effective_from, apply_scope, status, description, created_by_admin_id
      ) values (
        coalesce($1, gen_random_uuid()),
        $2, $3, $4, $5::jsonb, $6, $7,
        coalesce($8, 'active'), $9, $10
      )
      returning *`,
    [
      input.id ?? null,
      input.config_group,
      input.config_key,
      input.version_no,
      JSON.stringify(input.config_value),
      input.effective_from,
      input.apply_scope,
      input.status ?? null,
      input.description ?? null,
      input.created_by_admin_id ?? null,
    ],
  );
}

export async function listConfigVersionsForKey(
  db: DbClient,
  group: ConfigGroup,
  key: string,
): Promise<ConfigVersionRowRecord[]> {
  return db.query<ConfigVersionRowRecord>(
    `select * from config_versions
       where config_group = $1 and config_key = $2
       order by effective_from desc, version_no desc`,
    [group, key],
  );
}

export async function listAllActiveConfigVersions(
  db: DbClient,
): Promise<ConfigVersionRowRecord[]> {
  return db.query<ConfigVersionRowRecord>(
    `select * from config_versions
       where status in ('active','superseded')
       order by config_group, config_key, effective_from desc`,
  );
}
