# Admin-web Terminology Glossary

Standard terms for `apps/admin-web`. All contributors and translators should
follow this glossary to keep locale files consistent.

## Navigation and pages

| English | Chinese (zh-CN) | Locale key(s) |
|---|---|---|
| Dashboard | 仪表盘 | `nav.dashboard` |
| Users | 用户管理 | `nav.users` |
| Agent Network | 代理网络 | `nav.network` |
| Rewards | 奖金 | `nav.rewards` |
| Config | 参数配置 | `nav.config` |
| Reports | 报表 | `nav.reports` |
| Settlement | 结算任务 | `nav.settlement` |
| Recompute | 重算 | `nav.recompute` |
| Audit Logs | 审计日志 | `nav.logs` |
| Admin Accounts | 管理员账号 | `nav.admin_accounts` |
| Team Ranking | 团队排行 | `nav.team_ranking` |
| System | 系统 | `nav.system` |
| Chain Sync | 链上同步 | `nav.system.chain_sync` |

## Roles

| English | Chinese | Locale key |
|---|---|---|
| Super admin | 超级管理员 | `role.super_admin` |
| Operator | 运营 | `role.operator` |
| Viewer | 只读 | `role.viewer` |

## Reward types

| English | Chinese | Locale key(s) |
|---|---|---|
| Direct reward | 直推奖 | `nav.rewards.direct` |
| Team reward | 团队奖 | `nav.rewards.team` |
| Equal-level reward | 平级奖 | `nav.rewards.equal_level` |
| Burn | 销毁 | `nav.rewards.burns` |

## Settlement and operations

| English | Chinese | Context |
|---|---|---|
| Settlement | 结算 | Daily reward settlement job |
| Recompute | 重算 | Recalculation of a past day |
| Backfill | 补算 | Re-run for a missed date |
| Claim | 领取 | Token claim / withdrawal |
| Vesting | 锁仓释放 | Token lock-up release schedule |
| Export | 导出 | Data export job |

## User and account status

| English | Chinese | Locale key |
|---|---|---|
| Active | 正常 | `status.active` |
| Restricted purchase | 限制购买 | `status.restricted_purchase` |
| Restricted claim | 限制领取 | `status.restricted_claim` |
| Suspended | 暂停 | `status.suspended` |
| Blacklisted | 已拉黑 | `status.blacklisted` |
| Disabled | 已禁用 | `status.disabled` |

## Tiers

| English | Chinese | Locale key |
|---|---|---|
| Elite | 精英 | `tier.elite` |
| Advanced | 高级 | `tier.advanced` |
| Basic | 基础 | `tier.basic` |
| Unranked | 未评级 | `tier.none` |

## System and monitoring

| English | Chinese | Context |
|---|---|---|
| Healthy | 正常 | Health check green |
| Watching | 关注中 | Warning threshold |
| Degraded | 降级 | Critical threshold |
| Job | 任务 | Backend job run |
| Lag | 延迟 | Chain indexer lag |

## Common UI

| English | Chinese | Locale key |
|---|---|---|
| Save | 保存 | `common.save` |
| Cancel | 取消 | `common.cancel` |
| Confirm | 确认 | `common.confirm` |
| Loading | 加载中… | `common.loading` |
| Retry | 重试 | `common.retry` |
| Search | 搜索 | `common.search` |
| Filter | 筛选 | `common.filter` |
| Export | 导出 | `common.export` |
| Peer | 平级节点 | `network.team.peer` |
