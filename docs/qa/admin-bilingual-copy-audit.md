# Admin Bilingual Copy Audit

Coverage: `apps/admin-web/src/i18n/en.json` and `zh-CN.json` (~938 keys each).

---

## Key coverage

**1:1 match** — every key in EN exists in ZH and vice versa.

**Bug**: `nav.system` is duplicated (appears twice in both files). JSON last-value-wins means the first definition is silently lost.

---

## EN quality issues

### Capitalization inconsistency (P2)

~30 keys mix Title Case and sentence case with no discernible rule:

**Title Case** (19 keys): `dashboard.title` ("Operations Dashboard"), `rewards.overview.title` ("Rewards Overview"), `system.health.title` ("System Health"), etc.

**Sentence case** (17 keys): `system.overview.title` ("System overview"), `users.detail.title` ("User profile"), `users.tree.title` ("Referral tree"), etc.

**Column headers** are similarly mixed: `rewards.col.date` ("Settle Date") vs `users.col.team_size` ("Team size").

**Recommendation**: sentence case for all labels. Title Case only for proper nouns (POSX, USDT).

### Button labels that are nouns, not verbs (P3)

| Key | Current | Suggested |
|---|---|---|
| `users.action.tree` | "Agent network" | "View agent network" |
| `users.action.rewards` | "Reward detail" | "View rewards" |
| `users.action.audit` | "Audit records" | "View audit records" |

### Weak error messages (P2)

| Key | Current | Suggested |
|---|---|---|
| `auth.login_failed` | "Login failed" | "Login failed. Check your email and password." |
| `search.error` | "Search failed" | "Search failed. Try a different query or refresh." |
| `error.subtitle` | "Check network or retry" | "Please check your network connection and try again." |
| `common.failed` | "Failed" | Should never be shown alone — always paired with context |

### Placeholder patterns

All use `{variable}` consistently. No `${name}` or `%s` patterns. `tp()` handler works correctly.

---

## ZH quality issues

### Untranslated English words (P1 — 5 pure-ASCII values)

| Key | ZH value | Should be |
|---|---|---|
| `search.group.claim` | "Claim" | "领取" |
| `users.detail.tab.vesting` | "Vesting" | "锁仓释放" |
| `users.vesting.lots` | "Vesting lots" | "锁仓批次" |
| `users.vesting.col.lot_id` | "Lot ID" | "批次编号" |
| `app.short_name` | "POSX Admin" | Acceptable (brand name) |

### English fragments in Chinese strings (P1 — ~15 keys)

| Key | Issue | Fix |
|---|---|---|
| `users.rewards.table_hint` | "打开 drill drawer" | → "打开明细面板" |
| `search.placeholder` | "Claim ... Hash ... Config" | → "领取 ... 哈希 ... 配置" |
| `search.empty_subtitle` | "配置 key" | → "配置键" |
| `dashboard.pending_claims` | "待处理 Claim" | → "待处理领取" |
| `recompute.description` | "claim 过的历史数据" | → "领取过的历史数据" |
| `config.create.viewer_blocked` | "角色为 Viewer" | → "角色为只读" |
| `network.team.view.top` | "仅 Top 节点" | → "仅顶级节点" |
| `network.team.kpi.roots` | "顶层 Leader" | → "顶层团长" |
| `network.team.kpi.top_volume` | "Top Leader 业绩" | → "顶级团长业绩" |
| `reports.chart.tier_dist_hint` | "Basic / Advanced / Elite" | → "基础 / 进阶 / 精英" |
| `users.qualification.team_tip` | "advanced / elite" | → "进阶 / 精英" |
| 5 × "Top 10" labels | "Top 10" | → "前十" (more natural) |

---

## Hardcoded strings in source files (P0 — bypasses i18n entirely)

These display English text even when the user has selected zh-CN:

| File | Line | Hardcoded string | Fix |
|---|---|---|---|
| `UserQualificationCard.tsx` | ~87 | `"Eligible"` / `"Not eligible"` | Use `t('qualification.eligible')` |
| `shared/filterFields.tsx` | ~164-166 | `'Basic'`, `'Advanced'`, `'Elite'` tier labels | Use `t('tier.basic')` etc. |
| `shared/RowActionMenu.tsx` | ~76 | `label = 'Actions'` default prop | Use `t('common.actions')` |

---

## Duplicate key bug

`nav.system` appears at two positions in both `en.json` and `zh-CN.json`. JSON parsers use last-value-wins, so the first definition is silently overwritten. If the two values differ, the wrong one is active. Fix: remove the duplicate entry.

---

## Summary

| Priority | Category | Count |
|---|---|---|
| **P0** | Hardcoded English strings in `.tsx` (visible to zh-CN users) | 3 locations |
| **P0** | Duplicate `nav.system` key | Both files |
| **P1** | Untranslated English in ZH values | ~20 keys |
| **P2** | Inconsistent capitalization in EN | ~30 keys |
| **P2** | Weak error messages | ~5 keys |
| **P3** | Noun-based button labels | ~3 keys |
