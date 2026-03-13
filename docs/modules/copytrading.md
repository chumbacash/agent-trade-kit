# copytrading module

[English](#english) | [中文](#中文)

---

## English

The `copytrading` module provides tools to browse lead traders, follow/unfollow them, and monitor your copy trading status.

> **Not loaded by default.** Enable with `--modules copytrading` or `--modules all`.

### Enabling the Module

**MCP (Claude / AI clients)**

Add `copytrading` to your module list:

```json
{
  "mcpServers": {
    "okx-trade": {
      "command": "npx",
      "args": ["-y", "@okx_ai/okx-trade-mcp", "--modules", "copytrading,spot,swap,account"]
    }
  }
}
```

**CLI**

```bash
okx --modules copytrading copytrading traders
```

### MCP Tools

| Tool | Description | Auth |
|------|-------------|------|
| `copytrading_get_lead_traders` | List top lead traders by ranking with filters | Public |
| `copytrading_get_trader_details` | Full trader profile: P&L, stats, currency preference | Public |
| `copytrading_get_my_details` | My currently followed lead traders and their cumulative P&L | Private |
| `copytrading_set_copytrading` | Follow a lead trader and configure copy mode, amount, TP/SL, and margin settings | Private ⚠️ |
| `copytrading_stop_copy_trader` | Unfollow a lead trader and specify how to handle existing open positions | Private ⚠️ |

⚠️ Write operations — use with caution.

### Key Parameters

| Parameter | Description |
|-----------|-------------|
| `uniqueCode` | 16-character lead trader unique code |
| `instType` | Only `SWAP` is supported. Spot copy trading is not available. |
| `lastDays` | Time range: `1`=7d, `2`=30d (default), `3`=90d, `4`=365d |
| `copyTotalAmt` | Max total USDT to allocate for a trader |
| `copyMode` | `fixed_amount` (fixed amount per order, default) or `ratio_copy` (fixed ratio) |
| `copyAmt` | Fixed USDT per order (required for `fixed_amount` mode) |
| `copyRatio` | Copy ratio, e.g. `0.1` = 10% (required for `ratio_copy` mode) |
| `copyMgnMode` | Margin mode: `isolated` (default), `cross`, `copy` (follow trader) |
| `subPosCloseType` | On stop: `copy_close` (default), `market_close`, `manual_close` |

### CLI Quick Reference

```bash
# List traders
okx copytrading traders [--limit <n>]

# My copy status
okx copytrading status

# Follow a trader (fixed_amount mode — --copyAmt required)
okx copytrading follow --uniqueCode <code> --copyTotalAmt <n> --copyAmt <n>

# Unfollow
okx copytrading unfollow --uniqueCode <code>

# Trader detail
okx copytrading trader-detail --uniqueCode <code> [--lastDays 1|2|3|4]
```

---

## 中文

`copytrading` 模块提供浏览带单员、跟随/取消跟随交易员、查看跟单状态的工具。

> **默认不加载。** 使用 `--modules copytrading` 或 `--modules all` 启用。

### 启用模块

**MCP（Claude / AI 客户端）**

在模块列表中加入 `copytrading`：

```json
{
  "mcpServers": {
    "okx-trade": {
      "command": "npx",
      "args": ["-y", "@okx_ai/okx-trade-mcp", "--modules", "copytrading,spot,swap,account"]
    }
  }
}
```

**CLI**

```bash
okx --modules copytrading copytrading traders
```

### MCP 工具列表

| 工具 | 描述 | 认证 |
|------|------|------|
| `copytrading_get_lead_traders` | 按排行获取带单员列表（支持多维筛选） | 公开 |
| `copytrading_get_trader_details` | 带单员完整档案：盈亏、统计、偏好币种 | 公开 |
| `copytrading_get_my_details` | 我当前跟随的带单员列表及各自累计盈亏 | 私有 |
| `copytrading_set_copytrading` | 跟随带单员并配置跟单模式、金额、止盈止损及保证金设置 | 私有 ⚠️ |
| `copytrading_stop_copy_trader` | 取消跟随带单员，并指定现有持仓的处理方式 | 私有 ⚠️ |

⚠️ 写操作 — 请谨慎使用，会使用真实资金。

### 关键参数说明

| 参数 | 描述 |
|------|------|
| `uniqueCode` | 带单员的 16 位唯一标识码 |
| `instType` | 仅支持 `SWAP`（永续合约），不支持现货 |
| `lastDays` | 时间范围：`1`=7天，`2`=30天（默认），`3`=90天，`4`=365天 |
| `copyTotalAmt` | 为该带单员分配的最大 USDT 总额 |
| `copyMode` | `fixed_amount`（固定金额跟单，默认）或 `ratio_copy`（固定比例跟单） |
| `copyAmt` | 每单固定 USDT 金额（`fixed_amount` 模式必填） |
| `copyRatio` | 跟单比例，如 `0.1` = 10%（`ratio_copy` 模式必填） |
| `copyMgnMode` | 保证金模式：`isolated` 逐仓（默认）、`cross` 全仓、`copy` 跟随带单员 |
| `subPosCloseType` | 停止跟单时处理方式：`copy_close`（默认）、`market_close`、`manual_close` |

### CLI 快速参考

```bash
# 查看带单员排行
okx copytrading traders [--limit <n>]

# 查看我的跟单状态
okx copytrading status

# 开始跟单（固定金额模式 — --copyAmt 必填）
okx copytrading follow --uniqueCode <code> --copyTotalAmt <n> --copyAmt <n>

# 停止跟单
okx copytrading unfollow --uniqueCode <code>

# 查看带单员详情
okx copytrading trader-detail --uniqueCode <code> [--lastDays 1|2|3|4]
```
