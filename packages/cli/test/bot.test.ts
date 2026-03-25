import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { ToolRunner } from "@agent-tradekit/core";
import {
  cmdGridOrders,
  cmdGridDetails,
  cmdGridCreate,
  cmdGridStop,
  cmdDcaOrders,
  cmdDcaDetails,
  cmdDcaCreate,
  cmdDcaStop,
} from "../src/commands/bot.js";
import { setOutput, resetOutput } from "../src/formatter.js";

let out: string[] = [];
let err: string[] = [];

beforeEach(() => {
  out = []; err = [];
  setOutput({ out: (m) => out.push(m), err: (m) => err.push(m) });
});
afterEach(() => resetOutput());

function fakeResult(data: unknown) {
  return { endpoint: "POST /api/v5/tradingBot", requestTime: new Date().toISOString(), data };
}

// ---------------------------------------------------------------------------
// cmdGridOrders
// ---------------------------------------------------------------------------
describe("cmdGridOrders", () => {
  it("outputs 'No grid bots' to stdout when list is empty", async () => {
    const runner: ToolRunner = async () => fakeResult([]);
    await cmdGridOrders(runner, { algoOrdType: "grid", status: "active", json: false });
    assert.ok(out.join("").includes("No grid bots"));
    assert.equal(err.join(""), "");
  });

  it("outputs JSON when json=true", async () => {
    const runner: ToolRunner = async () => fakeResult([{ algoId: "1", instId: "BTC-USDT", algoOrdType: "grid", state: "running", pnlRatio: "0", gridNum: "10", maxPx: "50000", minPx: "40000", cTime: "0" }]);
    await cmdGridOrders(runner, { algoOrdType: "grid", status: "active", json: true });
    assert.doesNotThrow(() => JSON.parse(out.join("")));
  });
});

// ---------------------------------------------------------------------------
// cmdGridDetails
// ---------------------------------------------------------------------------
describe("cmdGridDetails", () => {
  it("outputs 'Bot not found' to stdout when result is empty", async () => {
    const runner: ToolRunner = async () => fakeResult([]);
    await cmdGridDetails(runner, { algoOrdType: "grid", algoId: "001", json: false });
    assert.ok(out.join("").includes("Bot not found"));
    assert.equal(err.join(""), "");
  });
});

// ---------------------------------------------------------------------------
// cmdGridCreate — emitWriteResult success and error paths
// ---------------------------------------------------------------------------
describe("cmdGridCreate", () => {
  it("outputs success message to stdout when sCode='0'", async () => {
    const runner: ToolRunner = async () => fakeResult([{ algoId: "GRID001", sCode: "0", sMsg: "" }]);
    await cmdGridCreate(runner, { instId: "BTC-USDT", algoOrdType: "grid", maxPx: "50000", minPx: "40000", gridNum: "10", json: false });
    assert.ok(out.join("").includes("Grid bot created"));
    assert.ok(out.join("").includes("GRID001"));
    assert.ok(out.join("").includes("OK"));
    assert.equal(err.join(""), "");
  });

  it("outputs error message to stderr when sCode is non-zero", async () => {
    const runner: ToolRunner = async () => fakeResult([{ algoId: "", sCode: "51008", sMsg: "Insufficient balance" }]);
    await cmdGridCreate(runner, { instId: "BTC-USDT", algoOrdType: "grid", maxPx: "50000", minPx: "40000", gridNum: "10", json: false });
    assert.ok(err.join("").includes("Insufficient balance"));
    assert.ok(err.join("").includes("51008"));
    assert.equal(out.join(""), "");
  });

  it("outputs JSON when json=true", async () => {
    const runner: ToolRunner = async () => fakeResult([{ algoId: "GRID001", sCode: "0" }]);
    await cmdGridCreate(runner, { instId: "BTC-USDT", algoOrdType: "grid", maxPx: "50000", minPx: "40000", gridNum: "10", json: true });
    assert.doesNotThrow(() => JSON.parse(out.join("")));
  });
});

// ---------------------------------------------------------------------------
// cmdGridStop — emitWriteResult success and error paths
// ---------------------------------------------------------------------------
describe("cmdGridStop", () => {
  it("outputs success message to stdout when sCode='0'", async () => {
    const runner: ToolRunner = async () => fakeResult([{ algoId: "GRID001", sCode: "0", sMsg: "" }]);
    await cmdGridStop(runner, { algoId: "GRID001", algoOrdType: "grid", instId: "BTC-USDT", json: false });
    assert.ok(out.join("").includes("Grid bot stopped"));
    assert.ok(out.join("").includes("GRID001"));
    assert.ok(out.join("").includes("OK"));
    assert.equal(err.join(""), "");
  });

  it("outputs error to stderr when sCode is non-zero", async () => {
    const runner: ToolRunner = async () => fakeResult([{ algoId: "", sCode: "50013", sMsg: "Bot not running" }]);
    await cmdGridStop(runner, { algoId: "GRID001", algoOrdType: "grid", instId: "BTC-USDT", json: false });
    assert.ok(err.join("").includes("Bot not running"));
    assert.ok(err.join("").includes("50013"));
    assert.equal(out.join(""), "");
  });
});

// ---------------------------------------------------------------------------
// cmdDcaOrders
// ---------------------------------------------------------------------------
describe("cmdDcaOrders", () => {
  it("outputs 'No DCA bots' to stdout when list is empty", async () => {
    const runner: ToolRunner = async () => fakeResult([]);
    await cmdDcaOrders(runner, { history: false, json: false });
    assert.ok(out.join("").includes("No DCA bots"));
    assert.equal(err.join(""), "");
  });
});

// ---------------------------------------------------------------------------
// cmdDcaDetails
// ---------------------------------------------------------------------------
describe("cmdDcaDetails", () => {
  it("outputs 'DCA bot not found' to stdout when result is empty", async () => {
    const runner: ToolRunner = async () => fakeResult([]);
    await cmdDcaDetails(runner, { algoId: "DCA001", json: false });
    assert.ok(out.join("").includes("DCA bot not found"));
    assert.equal(err.join(""), "");
  });
});

// ---------------------------------------------------------------------------
// cmdDcaCreate — emitWriteResult success and error paths
// ---------------------------------------------------------------------------
describe("cmdDcaCreate", () => {
  const baseOpts = {
    instId: "BTC-USDT-SWAP", lever: "3", direction: "long",
    initOrdAmt: "100", maxSafetyOrds: "5", tpPct: "0.05", json: false,
  };

  it("outputs success message to stdout when sCode='0'", async () => {
    const runner: ToolRunner = async () => fakeResult([{ algoId: "DCA001", sCode: "0", sMsg: "" }]);
    await cmdDcaCreate(runner, baseOpts);
    assert.ok(out.join("").includes("DCA bot created"));
    assert.ok(out.join("").includes("DCA001"));
    assert.ok(out.join("").includes("OK"));
    assert.equal(err.join(""), "");
  });

  it("outputs error to stderr when sCode is non-zero", async () => {
    const runner: ToolRunner = async () => fakeResult([{ algoId: "", sCode: "51008", sMsg: "Insufficient margin" }]);
    await cmdDcaCreate(runner, baseOpts);
    assert.ok(err.join("").includes("Insufficient margin"));
    assert.ok(err.join("").includes("51008"));
    assert.equal(out.join(""), "");
  });
});

// ---------------------------------------------------------------------------
// cmdDcaStop — emitWriteResult success and error paths
// ---------------------------------------------------------------------------
describe("cmdDcaStop", () => {
  it("outputs success message to stdout when sCode='0'", async () => {
    const runner: ToolRunner = async () => fakeResult([{ algoId: "DCA001", sCode: "0", sMsg: "" }]);
    await cmdDcaStop(runner, { algoId: "DCA001", json: false });
    assert.ok(out.join("").includes("DCA bot stopped"));
    assert.ok(out.join("").includes("DCA001"));
    assert.ok(out.join("").includes("OK"));
    assert.equal(err.join(""), "");
  });

  it("outputs error to stderr when sCode is non-zero", async () => {
    const runner: ToolRunner = async () => fakeResult([{ algoId: "", sCode: "50013", sMsg: "Bot not found" }]);
    await cmdDcaStop(runner, { algoId: "DCA001", json: false });
    assert.ok(err.join("").includes("Bot not found"));
    assert.ok(err.join("").includes("50013"));
    assert.equal(out.join(""), "");
  });
});
