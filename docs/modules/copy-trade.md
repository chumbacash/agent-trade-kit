[English](./copy-trade.md) | [中文](./copy-trade.zh-CN.md)

# copy-trade — Copy Trading Module

The `copytrading` module provides tools to browse lead traders, follow/unfollow them, and monitor your copy trading status.

> **Not loaded by default.** Enable with `--modules copytrading` or add to your profile.

---

## Enabling the Module

### MCP (Claude / AI clients)

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

### CLI

```bash
okx --modules copytrading copy-trade traders
```

---

## MCP Tools

| Tool | Description | Auth |
|------|-------------|------|
| `copytrading_public_lead_traders` | List top lead traders by ranking with filters | Public |
| `copytrading_public_trader_detail` | Full trader profile: P&L, stats, currency preference | Public |
| `copytrading_my_status` | My currently followed lead traders and their cumulative P&L | Private |
| `copytrading_set_copy_trading` | Start copy trading a lead trader | Private ⚠️ |
| `copytrading_stop_copy_trader` | Stop copy trading a lead trader | Private ⚠️ |

⚠️ Write operations — use with caution.

---

## Key Parameters

| Parameter | Description |
|-----------|-------------|
| `uniqueCode` | 16-character lead trader unique code |
| `instType` | `SWAP` (default) or `SPOT` |
| `lastDays` | Time range: `1`=7d, `2`=30d (default), `3`=90d, `4`=365d |
| `copyTotalAmt` | Max total USDT to allocate for a trader |
| `copyMode` | `fixed_amount` (default) or `ratio_copy` |
| `copyAmt` | Fixed USDT per order (for `fixed_amount` mode) |
| `copyRatio` | Copy ratio (for `ratio_copy` mode) |
| `subPosCloseType` | On stop: `copy_close` (default), `market_close`, `manual_close` |

---

## CLI Quick Reference

```bash
# List traders
okx copy-trade traders [--instType SPOT|SWAP] [--limit <n>]

# My copy status
okx copy-trade status [--instType SPOT|SWAP]

# Follow a trader
okx copy-trade follow --uniqueCode <code> --fixedAmt <n>

# Unfollow
okx copy-trade unfollow --uniqueCode <code>

# Trader detail
okx copy-trade trader-detail --uniqueCode <code> [--lastDays 1|2|3|4]
```
