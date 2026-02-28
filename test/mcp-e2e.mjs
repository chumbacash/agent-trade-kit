#!/usr/bin/env node
// test/mcp-e2e.mjs — Full E2E tests via MCP stdio JSON-RPC (demo mode)
//
// Usage:
//   OKX_API_KEY=xxx OKX_SECRET_KEY=xxx OKX_PASSPHRASE=xxx node test/mcp-e2e.mjs
//   node test/mcp-e2e.mjs   # reads ~/.okx/config.toml; skips private tests if no creds found

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, "../packages/mcp/dist/index.js");

// ─── Credentials ────────────────────────────────────────────────────────────

function getCredentials() {
  if (process.env.OKX_API_KEY && process.env.OKX_SECRET_KEY && process.env.OKX_PASSPHRASE) {
    return {
      apiKey: process.env.OKX_API_KEY,
      secretKey: process.env.OKX_SECRET_KEY,
      passphrase: process.env.OKX_PASSPHRASE,
    };
  }
  const configPath = join(process.env.HOME ?? "~", ".okx", "config.toml");
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      const apiKey = content.match(/api_key\s*=\s*"([^"]+)"/)?.[1];
      const secretKey = content.match(/secret_key\s*=\s*"([^"]+)"/)?.[1];
      const passphrase = content.match(/passphrase\s*=\s*"([^"]+)"/)?.[1];
      if (apiKey && secretKey && passphrase) return { apiKey, secretKey, passphrase };
    } catch {}
  }
  return null;
}

// ─── MCP Client ─────────────────────────────────────────────────────────────

class McpClient {
  constructor(proc) {
    this.proc = proc;
    this.pending = new Map();
    this.nextId = 1;
    this.rl = createInterface({ input: proc.stdout });
    this.rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch {}
    });
  }

  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout after 15s waiting for "${method}"`));
        }
      }, 15000);
    });
  }

  async initialize() {
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mcp-e2e-test", version: "1.0.0" },
    });
    this.proc.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
    );
  }

  async callTool(name, args) {
    return this.send("tools/call", { name, arguments: args ?? {} });
  }

  close() {
    this.proc.stdin.end();
  }
}

// ─── Assertions ──────────────────────────────────────────────────────────────

function parseResult(result) {
  if (!result) throw new Error("No result returned from tool call");
  const text = result.content?.[0]?.text;
  if (!text) throw new Error("No text content in result");
  return JSON.parse(text);
}

function assertOk(result) {
  const parsed = parseResult(result);
  if (parsed.ok === false || parsed.isError) {
    throw new Error(`Tool returned error: ${JSON.stringify(parsed.error ?? parsed.data)}`);
  }
  return parsed;
}

// ─── Test Runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function section(name) {
  console.log(`\n▶ ${name}`);
}

async function test(desc, fn) {
  try {
    await fn();
    console.log(`  ✅  ${desc}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${desc}`);
    console.log(`      ${err.message}`);
    failed++;
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ────────────────────────────────────────────────────────────────────

const creds = getCredentials();
const env = { ...process.env };
if (creds) {
  env.OKX_API_KEY = creds.apiKey;
  env.OKX_SECRET_KEY = creds.secretKey;
  env.OKX_PASSPHRASE = creds.passphrase;
}

const proc = spawn("node", [SERVER_PATH, "--modules", "all", "--demo"], {
  env,
  stdio: ["pipe", "pipe", "inherit"],
});

proc.on("error", (err) => {
  console.error("Failed to start MCP server:", err.message);
  process.exit(1);
});

const client = new McpClient(proc);

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  okx-trade-mcp E2E tests (demo)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

try {
  await client.initialize();

  // ── Phase 1: Public ────────────────────────────────────────────────────────
  section("public");

  await test("market_get_ticker BTC-USDT", async () => {
    const result = await client.callTool("market_get_ticker", { instId: "BTC-USDT" });
    const parsed = assertOk(result);
    const last = parsed.data?.data?.[0]?.last;
    if (!last || isNaN(Number(last))) throw new Error(`Expected numeric last price, got: ${last}`);
  });

  await test("market_get_candles BTC-USDT 1H", async () => {
    const result = await client.callTool("market_get_candles", {
      instId: "BTC-USDT",
      bar: "1H",
      limit: 3,
    });
    const parsed = assertOk(result);
    if (!Array.isArray(parsed.data?.data) || parsed.data.data.length === 0) {
      throw new Error("Expected non-empty candles array");
    }
  });

  if (!creds) {
    console.log("\n⚠️  No credentials found — skipping private tests.");
    console.log("   Set OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE, or add ~/.okx/config.toml");
  } else {
    // ── Phase 2: Private Read ──────────────────────────────────────────────
    section("private read  [需要 OKX_API_KEY]");

    await test("account_get_balance", async () => {
      const result = await client.callTool("account_get_balance", {});
      assertOk(result);
    });

    await test("account_get_asset_balance", async () => {
      const result = await client.callTool("account_get_asset_balance", {});
      assertOk(result);
    });

    await test("swap_get_positions", async () => {
      const result = await client.callTool("swap_get_positions", {});
      assertOk(result);
    });

    await test("swap_get_leverage BTC-USDT-SWAP", async () => {
      const result = await client.callTool("swap_get_leverage", {
        instId: "BTC-USDT-SWAP",
        mgnMode: "cross",
      });
      const parsed = assertOk(result);
      const lever = parsed.data?.data?.[0]?.lever;
      if (!lever) throw new Error(`Expected lever field, got: ${JSON.stringify(parsed.data?.data)}`);
    });

    await test("account_get_max_size BTC-USDT-SWAP", async () => {
      const result = await client.callTool("account_get_max_size", {
        instId: "BTC-USDT-SWAP",
        tdMode: "cross",
      });
      const parsed = assertOk(result);
      const d = parsed.data?.data?.[0];
      if (!d?.maxBuy && !d?.maxSell) {
        throw new Error(`Expected maxBuy/maxSell fields, got: ${JSON.stringify(d)}`);
      }
    });

    // ── Phase 3: Write (demo) ──────────────────────────────────────────────
    section("write (demo)");

    await test("swap_set_leverage → 5x", async () => {
      const result = await client.callTool("swap_set_leverage", {
        instId: "BTC-USDT-SWAP",
        lever: "5",
        mgnMode: "cross",
      });
      const parsed = assertOk(result);
      const lever = parsed.data?.data?.[0]?.lever;
      if (lever !== "5") throw new Error(`Expected lever=5, got: ${lever}`);
    });

    let posOrdId = null;

    await test("swap_place_order → ordId", async () => {
      const result = await client.callTool("swap_place_order", {
        instId: "BTC-USDT-SWAP",
        tdMode: "cross",
        side: "buy",
        ordType: "market",
        sz: "1",
      });
      const parsed = assertOk(result);
      posOrdId = parsed.data?.data?.[0]?.ordId;
      if (!posOrdId) throw new Error(`Expected ordId, got: ${JSON.stringify(parsed.data?.data)}`);
      console.log(`      ordId: ${posOrdId}`);
    });

    await delay(2000);

    await test("swap_get_positions → 1 position", async () => {
      const result = await client.callTool("swap_get_positions", { instId: "BTC-USDT-SWAP" });
      const parsed = assertOk(result);
      const positions = parsed.data?.data ?? [];
      if (positions.length === 0) console.log("      (position may not have filled yet)");
      else console.log(`      ${positions.length} position(s) found`);
    });

    await test("swap_close_position → closed", async () => {
      const result = await client.callTool("swap_close_position", {
        instId: "BTC-USDT-SWAP",
        mgnMode: "cross",
      });
      const parsed = assertOk(result);
      const d = parsed.data?.data?.[0];
      if (!d?.clOrdId && !d?.ordId) {
        throw new Error(`Expected clOrdId or ordId in response, got: ${JSON.stringify(d)}`);
      }
    });

    // ── Phase 4: Batch (demo) ──────────────────────────────────────────────
    section("batch (demo)");

    let ordIdA = null;
    let ordIdB = null;

    await test("swap_batch_orders place (2 orders)", async () => {
      const tickerResult = await client.callTool("market_get_ticker", {
        instId: "BTC-USDT-SWAP",
      });
      const tickerParsed = assertOk(tickerResult);
      const last = Number(tickerParsed.data?.data?.[0]?.last ?? "50000");
      const farPrice = String(Math.floor(last * 0.5)); // 50% below market — won't fill

      const result = await client.callTool("swap_batch_orders", {
        action: "place",
        orders: [
          {
            instId: "BTC-USDT-SWAP",
            tdMode: "cross",
            side: "buy",
            ordType: "limit",
            sz: "1",
            px: farPrice,
          },
          {
            instId: "BTC-USDT-SWAP",
            tdMode: "cross",
            side: "buy",
            ordType: "limit",
            sz: "1",
            px: farPrice,
          },
        ],
      });
      const parsed = assertOk(result);
      const data = parsed.data?.data;
      if (!Array.isArray(data) || data.length !== 2) {
        throw new Error(`Expected 2 orders in response, got: ${JSON.stringify(data)}`);
      }
      if (data[0].sCode !== "0") {
        throw new Error(`Order 0 failed: sCode=${data[0].sCode} sMsg=${data[0].sMsg}`);
      }
      if (data[1].sCode !== "0") {
        throw new Error(`Order 1 failed: sCode=${data[1].sCode} sMsg=${data[1].sMsg}`);
      }
      ordIdA = data[0].ordId;
      ordIdB = data[1].ordId;
      console.log(`      ordIdA: ${ordIdA}, ordIdB: ${ordIdB}`);
    });

    if (ordIdA) {
      await test("swap_batch_orders amend", async () => {
        const result = await client.callTool("swap_batch_orders", {
          action: "amend",
          orders: [{ instId: "BTC-USDT-SWAP", ordId: ordIdA, newSz: "2" }],
        });
        const parsed = assertOk(result);
        const data = parsed.data?.data;
        if (!Array.isArray(data) || data[0].sCode !== "0") {
          throw new Error(`Amend failed: ${JSON.stringify(data)}`);
        }
      });
    }

    if (ordIdA || ordIdB) {
      await test("swap_batch_orders cancel", async () => {
        const orders = [];
        if (ordIdA) orders.push({ instId: "BTC-USDT-SWAP", ordId: ordIdA });
        if (ordIdB) orders.push({ instId: "BTC-USDT-SWAP", ordId: ordIdB });
        const result = await client.callTool("swap_batch_orders", { action: "cancel", orders });
        const parsed = assertOk(result);
        const data = parsed.data?.data;
        if (!Array.isArray(data)) {
          throw new Error(`Expected array response, got: ${JSON.stringify(data)}`);
        }
        for (const item of data) {
          if (item.sCode !== "0") {
            throw new Error(`Cancel failed: sCode=${item.sCode} sMsg=${item.sMsg}`);
          }
        }
      });
    }

    // ── Phase 5: Algo (demo) ───────────────────────────────────────────────
    section("algo (demo)");

    let algoId = null;

    await test("swap_place_order (for algo test)", async () => {
      const result = await client.callTool("swap_place_order", {
        instId: "BTC-USDT-SWAP",
        tdMode: "cross",
        side: "buy",
        ordType: "market",
        sz: "1",
      });
      const parsed = assertOk(result);
      if (!parsed.data?.data?.[0]?.ordId) {
        throw new Error(`Expected ordId, got: ${JSON.stringify(parsed.data?.data)}`);
      }
    });

    await delay(2000);

    await test("swap_place_algo_order oco", async () => {
      const tickerResult = await client.callTool("market_get_ticker", {
        instId: "BTC-USDT-SWAP",
      });
      const tickerParsed = assertOk(tickerResult);
      const last = Number(tickerParsed.data?.data?.[0]?.last ?? "50000");
      const tpPrice = String(Math.floor(last * 1.1)); // 10% above
      const slPrice = String(Math.floor(last * 0.9)); // 10% below

      const result = await client.callTool("swap_place_algo_order", {
        instId: "BTC-USDT-SWAP",
        tdMode: "cross",
        side: "sell",
        ordType: "oco",
        sz: "1",
        tpTriggerPx: tpPrice,
        tpOrdPx: "-1",
        slTriggerPx: slPrice,
        slOrdPx: "-1",
      });
      const parsed = assertOk(result);
      algoId = parsed.data?.data?.[0]?.algoId;
      if (!algoId) throw new Error(`Expected algoId, got: ${JSON.stringify(parsed.data?.data)}`);
      console.log(`      algoId: ${algoId}`);
    });

    await test("swap_get_algo_orders", async () => {
      const result = await client.callTool("swap_get_algo_orders", {
        instId: "BTC-USDT-SWAP",
        status: "pending",
      });
      assertOk(result);
    });

    if (algoId) {
      await test("swap_cancel_algo_orders", async () => {
        const result = await client.callTool("swap_cancel_algo_orders", {
          orders: [{ algoId, instId: "BTC-USDT-SWAP" }],
        });
        const parsed = assertOk(result);
        const data = parsed.data?.data;
        if (!Array.isArray(data) || data[0].sCode !== "0") {
          throw new Error(`Cancel algo failed: ${JSON.stringify(data)}`);
        }
      });
    }

    await test("swap_close_position (cleanup)", async () => {
      const result = await client.callTool("swap_close_position", {
        instId: "BTC-USDT-SWAP",
        mgnMode: "cross",
      });
      assertOk(result);
    });
  }
} finally {
  client.close();
  proc.kill();
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  passed: ${passed}  failed: ${failed}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

if (failed > 0) process.exit(1);
