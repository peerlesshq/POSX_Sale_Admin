/**
 * In-memory `ConfigResolver` implementation.
 *
 * Used by:
 *   - seed scripts that need to run domain-rules calculations without
 *     a live DB fetch
 *   - unit + integration tests
 *
 * The production Supabase-backed resolver lands in Phase 4 alongside
 * the repository layer.
 */
import { selectMostRecentApplicable } from './scope';
import type {
  ConfigResolveInput,
  ConfigResolveResult,
  ConfigResolver,
  ConfigVersionRow,
} from './types';

export class InMemoryConfigResolver implements ConfigResolver {
  private readonly rowsByKey = new Map<string, ConfigVersionRow[]>();

  constructor(rows: ReadonlyArray<ConfigVersionRow>) {
    for (const row of rows) {
      const key = keyOf(row.config_group, row.config_key);
      const list = this.rowsByKey.get(key);
      if (list) {
        list.push(row);
      } else {
        this.rowsByKey.set(key, [row]);
      }
    }
  }

  async resolve(input: ConfigResolveInput): Promise<ConfigVersionRow | null> {
    const candidates = this.rowsByKey.get(keyOf(input.group, input.key)) ?? [];
    return selectMostRecentApplicable(candidates, input.context);
  }

  async resolveMany(
    inputs: ReadonlyArray<ConfigResolveInput>,
  ): Promise<ReadonlyArray<ConfigResolveResult>> {
    const out: ConfigResolveResult[] = [];
    for (const input of inputs) {
      out.push({ input, version: await this.resolve(input) });
    }
    return out;
  }
}

function keyOf(group: string, key: string): string {
  return `${group}::${key}`;
}
