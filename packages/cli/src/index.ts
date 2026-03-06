import { createRequire } from "node:module";
import { OkxRestClient, toToolErrorPayload, checkForUpdates } from "@agent-tradekit/core";

const _require = createRequire(import.meta.url);
const CLI_VERSION = (_require("../package.json") as { version: string }).version;
import { loadProfileConfig } from "./config/loader.js";
import { printHelp } from "./help.js";
import { parseCli } from "./parser.js";
import type { CliValues } from "./parser.js";
import {
  cmdMarketTicker,
  cmdMarketTickers,
  cmdMarketOrderbook,
  cmdMarketCandles,
  cmdMarketInstruments,
  cmdMarketFundingRate,
  cmdMarketMarkPrice,
  cmdMarketTrades,
  cmdMarketIndexTicker,
  cmdMarketIndexCandles,
  cmdMarketPriceLimit,
  cmdMarketOpenInterest,
} from "./commands/market.js";
import {
  cmdAccountBalance,
  cmdAccountAssetBalance,
  cmdAccountPositions,
  cmdAccountBills,
  cmdAccountFees,
  cmdAccountConfig,
  cmdAccountSetPositionMode,
  cmdAccountMaxSize,
  cmdAccountMaxAvailSize,
  cmdAccountMaxWithdrawal,
  cmdAccountPositionsHistory,
  cmdAccountTransfer,
} from "./commands/account.js";
import {
  cmdSpotOrders,
  cmdSpotPlace,
  cmdSpotCancel,
  cmdSpotFills,
  cmdSpotGet,
  cmdSpotAmend,
  cmdSpotAlgoPlace,
  cmdSpotAlgoAmend,
  cmdSpotAlgoCancel,
  cmdSpotAlgoOrders,
} from "./commands/spot.js";
import {
  cmdSwapPositions,
  cmdSwapOrders,
  cmdSwapPlace,
  cmdSwapCancel,
  cmdSwapFills,
  cmdSwapGet,
  cmdSwapClose,
  cmdSwapGetLeverage,
  cmdSwapSetLeverage,
  cmdSwapAlgoPlace,
  cmdSwapAlgoAmend,
  cmdSwapAlgoCancel,
  cmdSwapAlgoOrders,
  cmdSwapAlgoTrailPlace,
  cmdSwapAmend,
} from "./commands/swap.js";
import {
  cmdFuturesOrders,
  cmdFuturesPositions,
  cmdFuturesFills,
  cmdFuturesPlace,
  cmdFuturesCancel,
  cmdFuturesGet,
} from "./commands/futures.js";
import { cmdConfigShow, cmdConfigSet, cmdConfigInit } from "./commands/config.js";
import {
  cmdSetupClients,
  cmdSetupClient,
  printSetupUsage,
  SUPPORTED_CLIENTS,
} from "./commands/client-setup.js";
import type { ClientId } from "./commands/client-setup.js";
import {
  cmdGridOrders,
  cmdGridDetails,
  cmdGridSubOrders,
  cmdGridCreate,
  cmdGridStop,
} from "./commands/bot.js";

// Re-export for tests and external consumers
export { printHelp } from "./help.js";
export type { CliValues } from "./parser.js";

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

export function handleConfigCommand(action: string, rest: string[], json: boolean): Promise<void> | void {
  if (action === "init") return cmdConfigInit();
  if (action === "show") return cmdConfigShow(json);
  if (action === "set") return cmdConfigSet(rest[0], rest[1]);
  if (action === "setup-clients") return cmdSetupClients();
  process.stderr.write(`Unknown config command: ${action}\n`);
  process.exitCode = 1;
}

export function handleSetupCommand(v: CliValues): void {
  if (!v.client) {
    printSetupUsage();
    return;
  }
  if (!SUPPORTED_CLIENTS.includes(v.client as ClientId)) {
    process.stderr.write(
      `Unknown client: "${v.client}"\nSupported: ${SUPPORTED_CLIENTS.join(", ")}\n`
    );
    process.exitCode = 1;
    return;
  }
  cmdSetupClient({
    client: v.client as ClientId,
    profile: v.profile,
    modules: v.modules,
  });
}

export function handleMarketPublicCommand(
  client: OkxRestClient,
  action: string,
  rest: string[],
  v: CliValues,
  json: boolean
): Promise<void> | void {
  if (action === "ticker") return cmdMarketTicker(client, rest[0], json);
  if (action === "tickers") return cmdMarketTickers(client, rest[0], json);
  if (action === "instruments")
    return cmdMarketInstruments(client, { instType: v.instType!, instId: v.instId, json });
  if (action === "mark-price")
    return cmdMarketMarkPrice(client, { instType: v.instType!, instId: v.instId, json });
  if (action === "index-ticker")
    return cmdMarketIndexTicker(client, { instId: v.instId, quoteCcy: v.quoteCcy, json });
  if (action === "price-limit") return cmdMarketPriceLimit(client, rest[0], json);
  if (action === "open-interest")
    return cmdMarketOpenInterest(client, { instType: v.instType!, instId: v.instId, json });
}

export function handleMarketDataCommand(
  client: OkxRestClient,
  action: string,
  rest: string[],
  v: CliValues,
  json: boolean
): Promise<void> | void {
  const limit = v.limit !== undefined ? Number(v.limit) : undefined;
  if (action === "orderbook")
    return cmdMarketOrderbook(client, rest[0], v.sz !== undefined ? Number(v.sz) : undefined, json);
  if (action === "candles")
    return cmdMarketCandles(client, rest[0], { bar: v.bar, limit, json });
  if (action === "funding-rate")
    return cmdMarketFundingRate(client, rest[0], { history: v.history ?? false, limit, json });
  if (action === "trades")
    return cmdMarketTrades(client, rest[0], { limit, json });
  if (action === "index-candles")
    return cmdMarketIndexCandles(client, rest[0], { bar: v.bar, limit, history: v.history ?? false, json });
}

export function handleMarketCommand(
  client: OkxRestClient,
  action: string,
  rest: string[],
  v: CliValues,
  json: boolean
): Promise<void> | void {
  return (
    handleMarketPublicCommand(client, action, rest, v, json) ??
    handleMarketDataCommand(client, action, rest, v, json)
  );
}

export function handleAccountWriteCommand(
  client: OkxRestClient,
  action: string,
  v: CliValues,
  json: boolean
): Promise<void> | void {
  if (action === "set-position-mode")
    return cmdAccountSetPositionMode(client, v.posMode!, json);
  if (action === "max-size")
    return cmdAccountMaxSize(client, { instId: v.instId!, tdMode: v.tdMode!, px: v.px, json });
  if (action === "max-avail-size")
    return cmdAccountMaxAvailSize(client, { instId: v.instId!, tdMode: v.tdMode!, json });
  if (action === "max-withdrawal") return cmdAccountMaxWithdrawal(client, v.ccy, json);
  if (action === "transfer")
    return cmdAccountTransfer(client, {
      ccy: v.ccy!,
      amt: v.amt!,
      from: v.from!,
      to: v.to!,
      transferType: v.transferType,
      subAcct: v.subAcct,
      json,
    });
}

function handleAccountCommand(
  client: OkxRestClient,
  action: string,
  rest: string[],
  v: CliValues,
  json: boolean
): Promise<void> | void {
  const limit = v.limit !== undefined ? Number(v.limit) : undefined;
  if (action === "balance") return cmdAccountBalance(client, rest[0], json);
  if (action === "asset-balance") return cmdAccountAssetBalance(client, v.ccy, json);
  if (action === "positions")
    return cmdAccountPositions(client, { instType: v.instType, instId: v.instId, json });
  if (action === "positions-history")
    return cmdAccountPositionsHistory(client, {
      instType: v.instType,
      instId: v.instId,
      limit,
      json,
    });
  if (action === "bills")
    return cmdAccountBills(client, {
      archive: v.archive ?? false,
      instType: v.instType,
      ccy: v.ccy,
      limit,
      json,
    });
  if (action === "fees")
    return cmdAccountFees(client, { instType: v.instType!, instId: v.instId, json });
  if (action === "config") return cmdAccountConfig(client, json);
  return handleAccountWriteCommand(client, action, v, json);
}

function handleSpotAlgoCommand(
  client: OkxRestClient,
  subAction: string,
  v: CliValues,
  json: boolean
): Promise<void> | void {
  if (subAction === "place")
    return cmdSpotAlgoPlace(client, {
      instId: v.instId!,
      side: v.side!,
      ordType: v.ordType ?? "conditional",
      sz: v.sz!,
      tpTriggerPx: v.tpTriggerPx,
      tpOrdPx: v.tpOrdPx,
      slTriggerPx: v.slTriggerPx,
      slOrdPx: v.slOrdPx,
      json,
    });
  if (subAction === "amend")
    return cmdSpotAlgoAmend(client, {
      instId: v.instId!,
      algoId: v.algoId!,
      newSz: v.newSz,
      newTpTriggerPx: v.newTpTriggerPx,
      newTpOrdPx: v.newTpOrdPx,
      newSlTriggerPx: v.newSlTriggerPx,
      newSlOrdPx: v.newSlOrdPx,
      json,
    });
  if (subAction === "cancel")
    return cmdSpotAlgoCancel(client, v.instId!, v.algoId!, json);
  if (subAction === "orders")
    return cmdSpotAlgoOrders(client, {
      instId: v.instId,
      status: v.history ? "history" : "pending",
      ordType: v.ordType,
      json,
    });
}

function handleSpotCommand(
  client: OkxRestClient,
  action: string,
  rest: string[],
  v: CliValues,
  json: boolean
): Promise<void> | void {
  if (action === "orders")
    return cmdSpotOrders(client, {
      instId: v.instId,
      status: v.history ? "history" : "open",
      json,
    });
  if (action === "get")
    return cmdSpotGet(client, { instId: v.instId!, ordId: v.ordId, clOrdId: v.clOrdId, json });
  if (action === "fills")
    return cmdSpotFills(client, { instId: v.instId, ordId: v.ordId, json });
  if (action === "amend")
    return cmdSpotAmend(client, {
      instId: v.instId!,
      ordId: v.ordId,
      clOrdId: v.clOrdId,
      newSz: v.newSz,
      newPx: v.newPx,
      json,
    });
  if (action === "place")
    return cmdSpotPlace(client, {
      instId: v.instId!,
      side: v.side!,
      ordType: v.ordType!,
      sz: v.sz!,
      px: v.px,
      json,
    });
  if (action === "cancel")
    return cmdSpotCancel(client, rest[0], v.ordId!, json);
  if (action === "algo")
    return handleSpotAlgoCommand(client, rest[0], v, json);
}

function handleSwapAlgoCommand(
  client: OkxRestClient,
  subAction: string,
  v: CliValues,
  json: boolean
): Promise<void> | void {
  if (subAction === "trail")
    return cmdSwapAlgoTrailPlace(client, {
      instId: v.instId!,
      side: v.side!,
      sz: v.sz!,
      callbackRatio: v.callbackRatio,
      callbackSpread: v.callbackSpread,
      activePx: v.activePx,
      posSide: v.posSide,
      tdMode: v.tdMode ?? "cross",
      reduceOnly: v.reduceOnly,
      json,
    });
  if (subAction === "place")
    return cmdSwapAlgoPlace(client, {
      instId: v.instId!,
      side: v.side!,
      ordType: v.ordType ?? "conditional",
      sz: v.sz!,
      posSide: v.posSide,
      tdMode: v.tdMode ?? "cross",
      tpTriggerPx: v.tpTriggerPx,
      tpOrdPx: v.tpOrdPx,
      slTriggerPx: v.slTriggerPx,
      slOrdPx: v.slOrdPx,
      reduceOnly: v.reduceOnly,
      json,
    });
  if (subAction === "amend")
    return cmdSwapAlgoAmend(client, {
      instId: v.instId!,
      algoId: v.algoId!,
      newSz: v.newSz,
      newTpTriggerPx: v.newTpTriggerPx,
      newTpOrdPx: v.newTpOrdPx,
      newSlTriggerPx: v.newSlTriggerPx,
      newSlOrdPx: v.newSlOrdPx,
      json,
    });
  if (subAction === "cancel")
    return cmdSwapAlgoCancel(client, v.instId!, v.algoId!, json);
  if (subAction === "orders")
    return cmdSwapAlgoOrders(client, {
      instId: v.instId,
      status: v.history ? "history" : "pending",
      ordType: v.ordType,
      json,
    });
}

export function handleSwapCommand(
  client: OkxRestClient,
  action: string,
  rest: string[],
  v: CliValues,
  json: boolean
): Promise<void> | void {
  if (action === "positions")
    return cmdSwapPositions(client, rest[0] ?? v.instId, json);
  if (action === "orders")
    return cmdSwapOrders(client, {
      instId: v.instId,
      status: v.history ? "history" : "open",
      json,
    });
  if (action === "get")
    return cmdSwapGet(client, { instId: v.instId!, ordId: v.ordId, clOrdId: v.clOrdId, json });
  if (action === "fills")
    return cmdSwapFills(client, {
      instId: v.instId,
      ordId: v.ordId,
      archive: v.archive ?? false,
      json,
    });
  if (action === "close")
    return cmdSwapClose(client, {
      instId: v.instId!,
      mgnMode: v.mgnMode!,
      posSide: v.posSide,
      autoCxl: v.autoCxl,
      json,
    });
  if (action === "get-leverage")
    return cmdSwapGetLeverage(client, { instId: v.instId!, mgnMode: v.mgnMode!, json });
  if (action === "place")
    return cmdSwapPlace(client, {
      instId: v.instId!,
      side: v.side!,
      ordType: v.ordType!,
      sz: v.sz!,
      posSide: v.posSide,
      px: v.px,
      tdMode: v.tdMode ?? "cross",
      json,
    });
  if (action === "cancel")
    return cmdSwapCancel(client, rest[0], v.ordId!, json);
  if (action === "amend")
    return cmdSwapAmend(client, {
      instId: v.instId!,
      ordId: v.ordId,
      clOrdId: v.clOrdId,
      newSz: v.newSz,
      newPx: v.newPx,
      json,
    });
  if (action === "leverage")
    return cmdSwapSetLeverage(client, {
      instId: v.instId!,
      lever: v.lever!,
      mgnMode: v.mgnMode!,
      posSide: v.posSide,
      json,
    });
  if (action === "algo")
    return handleSwapAlgoCommand(client, rest[0], v, json);
}

function handleFuturesCommand(
  client: OkxRestClient,
  action: string,
  rest: string[],
  v: CliValues,
  json: boolean
): Promise<void> | void {
  if (action === "orders") {
    let status: "archive" | "history" | "open" = "open";
    if (v.archive) status = "archive";
    else if (v.history) status = "history";
    return cmdFuturesOrders(client, { instId: v.instId, status, json });
  }
  if (action === "positions") return cmdFuturesPositions(client, v.instId, json);
  if (action === "fills")
    return cmdFuturesFills(client, {
      instId: v.instId,
      ordId: v.ordId,
      archive: v.archive ?? false,
      json,
    });
  if (action === "place")
    return cmdFuturesPlace(client, {
      instId: v.instId!,
      side: v.side!,
      ordType: v.ordType!,
      sz: v.sz!,
      tdMode: v.tdMode ?? "cross",
      posSide: v.posSide,
      px: v.px,
      reduceOnly: v.reduceOnly,
      json,
    });
  if (action === "cancel")
    return cmdFuturesCancel(client, rest[0] ?? v.instId!, v.ordId!, json);
  if (action === "get")
    return cmdFuturesGet(client, { instId: rest[0] ?? v.instId!, ordId: v.ordId, json });
}

export function handleBotGridCommand(
  client: OkxRestClient,
  v: CliValues,
  rest: string[],
  json: boolean
): Promise<void> | void {
  const subAction = rest[0];
  if (subAction === "orders")
    return cmdGridOrders(client, {
      algoOrdType: v.algoOrdType!,
      instId: v.instId,
      algoId: v.algoId,
      status: v.history ? "history" : "active",
      json,
    });
  if (subAction === "details")
    return cmdGridDetails(client, {
      algoOrdType: v.algoOrdType!,
      algoId: v.algoId!,
      json,
    });
  if (subAction === "sub-orders")
    return cmdGridSubOrders(client, {
      algoOrdType: v.algoOrdType!,
      algoId: v.algoId!,
      type: v.live ? "live" : "filled",
      json,
    });
  if (subAction === "create")
    return cmdGridCreate(client, {
      instId: v.instId!,
      algoOrdType: v.algoOrdType!,
      maxPx: v.maxPx!,
      minPx: v.minPx!,
      gridNum: v.gridNum!,
      runType: v.runType,
      quoteSz: v.quoteSz,
      baseSz: v.baseSz,
      direction: v.direction,
      lever: v.lever,
      sz: v.sz,
      json,
    });
  if (subAction === "stop")
    return cmdGridStop(client, {
      algoId: v.algoId!,
      algoOrdType: v.algoOrdType!,
      instId: v.instId!,
      stopType: v.stopType,
      json,
    });
}

export function handleBotCommand(
  client: OkxRestClient,
  action: string,
  rest: string[],
  v: CliValues,
  json: boolean
): Promise<void> | void {
  if (action === "grid") return handleBotGridCommand(client, v, rest, json);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  checkForUpdates("@okx_ai/okx-trade-cli", CLI_VERSION);

  const { values, positionals } = parseCli(process.argv.slice(2));

  if (values.help || positionals.length === 0) {
    printHelp();
    return;
  }

  const [module, action, ...rest] = positionals;
  const v = values;
  const json = v.json ?? false;

  if (module === "config") return handleConfigCommand(action, rest, json);
  if (module === "setup") return handleSetupCommand(v);

  const config = loadProfileConfig({ profile: v.profile, demo: v.demo, userAgent: `okx-trade-cli/${CLI_VERSION}` });
  const client = new OkxRestClient(config);

  if (module === "market") return handleMarketCommand(client, action, rest, v, json);
  if (module === "account") return handleAccountCommand(client, action, rest, v, json);
  if (module === "spot") return handleSpotCommand(client, action, rest, v, json);
  if (module === "swap") return handleSwapCommand(client, action, rest, v, json);
  if (module === "futures") return handleFuturesCommand(client, action, rest, v, json);
  if (module === "bot") return handleBotCommand(client, action, rest, v, json);

  process.stderr.write(`Unknown command: ${module} ${action ?? ""}\n`);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  const payload = toToolErrorPayload(error);
  process.stderr.write(`Error: ${payload.message}\n`);
  if (payload.traceId) process.stderr.write(`TraceId: ${payload.traceId}\n`);
  if (payload.suggestion) process.stderr.write(`Hint: ${payload.suggestion}\n`);
  process.stderr.write(`Version: @okx_ai/okx-trade-cli@${CLI_VERSION}\n`);
  process.exitCode = 1;
});
