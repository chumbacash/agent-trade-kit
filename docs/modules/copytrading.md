# copytrading module

[English](#english) | [中文](#中文)

---

## English

The `copytrading` module is available via **CLI only**. It is not exposed as MCP tools.

### CLI Quick Reference

```bash
# List traders
okx copytrading traders [--limit <n>]

# My copy status
okx copytrading status

# Follow a trader — smart_copy mode (default)
okx copytrading follow --uniqueCode <code> --copyMode smart_copy --initialAmount <n> --replicationRequired <0|1>

# Follow a trader — fixed_amount mode
okx copytrading follow --uniqueCode <code> --copyMode fixed_amount --copyTotalAmt <n> --copyAmt <n>

# Follow a trader — ratio_copy mode
okx copytrading follow --uniqueCode <code> --copyMode ratio_copy --copyTotalAmt <n> --copyRatio <n>

# Follow a trader — custom instruments only
okx copytrading follow --uniqueCode <code> --initialAmount <n> --replicationRequired <0|1> --copyInstIdType custom --instId BTC-USDT-SWAP,ETH-USDT-SWAP

# Follow a trader — with TP/SL
okx copytrading follow --uniqueCode <code> --initialAmount <n> --replicationRequired <0|1> --tpRatio 0.1 --slRatio 0.05 --slTotalAmt 200

# Unfollow
okx copytrading unfollow --uniqueCode <code>

# Trader detail
okx copytrading trader-detail --uniqueCode <code> [--lastDays 1|2|3|4]
```

### Key Parameters

| Parameter | Description |
|-----------|-------------|
| `uniqueCode` | 16-character lead trader unique code |
| `instType` | `SWAP` (default) or `SPOT`. |
| `lastDays` | Time range: `1`=7d, `2`=30d (default), `3`=90d, `4`=365d |
| `copyTotalAmt` | Max total USDT to allocate for a trader (required for `fixed_amount`/`ratio_copy` mode; auto-set from `initialAmount` for `smart_copy`) |
| `copyMode` | `smart_copy` (default), `fixed_amount` (fixed amount per order), or `ratio_copy` (fixed ratio) |
| `initialAmount` | Initial investment amount in USDT (required for `smart_copy` mode) |
| `replicationRequired` | Whether to replicate existing positions: `0`=no, `1`=yes (required for `smart_copy` mode) |
| `copyAmt` | Fixed USDT per order (required for `fixed_amount` mode) |
| `copyRatio` | Copy ratio, e.g. `0.1` = 10% (required for `ratio_copy` mode) |
| `copyMgnMode` | Margin mode (non-`smart_copy` only): `copy` follow trader (default), `isolated`, `cross`. For `smart_copy`: auto-set by `instType` (SWAP→`copy`, SPOT→`isolated`), user input ignored. |
| `copyInstIdType` | Instrument selection: `copy` (follow trader, default), `custom` (user-defined) |
| `instId` | Comma-separated instrument IDs (required when `copyInstIdType=custom`) |
| `subPosCloseType` | On stop: `copy_close` (default), `market_close`, `manual_close` |
| `tpRatio` | Take-profit ratio per order, e.g. `0.1` = 10% (optional) |
| `slRatio` | Stop-loss ratio per order, e.g. `0.1` = 10% (optional) |
| `slTotalAmt` | Total stop-loss amount in USDT — auto-stops copy when net loss reaches this amount (optional) |

---

## 中文

`copytrading` 模块**仅支持 CLI 方式**，不作为 MCP 工具暴露。

### CLI 快速参考

```bash
# 查看带单员排行
okx copytrading traders [--limit <n>]

# 查看我的跟单状态
okx copytrading status

# 开始跟单 — 智能跟单模式（默认）
okx copytrading follow --uniqueCode <code> --copyMode smart_copy --initialAmount <n> --replicationRequired <0|1>

# 开始跟单 — 固定金额模式
okx copytrading follow --uniqueCode <code> --copyMode fixed_amount --copyTotalAmt <n> --copyAmt <n>

# 开始跟单 — 固定比例模式
okx copytrading follow --uniqueCode <code> --copyMode ratio_copy --copyTotalAmt <n> --copyRatio <n>

# 开始跟单 — 自定义品种
okx copytrading follow --uniqueCode <code> --initialAmount <n> --replicationRequired <0|1> --copyInstIdType custom --instId BTC-USDT-SWAP,ETH-USDT-SWAP

# 开始跟单 — 设置止盈止损
okx copytrading follow --uniqueCode <code> --initialAmount <n> --replicationRequired <0|1> --tpRatio 0.1 --slRatio 0.05 --slTotalAmt 200

# 停止跟单
okx copytrading unfollow --uniqueCode <code>

# 查看带单员详情
okx copytrading trader-detail --uniqueCode <code> [--lastDays 1|2|3|4]
```

### 关键参数说明

| 参数 | 描述 |
|------|------|
| `uniqueCode` | 带单员的 16 位唯一标识码 |
| `instType` | `SWAP`（默认）或 `SPOT` |
| `lastDays` | 时间范围：`1`=7天，`2`=30天（默认），`3`=90天，`4`=365天 |
| `copyTotalAmt` | 为该带单员分配的最大 USDT 总额（`fixed_amount`/`ratio_copy` 模式必填；`smart_copy` 模式自动从 `initialAmount` 赋值） |
| `copyMode` | `smart_copy`（智能跟单，默认）、`fixed_amount`（固定金额跟单）或 `ratio_copy`（固定比例跟单） |
| `initialAmount` | 跟单初始投入金额（USDT），`smart_copy` 模式必填 |
| `replicationRequired` | 是否复制当前持仓：`0`=否，`1`=是（`smart_copy` 模式必填） |
| `copyAmt` | 每单固定 USDT 金额（`fixed_amount` 模式必填） |
| `copyRatio` | 跟单比例，如 `0.1` = 10%（`ratio_copy` 模式必填） |
| `copyMgnMode` | 保证金模式（非 `smart_copy` 时有效）：`copy` 跟随带单员（默认）、`isolated` 逐仓、`cross` 全仓。`smart_copy` 模式下由 `instType` 自动决定（SWAP→`copy`，SPOT→`isolated`），用户传值无效。 |
| `copyInstIdType` | 跟单品种选择：`copy` 跟随带单员（默认）、`custom` 自定义 |
| `instId` | 逗号分隔的合约 ID（`copyInstIdType=custom` 时必填） |
| `subPosCloseType` | 停止跟单时处理方式：`copy_close`（默认）、`market_close`、`manual_close` |
| `tpRatio` | 每单止盈比例，如 `0.1` = 10%（可选） |
| `slRatio` | 每单止损比例，如 `0.1` = 10%（可选） |
| `slTotalAmt` | 总止损金额（USDT）——累计亏损达到该金额时自动停止跟单（可选） |
