/**
 * `content_entries` + `config_change_history` repos — data access only.
 */
import type { ApplyScope, ContentStatus, Uuid } from '@posx/shared-types';

import type { DbClient } from '../db';

// ---------- content_entries ----------

export interface ContentEntryRow {
  id: Uuid;
  content_group: string;
  content_key: string;
  content_value: Record<string, unknown>;
  status: ContentStatus;
  effective_from: string | null;
  created_by_admin_id: Uuid | null;
  created_at: string;
  updated_at: string;
}

export async function upsertContentEntry(
  db: DbClient,
  input: {
    content_group: string;
    content_key: string;
    content_value: Record<string, unknown>;
    status?: ContentStatus;
    effective_from?: string | null;
    created_by_admin_id?: Uuid | null;
  },
): Promise<ContentEntryRow> {
  return db.queryRequired<ContentEntryRow>(
    `insert into content_entries (
        content_group, content_key, content_value, status,
        effective_from, created_by_admin_id
      ) values ($1, $2, $3::jsonb, coalesce($4, 'active'), $5, $6)
      on conflict (content_group, content_key) do update
        set content_value       = excluded.content_value,
            status              = excluded.status,
            effective_from      = excluded.effective_from,
            created_by_admin_id = coalesce(excluded.created_by_admin_id, content_entries.created_by_admin_id)
      returning *`,
    [
      input.content_group,
      input.content_key,
      JSON.stringify(input.content_value),
      input.status ?? null,
      input.effective_from ?? null,
      input.created_by_admin_id ?? null,
    ],
  );
}

export async function listActiveContentEntries(
  db: DbClient,
): Promise<ContentEntryRow[]> {
  return db.query<ContentEntryRow>(
    `select * from content_entries where status = 'active'
      order by content_group, content_key`,
  );
}

// ---------- config_change_history ----------

export interface ConfigChangeHistoryInsertInput {
  config_version_id: Uuid;
  config_group: string;
  config_key: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown>;
  effective_from: string;
  apply_scope: ApplyScope;
  changed_by_admin_id?: Uuid | null;
  change_note?: string | null;
}

export async function insertConfigChangeHistory(
  db: DbClient,
  input: ConfigChangeHistoryInsertInput,
): Promise<void> {
  await db.query(
    `insert into config_change_history (
        config_version_id, config_group, config_key,
        old_value, new_value, effective_from, apply_scope,
        changed_by_admin_id, change_note
      ) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)`,
    [
      input.config_version_id,
      input.config_group,
      input.config_key,
      input.old_value ? JSON.stringify(input.old_value) : null,
      JSON.stringify(input.new_value),
      input.effective_from,
      input.apply_scope,
      input.changed_by_admin_id ?? null,
      input.change_note ?? null,
    ],
  );
}
