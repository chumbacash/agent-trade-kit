# OKX MCP Server 架构文档

## 1. 项目概述

OKX MCP Server 是一个基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 的 OKX 交易所接入层，允许 AI Agent（Claude Desktop 等）直接调用 OKX API 完成行情查询、下单、持仓管理等操作。

- **协议传输**：标准输入/输出（stdio），与宿主进程通过 JSON-RPC 通信
- **运行时**：Node.js ≥ 18
- **语言**：TypeScript（ESM 模块）
- **构建工具**：tsup（基于 esbuild）

---

## 2. 目录结构

```
okx_hub/
├── src/
│   ├── client/
│   │   ├── rest-client.ts   # HTTP 客户端：签名、请求、响应解析
│   │   └── types.ts         # 请求/响应 TypeScript 类型
│   ├── utils/
│   │   ├── signature.ts     # ISO 时间戳 + HMAC-SHA256 签名
│   │   ├── rate-limiter.ts  # Token Bucket 限速器
│   │   └── errors.ts        # 错误类层级 + toToolErrorPayload
│   ├── tools/
│   │   ├── types.ts         # ToolSpec 接口 + toMcpTool 转换
│   │   ├── helpers.ts       # 参数读取/校验工具函数
│   │   ├── common.ts        # 限速配置工厂函数 + 常量
│   │   ├── market.ts        # market 模块（公共接口）
│   │   ├── spot-trade.ts    # spot 模块（现货交易）
│   │   ├── swap-trade.ts    # swap 模块（合约/永续）
│   │   ├── account.ts       # account 模块（账户资产）
│   │   └── index.ts         # buildTools()：模块过滤 + 只读过滤
│   ├── config.ts            # 配置加载（环境变量 + CLI flags）
│   ├── constants.ts         # 模块 ID、API 地址、版本号
│   ├── server.ts            # MCP Server：注册 ListTools/CallTool Handler
│   └── index.ts             # CLI 入口：解析参数 → 加载配置 → 启动服务
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## 3. 分层架构

```
┌─────────────────────────────────────────────────────┐
│                   MCP 宿主进程                        │
│         (Claude Desktop / Claude Code / SDK)          │
└──────────────────────┬──────────────────────────────┘
                       │ stdio JSON-RPC
┌──────────────────────▼──────────────────────────────┐
│                    index.ts (CLI)                     │
│   parseArgs → loadConfig → createServer → connect    │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                   server.ts (MCP Server)              │
│  ListToolsHandler  │  CallToolHandler                 │
│  buildCapabilitySnapshot  │  errorResult / successResult │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              tools/ (工具注册层)                       │
│  buildTools(config) → ToolSpec[]                      │
│  market / spot-trade / swap-trade / account           │
└──────────────────────┬──────────────────────────────┘
                       │ context.client.*
┌──────────────────────▼──────────────────────────────┐
│             client/rest-client.ts (HTTP 层)           │
│  publicGet / privateGet / privatePost                 │
│  → 签名 → fetch → 解析 → 错误处理                      │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│               OKX REST API v5                         │
│             https://www.okx.com                       │
└─────────────────────────────────────────────────────┘
```

---

## 4. 核心模块详解

### 4.1 签名机制（utils/signature.ts）

OKX 使用 **ISO 8601 时间戳** + **HMAC-SHA256** 签名，与 Bitget（毫秒时间戳）不同：

```
签名内容 = timestamp + METHOD + requestPath + body
```

- `timestamp`：`new Date().toISOString()` → `"2024-01-01T00:00:00.000Z"`
- `METHOD`：大写，如 `"GET"` / `"POST"`
- `requestPath`：含 query string，如 `/api/v5/market/ticker?instId=BTC-USDT`
- `body`：POST 请求的 JSON 字符串，GET 为空字符串

请求头：
```
OK-ACCESS-KEY:        <apiKey>
OK-ACCESS-SIGN:       <base64(hmac-sha256(payload, secretKey))>
OK-ACCESS-PASSPHRASE: <passphrase>
OK-ACCESS-TIMESTAMP:  <isoTimestamp>
```

模拟盘额外加：
```
x-simulated-trading: 1
```

### 4.2 REST 客户端（client/rest-client.ts）

提供三个公共方法：

| 方法 | 鉴权 | 用途 |
|------|------|------|
| `publicGet(path, query, rateLimit)` | 无 | 公共行情接口 |
| `privateGet(path, query, rateLimit)` | 有 | 私有查询接口 |
| `privatePost(path, body, rateLimit)` | 有 | 私有写操作接口 |

**错误处理流程**：
```
fetch 网络错误 → NetworkError
HTTP 非 200    → OkxApiError (code=HTTP状态码)
JSON 解析失败  → NetworkError
code !== "0"   → OkxApiError / AuthenticationError
code === "0"   → 返回 RequestResult<TData>
```

### 4.3 限速器（utils/rate-limiter.ts）

Token Bucket 算法实现客户端限速：

- 每个 `key` 对应一个独立的 Bucket
- `capacity`：桶容量（最大并发 token 数）
- `refillPerSecond`：每秒补充速率
- `maxWaitMs`：最大等待时长（默认 30s），超出则抛 `RateLimitError`
- 自动等待 + 重试，调用方无感知

使用示例（tools/common.ts）：
```typescript
privateRateLimit("spot_place_order", 60)
// → { key: "private:spot_place_order", capacity: 60, refillPerSecond: 60 }
```

### 4.4 工具注册层（tools/）

每个模块导出一个 `register*Tools(): ToolSpec[]` 函数，`ToolSpec` 结构：

```typescript
interface ToolSpec {
  name: string;           // 工具名，如 "spot_place_order"
  module: ModuleId;       // 所属模块，用于过滤
  description: string;    // MCP 工具描述（供 AI 理解）
  inputSchema: JsonSchema;// JSON Schema，定义参数结构
  isWrite: boolean;       // true=写操作，只读模式下被过滤
  handler: (args, context) => Promise<unknown>;  // 执行逻辑
}
```

`buildTools(config)` 在启动时做两层过滤：
1. **模块过滤**：仅加载 `config.modules` 指定的模块
2. **只读过滤**：若 `config.readOnly=true`，移除所有 `isWrite=true` 的工具

### 4.5 MCP Server（server.ts）

注册两个 Handler：

**ListToolsHandler**：返回当前可用工具列表 + `system_get_capabilities` 元工具。

**CallToolHandler**：
1. 特殊处理 `system_get_capabilities` → 返回能力快照
2. 从 `toolMap` 查找工具
3. 调用 `tool.handler(args, { config, client })`
4. 成功返回 `successResult`，异常返回 `errorResult`

每次调用都附带 `CapabilitySnapshot`，便于 Agent 了解当前服务状态（哪些模块可用、是否只读、是否模拟盘）。

---

## 5. 模块与工具清单

### market 模块（公共，无需鉴权）

| 工具 | API 接口 | 说明 |
|------|---------|------|
| `market_get_ticker` | `GET /api/v5/market/ticker` | 单个标的 Ticker |
| `market_get_tickers` | `GET /api/v5/market/tickers` | 按类型批量 Ticker |
| `market_get_orderbook` | `GET /api/v5/market/books` | 订单簿（买卖盘） |
| `market_get_candles` | `GET /api/v5/market/candles` | K 线数据 |

### spot 模块（现货，需鉴权）

| 工具 | API 接口 | 写操作 |
|------|---------|-------|
| `spot_place_order` | `POST /api/v5/trade/order` | ✅ |
| `spot_cancel_order` | `POST /api/v5/trade/cancel-order` | ✅ |
| `spot_amend_order` | `POST /api/v5/trade/amend-order` | ✅ |
| `spot_get_orders` | `GET /api/v5/trade/orders-pending` 或 `orders-history` | ❌ |
| `spot_get_fills` | `GET /api/v5/trade/fills` | ❌ |

### swap 模块（合约/永续，需鉴权）

| 工具 | API 接口 | 写操作 |
|------|---------|-------|
| `swap_place_order` | `POST /api/v5/trade/order` | ✅ |
| `swap_cancel_order` | `POST /api/v5/trade/cancel-order` | ✅ |
| `swap_get_orders` | `GET /api/v5/trade/orders-pending` 或 `orders-history` | ❌ |
| `swap_get_positions` | `GET /api/v5/account/positions` | ❌ |
| `swap_set_leverage` | `POST /api/v5/account/set-leverage` | ✅ |
| `swap_get_fills` | `GET /api/v5/trade/fills` | ❌ |

### account 模块（账户，需鉴权）

| 工具 | API 接口 | 写操作 |
|------|---------|-------|
| `account_get_balance` | `GET /api/v5/account/balance` | ❌ |
| `account_transfer` | `POST /api/v5/asset/transfer` | ✅ |

---

## 6. 配置系统

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `OKX_API_KEY` | 私有接口必填 | — | API Key |
| `OKX_SECRET_KEY` | 私有接口必填 | — | Secret Key |
| `OKX_PASSPHRASE` | 私有接口必填 | — | Passphrase |
| `OKX_API_BASE_URL` | 否 | `https://www.okx.com` | API 基础 URL |
| `OKX_TIMEOUT_MS` | 否 | `15000` | 请求超时（毫秒） |

> `market` 模块（行情）为公共接口，无需任何 key 即可使用。
> 三个 key 必须同时提供或同时不提供，部分提供会报 `ConfigError`。

### CLI 参数

```
okx-trade-mcp [options]

  --modules <list>   逗号分隔模块名，或 "all"（默认：spot,swap,account）
  --read-only        禁用所有写操作
  --demo             启用模拟盘（注入 x-simulated-trading: 1）
  --help
  --version
```

---

## 7. 错误处理体系

所有错误继承自 `OkxMcpError`，统一由 `toToolErrorPayload()` 序列化后返回给 MCP 宿主：

```
OkxMcpError
├── ConfigError          # 配置缺失或格式错误
├── ValidationError      # 工具参数校验失败
├── AuthenticationError  # API Key/签名鉴权失败（OKX code 50111-50113）
├── RateLimitError       # 客户端限速超出等待上限
├── OkxApiError          # OKX 返回 code !== "0"
└── NetworkError         # 网络连接/超时/非 JSON 响应
```

工具调用失败时，响应格式：
```json
{
  "tool": "spot_place_order",
  "error": true,
  "type": "OkxApiError",
  "code": "51008",
  "message": "Order amount exceeded",
  "endpoint": "POST /api/v5/trade/order",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 8. Claude Desktop 配置示例

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "okx": {
      "command": "node",
      "args": [
        "/Users/fanqi/MyApp/okx_hub/dist/index.js"
      ],
      "env": {
        "OKX_API_KEY": "your-api-key",
        "OKX_SECRET_KEY": "your-secret-key",
        "OKX_PASSPHRASE": "your-passphrase"
      }
    }
  }
}
```

模拟盘测试：
```json
{
  "mcpServers": {
    "okx-demo": {
      "command": "node",
      "args": [
        "/Users/fanqi/MyApp/okx_hub/dist/index.js",
        "--demo"
      ],
      "env": {
        "OKX_API_KEY": "your-api-key",
        "OKX_SECRET_KEY": "your-secret-key",
        "OKX_PASSPHRASE": "your-passphrase"
      }
    }
  }
}
```

只读只开行情：
```json
{
  "mcpServers": {
    "okx-readonly": {
      "command": "node",
      "args": [
        "/Users/fanqi/MyApp/okx_hub/dist/index.js",
        "--modules", "market",
        "--read-only"
      ]
    }
  }
}
```

---

## 9. 与 Bitget MCP Server 的核心差异

| 项目 | Bitget（agent_hub） | OKX（okx_hub） |
|------|---------------------|----------------|
| 鉴权 Header 前缀 | `ACCESS-*` | `OK-ACCESS-*` |
| 时间戳格式 | 毫秒字符串 `"1699000000000"` | ISO 格式 `"2024-01-01T00:00:00.000Z"` |
| 签名内容 | `ts + METHOD + path?query + body` | `ts + METHOD + requestPath + body` |
| 成功 code | `"00000"` | `"0"` |
| API 路径前缀 | `/api/v2/` | `/api/v5/` |
| 模拟盘 | 不支持 | `--demo` → `x-simulated-trading: 1` |
| 合约模块 | `futures`（含市场+交易） | `swap`（SWAP+FUTURES 统一） |
| 市场模块 | `spot` 和 `futures` 分开 | 独立 `market` 模块 |

---

## 10. 开发指南

```bash
# 安装依赖
npm install

# 类型检查
npm run typecheck

# 构建
npm run build

# 直接运行（开发）
node dist/index.js --help
node dist/index.js --modules market   # 无需 key，测试行情
node dist/index.js --demo             # 模拟盘模式

# 发布前检查
npm run release:check
```

### 添加新工具

1. 在对应的 `tools/*.ts` 文件中添加新的 `ToolSpec` 对象
2. 设置 `module` 为对应模块 ID，`isWrite` 是否为写操作
3. 在 `inputSchema` 中定义参数（标准 JSON Schema）
4. 在 `handler` 中调用 `context.client.privateGet/Post` 或 `publicGet`
5. 无需修改 `server.ts` 或 `index.ts`

### 添加新模块

1. 在 `constants.ts` 的 `MODULES` 数组中加入新模块 ID
2. 创建 `tools/new-module.ts` 并实现 `registerNewModuleTools()`
3. 在 `tools/index.ts` 的 `allToolSpecs()` 中引入并调用
