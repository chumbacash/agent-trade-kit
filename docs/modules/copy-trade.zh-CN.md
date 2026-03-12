[English](./copy-trade.md) | [中文](./copy-trade.zh-CN.md)

# copy-trade — 跟单交易模块

`copytrading` 模块提供浏览带单员、跟随/取消跟随交易员、查看跟单状态的工具。

> **默认不加载。** 使用 `--modules copytrading` 或在配置文件中启用。

---

## 启用模块

### MCP（Claude / AI 客户端）

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

### CLI

```bash
okx --modules copytrading copy-trade traders
```

---

## MCP 工具列表

| 工具 | 描述 | 认证 |
|------|------|------|
| `copytrading_public_lead_traders` | 按排行获取带单员列表（支持多维筛选） | 公开 |
| `copytrading_public_trader_detail` | 带单员完整档案：盈亏、统计、偏好币种 | 公开 |
| `copytrading_my_status` | 我当前跟随的带单员列表及各自累计盈亏 | 私有 |
| `copytrading_set_copy_trading` | 开始跟单某位带单员 | 私有 ⚠️ |
| `copytrading_stop_copy_trader` | 停止跟单某位带单员 | 私有 ⚠️ |

⚠️ 写操作 — 请谨慎使用，会使用真实资金。

---

## 关键参数说明

| 参数 | 描述 |
|------|------|
| `uniqueCode` | 带单员的 16 位唯一标识码 |
| `instType` | `SWAP`（默认）或 `SPOT` |
| `lastDays` | 时间范围：`1`=7天，`2`=30天（默认），`3`=90天，`4`=365天 |
| `copyTotalAmt` | 为该带单员分配的最大 USDT 总额 |
| `copyMode` | `fixed_amount`（固定金额，默认）或 `ratio_copy`（比例跟单） |
| `copyAmt` | 每单固定 USDT 金额（`fixed_amount` 模式） |
| `copyRatio` | 跟单比例（`ratio_copy` 模式） |
| `subPosCloseType` | 停止跟单时处理方式：`copy_close`（默认）、`market_close`、`manual_close` |

---

## CLI 快速参考

```bash
# 查看带单员排行
okx copy-trade traders [--instType SPOT|SWAP] [--limit <n>]

# 查看我的跟单状态
okx copy-trade status [--instType SPOT|SWAP]

# 开始跟单
okx copy-trade follow --uniqueCode <code> --fixedAmt <n>

# 停止跟单
okx copy-trade unfollow --uniqueCode <code>

# 查看带单员详情
okx copy-trade trader-detail --uniqueCode <code> [--lastDays 1|2|3|4]
```
