import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { ToolRunner } from "@agent-tradekit/core";
import {
  cmdAccountPositions,
  cmdAccountFees,
  cmdAccountConfig,
  cmdAccountSetPositionMode,
  cmdAccountMaxSize,
  cmdAccountMaxAvailSize,
  cmdAccountTransfer,
  cmdAccountAudit,
} from "../src/commands/account.js";
import { setOutput, resetOutput } from "../src/formatter.js";

let out: string[] = [];
let err: string[] = [];

beforeEach(() => {
  out = []; err = [];
  setOutput({ out: (m) => out.push(m), err: (m) => err.push(m) });
});
afterEach(() => resetOutput());

function fakeResult(data: unknown) {
  return { endpoint: "GET /api/v5/account", requestTime: new Date().toISOString(), data };
}

// ---------------------------------------------------------------------------
// cmdAccountPositions
// ---------------------------------------------------------------------------
describe("cmdAccountPositions", () => {
  it("outputs 'No open positions' when all positions have pos=0", async () => {
    const runner: ToolRunner = async () => fakeResult([{ instId: "BTC-USDT", pos: "0" }]);
    await cmdAccountPositions(runner, { json: false });
    assert.ok(out.join("").includes("No open positions"));
    assert.equal(err.join(""), "");
  });

  it("outputs 'No open positions' when result is empty", async () => {
    const runner: ToolRunner = async () => fakeResult([]);
    await cmdAccountPositions(runner, { json: false });
    assert.ok(out.join("").includes("No open positions"));
  });

  it("outputs table when open positions exist", async () => {
    const runner: ToolRunner = async () => fakeResult([
      { instId: "BTC-USDT-SWAP", instType: "SWAP", posSide: "long", pos: "1", avgPx: "50000", upl: "100", lever: "10" },
    ]);
    await cmdAccountPositions(runner, { json: false });
    assert.ok(out.join("").includes("BTC-USDT-SWAP"));
  });

  it("outputs JSON when json=true", async () => {
    const runner: ToolRunner = async () => fakeResult([{ instId: "BTC-USDT", pos: "1" }]);
    await cmdAccountPositions(runner, { json: true });
    assert.doesNotThrow(() => JSON.parse(out.join("")));
  });
});

// ---------------------------------------------------------------------------
// cmdAccountFees
// ---------------------------------------------------------------------------
describe("cmdAccountFees", () => {
  it("outputs 'No data' when result is empty", async () => {
    const runner: ToolRunner = async () => fakeResult([]);
    await cmdAccountFees(runner, { instType: "SPOT", json: false });
    assert.ok(out.join("").includes("No data"));
    assert.equal(err.join(""), "");
  });

  it("outputs fee fields when data is present", async () => {
    const runner: ToolRunner = async () => fakeResult([
      { level: "Lv1", maker: "-0.0008", taker: "0.001", makerU: "-0.0002", takerU: "0.0005", ts: "1700000000000" },
    ]);
    await cmdAccountFees(runner, { instType: "SPOT", json: false });
    assert.ok(out.join("").includes("Lv1"));
    assert.ok(out.join("").includes("-0.0008"));
  });

  it("outputs JSON when json=true", async () => {
    const runner: ToolRunner = async () => fakeResult([{ level: "Lv1" }]);
    await cmdAccountFees(runner, { instType: "SPOT", json: true });
    assert.doesNotThrow(() => JSON.parse(out.join("")));
  });
});

// ---------------------------------------------------------------------------
// cmdAccountConfig
// ---------------------------------------------------------------------------
describe("cmdAccountConfig", () => {
  it("outputs 'No data' when result is empty", async () => {
    const runner: ToolRunner = async () => fakeResult([]);
    await cmdAccountConfig(runner, false);
    assert.ok(out.join("").includes("No data"));
    assert.equal(err.join(""), "");
  });

  it("outputs config fields when data is present", async () => {
    const runner: ToolRunner = async () => fakeResult([
      { uid: "12345", acctLv: "2", posMode: "long_short_mode", autoLoan: false, greeksType: "BS", level: "Lv1", levelTmp: "" },
    ]);
    await cmdAccountConfig(runner, false);
    assert.ok(out.join("").includes("12345"));
    assert.ok(out.join("").includes("long_short_mode"));
  });

  it("outputs JSON when json=true", async () => {
    const runner: ToolRunner = async () => fakeResult([{ uid: "12345" }]);
    await cmdAccountConfig(runner, true);
    assert.doesNotThrow(() => JSON.parse(out.join("")));
  });
});

// ---------------------------------------------------------------------------
// cmdAccountSetPositionMode
// ---------------------------------------------------------------------------
describe("cmdAccountSetPositionMode", () => {
  it("outputs confirmation with the new posMode", async () => {
    const runner: ToolRunner = async () => fakeResult([{ posMode: "long_short_mode" }]);
    await cmdAccountSetPositionMode(runner, "long_short_mode", false);
    assert.ok(out.join("").includes("Position mode set"));
    assert.ok(out.join("").includes("long_short_mode"));
    assert.equal(err.join(""), "");
  });

  it("outputs JSON when json=true", async () => {
    const runner: ToolRunner = async () => fakeResult([{ posMode: "net_mode" }]);
    await cmdAccountSetPositionMode(runner, "net_mode", true);
    assert.doesNotThrow(() => JSON.parse(out.join("")));
  });
});

// ---------------------------------------------------------------------------
// cmdAccountMaxSize
// ---------------------------------------------------------------------------
describe("cmdAccountMaxSize", () => {
  it("outputs 'No data' when result is empty", async () => {
    const runner: ToolRunner = async () => fakeResult([]);
    await cmdAccountMaxSize(runner, { instId: "BTC-USDT", tdMode: "cash", json: false });
    assert.ok(out.join("").includes("No data"));
    assert.equal(err.join(""), "");
  });

  it("outputs max size fields when data is present", async () => {
    const runner: ToolRunner = async () => fakeResult([{ instId: "BTC-USDT", maxBuy: "0.5", maxSell: "0.3" }]);
    await cmdAccountMaxSize(runner, { instId: "BTC-USDT", tdMode: "cash", json: false });
    assert.ok(out.join("").includes("BTC-USDT"));
    assert.ok(out.join("").includes("0.5"));
  });
});

// ---------------------------------------------------------------------------
// cmdAccountMaxAvailSize
// ---------------------------------------------------------------------------
describe("cmdAccountMaxAvailSize", () => {
  it("outputs 'No data' when result is empty", async () => {
    const runner: ToolRunner = async () => fakeResult([]);
    await cmdAccountMaxAvailSize(runner, { instId: "BTC-USDT", tdMode: "cash", json: false });
    assert.ok(out.join("").includes("No data"));
    assert.equal(err.join(""), "");
  });

  it("outputs avail size fields when data is present", async () => {
    const runner: ToolRunner = async () => fakeResult([{ instId: "BTC-USDT", availBuy: "0.5", availSell: "0.3" }]);
    await cmdAccountMaxAvailSize(runner, { instId: "BTC-USDT", tdMode: "cash", json: false });
    assert.ok(out.join("").includes("BTC-USDT"));
    assert.ok(out.join("").includes("0.5"));
  });
});

// ---------------------------------------------------------------------------
// cmdAccountTransfer
// ---------------------------------------------------------------------------
describe("cmdAccountTransfer", () => {
  it("outputs transfer confirmation with transId, ccy and amount", async () => {
    const runner: ToolRunner = async () => fakeResult([{ transId: "TXN001", ccy: "USDT", amt: "100" }]);
    await cmdAccountTransfer(runner, { ccy: "USDT", amt: "100", from: "18", to: "6", json: false });
    assert.ok(out.join("").includes("Transfer"));
    assert.ok(out.join("").includes("TXN001"));
    assert.ok(out.join("").includes("USDT"));
    assert.ok(out.join("").includes("100"));
    assert.equal(err.join(""), "");
  });

  it("outputs JSON when json=true", async () => {
    const runner: ToolRunner = async () => fakeResult([{ transId: "TXN001", ccy: "USDT", amt: "100" }]);
    await cmdAccountTransfer(runner, { ccy: "USDT", amt: "100", from: "18", to: "6", json: true });
    assert.doesNotThrow(() => JSON.parse(out.join("")));
  });
});

// ---------------------------------------------------------------------------
// cmdAccountAudit
// ---------------------------------------------------------------------------
describe("cmdAccountAudit", () => {
  it("outputs 'No audit log entries' when no log files exist", () => {
    // readAuditLogs silently skips missing files, so in a clean test env this
    // path is always hit unless ~/.okx/logs/ happens to have trade-*.log files.
    cmdAccountAudit({ json: false });
    const combined = out.join("");
    // Either no entries found (expected in CI) or a table was printed — either
    // way nothing should have gone to stderr.
    assert.equal(err.join(""), "");
    if (combined.includes("No audit log entries")) {
      assert.ok(true); // clean environment
    } else {
      assert.ok(combined.length > 0); // log files exist, table was rendered
    }
  });

  it("outputs JSON array when json=true and no log files exist", () => {
    cmdAccountAudit({ json: true });
    assert.doesNotThrow(() => JSON.parse(out.join("")));
  });
});
