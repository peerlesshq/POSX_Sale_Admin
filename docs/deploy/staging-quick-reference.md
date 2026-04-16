# POSX Staging 测试环境 — 快速参考手册

---

## 一、测试地址

| 服务 | 地址 |
|---|---|
| **管理后台** | https://dist-tau-beryl-74.vercel.app |
| **用户端** | https://dist-7idbud0ay-posx.vercel.app |
| **后端 API** | https://kzznfhtcevzysztzahzl.supabase.co/functions/v1/api/v1 |
| **Supabase 控制台** | https://supabase.com/dashboard/project/kzznfhtcevzysztzahzl |

---

## 二、管理后台账号

### Staging 测试账号

| 角色 | 邮箱 | 密码 | 状态 | 权限说明 |
|---|---|---|---|---|
| **超级管理员** | `superadmin@staging.local` | `Staging2025!!` | ✅ 正常 | 全部权限：创建管理员、修改配置、触发结算、封禁用户 |
| **运营** | `operator@staging.local` | `Staging2025!!` | ✅ 正常 | 日常运营：触发结算、导出报表、修改用户状态（不能封禁） |
| **只读** | `viewer@staging.local` | `Staging2025!!` | ✅ 正常 | 仅查看：所有页面可看，操作按钮不可见 |
| **已禁用** | `disabled@staging.local` | `Staging2025!!` | ❌ 已禁用 | 登录会被拒绝（测试禁用账号场景） |

### 角色权限对照表

| 功能 | 超级管理员 | 运营 | 只读 |
|---|---|---|---|
| 查看仪表盘 | ✅ | ✅ | ✅ |
| 查看用户列表 | ✅ | ✅ | ✅ |
| 查看奖励数据 | ✅ | ✅ | ✅ |
| 查看结算任务 | ✅ | ✅ | ✅ |
| 查看系统状态 | ✅ | ✅ | ✅ |
| 查看审计日志 | ✅ | ✅ | ✅ |
| 触发结算 | ✅ | ✅ | ❌ |
| 导出报表 | ✅ | ✅ | ❌ |
| 修改用户状态 | ✅ | ✅ | ❌ |
| 封禁/黑名单用户 | ✅ | ❌ | ❌ |
| 创建/修改配置 | ✅ | ✅ | ❌ |
| 创建管理员账号 | ✅ | ❌ | ❌ |
| 修改管理员角色 | ✅ | ❌ | ❌ |
| 禁用管理员账号 | ✅ | ❌ | ❌ |
| 轮转管理员会话 | ✅ | ❌ | ❌ |
| 执行重算(Recompute) | ✅ | ❌ | ❌ |

---

## 三、用户端测试

### 登录方式

用户端使用**钱包签名登录**（MetaMask 等），没有邮箱密码。

### 测试数据（数据库中已有的用户）

| 编号 | 场景 | 钱包地址 | 存款金额 | 状态 |
|---|---|---|---|---|
| 01 | 普通用户 | `0x0...ff001` | 10,000 USDT | active |
| 02 | 大户（精英级） | `0x0...ff002` | 300,000 USDT | active |
| 03 | 无奖励用户 | `0x0...ff003` | 2,000 USDT | active |
| 04 | 被暂停 | `0x0...ff004` | 5,000 USDT | suspended |
| 05 | 被黑名单 | `0x0...ff005` | 3,000 USDT | blacklisted |
| 06 | 购买受限 | `0x0...ff006` | 8,000 USDT | restricted_purchase |
| 07 | 领取受限 | `0x0...ff007` | 15,000 USDT | restricted_claim |
| 08 | 待确认购买 | `0x0...ff008` | 0（订单待确认） | active |
| 09 | 已确认购买 | `0x0...ff009` | 50,000 USDT | active |
| 10 | 购买失败 | `0x0...ff010` | 0（订单失败） | active |
| 11 | 待领取 | `0x0...ff011` | 8,000 USDT | active |
| 12 | 领取失败 | `0x0...ff012` | 25,000 USDT | active |
| 13 | 领取完成 | `0x0...ff013` | 30,000 USDT | active |
| 14 | 团队长（5+下级） | `0x0...ff014` | 100,000 USDT | active |
| 15 | 无上级（根节点） | `0x0...ff015` | 40,000 USDT | active |
| 16 | 新注册用户 | `0x0...ff016` | 0 | active |
| 17 | 巨鲸用户 | `0x0...ff017` | 500,000 USDT | active |
| 18 | 被烧毁奖励 | `0x0...ff018` | 25,000 USDT | active |
| 19 | 部分释放锁仓 | `0x0...ff019` | 250,000 USDT | active |
| 20 | 多笔购买 | `0x0...ff020` | 120,000 USDT | active |

---

## 四、生产环境

### 状态

| 项目 | 状态 |
|---|---|
| 生产 Supabase 项目 | ❌ 未创建 |
| 生产管理员账号 | ❌ 未创建 |
| 生产前端部署 | ❌ 未部署 |
| 真实链上领取 | ❌ 已安全锁定（ProductionGateClaimBroadcaster） |

### 生产上线前需要完成

1. 创建独立的生产 Supabase 项目
2. 创建生产管理员账号（不复用测试账号）
3. 实现真实链上领取广播器
4. 部署生产前端到正式域名
5. 配置生产环境变量和密钥

---

## 五、环境标识

| 环境 | 管理后台标识 | 用户端标识 | 颜色 |
|---|---|---|---|
| **LOCAL** | 顶栏 + 侧栏 "LOCAL" 标签 | 头部 "LOCAL" 标签 | 🔵 蓝色 |
| **STAGING** | 顶栏 + 侧栏 "STAGING" 标签 | 头部 "STAGING" 标签 | 🟡 黄色 |
| **PRODUCTION** | 无标签 | 无标签 | — |

---

## 六、常用操作

### 管理后台测试流程

1. 打开 https://dist-tau-beryl-74.vercel.app/login
2. 输入超级管理员账号登录
3. 确认顶栏显示黄色 "STAGING" 标签
4. 测试各页面：仪表盘 → 用户 → 奖励 → 结算 → 配置 → 系统

### 重置测试数据

```bash
APP_ENV=staging pnpm seed:staging    # 重新填充测试数据
APP_ENV=staging pnpm reset:staging   # 完全重置（删表+重建+填充）
```

### 重新部署后端

```bash
pnpm bundle:edge                     # 打包 Edge Function
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy api --project-ref kzznfhtcevzysztzahzl --no-verify-jwt
pnpm restore:edge                    # 恢复源码
```

---

## 七、安全说明

- ⚠️ 测试环境账号密码仅用于 staging，**切勿用于生产**
- ⚠️ `@staging.local` 邮箱域名不可路由，无法收发真实邮件
- ✅ 链上领取已被安全锁定，staging 不会产生任何真实交易
- ✅ staging 和生产使用完全独立的 Supabase 项目、数据库和密钥
- ✅ staging 环境不会发送邮件、webhook 或触发任何外部副作用
