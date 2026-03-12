import type { ToolSpec } from "./types.js";
import {
  asRecord,
  compactObject,
  readNumber,
  readString,
  requireString,
} from "./helpers.js";
import { privateRateLimit } from "./common.js";

const BASE = "/api/v5/copytrading";

/** lastDays: "1"=7d, "2"=30d, "3"=90d, "4"=365d */
const LAST_DAYS_30 = "2";

function normalize(response: {
  endpoint: string;
  requestTime: string;
  data: unknown;
}): Record<string, unknown> {
  return {
    endpoint: response.endpoint,
    requestTime: response.requestTime,
    data: response.data,
  };
}

export function registerCopyTradeTools(): ToolSpec[] {
  return [
    {
      name: "copytrading_public_lead_traders",
      module: "copytrading",
      description:
        "Get top lead traders ranking. Public endpoint, no auth required. Use for: 交易员排行, 带单员推荐, top traders.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          instType: { type: "string", enum: ["SPOT", "SWAP"], description: "SWAP (default) or SPOT" },
          sortType: { type: "string", enum: ["overview", "pnl", "aum", "win_ratio", "pnl_ratio"], description: "Sort by: overview (default), pnl, aum, win_ratio, pnl_ratio" },
          state: { type: "string", enum: ["0", "1"], description: "0=all traders (default), 1=only traders with open slots" },
          minLeadDays: { type: "string", enum: ["1", "2", "3", "4"], description: "Min lead trading days: 1=7d, 2=30d, 3=90d, 4=180d" },
          minAssets: { type: "string", description: "Min trader assets (USDT)" },
          maxAssets: { type: "string", description: "Max trader assets (USDT)" },
          minAum: { type: "string", description: "Min AUM / copy trading scale (USDT)" },
          maxAum: { type: "string", description: "Max AUM / copy trading scale (USDT)" },
          page: { type: "string", description: "Page number for pagination" },
          dataVer: { type: "string", description: "Ranking data version (14-digit, e.g. 20231010182400). Use when paginating to keep consistent results." },
          limit: { type: "number", description: "Max results per page (default 10, max 20)" },
        },
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.publicGet(
          `${BASE}/public-lead-traders`,
          compactObject({
            instType: readString(args, "instType") ?? "SWAP",
            sortType: readString(args, "sortType") ?? "overview",
            state: readString(args, "state"),
            minLeadDays: readString(args, "minLeadDays"),
            minAssets: readString(args, "minAssets"),
            maxAssets: readString(args, "maxAssets"),
            minAum: readString(args, "minAum"),
            maxAum: readString(args, "maxAum"),
            page: readString(args, "page"),
            dataVer: readString(args, "dataVer"),
            limit: String(readNumber(args, "limit") ?? 10),
          }),
        );
        const raw = response as unknown as Record<string, unknown>;
        const dataArr = Array.isArray(raw.data) ? raw.data as Record<string, unknown>[] : [];
        const first = dataArr[0] ?? {};
        return {
          endpoint: String(raw.endpoint ?? ""),
          requestTime: String(raw.requestTime ?? ""),
          dataVer: String(first["dataVer"] ?? ""),
          totalPage: String(first["totalPage"] ?? ""),
          data: (first["ranks"] as unknown[]) ?? [],
        };
      },
    },
    {
      name: "copytrading_public_trader_detail",
      module: "copytrading",
      description:
        "Get full profile of a specific lead trader: daily P&L, statistics (win rate, position stats, follower P&L), and preferred trading currencies. All returned together. Public endpoint, no auth required.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          uniqueCode: { type: "string", description: "Lead trader unique code (16 chars)" },
          instType: { type: "string", enum: ["SPOT", "SWAP"] },
          lastDays: { type: "string", enum: ["1", "2", "3", "4"], description: "Time range for pnl and stats: 1=7d 2=30d 3=90d 4=365d (default: 2)" },
        },
        required: ["uniqueCode"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const uniqueCode = requireString(args, "uniqueCode");
        const instType = readString(args, "instType") ?? "SWAP";
        const lastDays = readString(args, "lastDays") ?? LAST_DAYS_30;

        const [pnlRes, statsRes, preferenceRes] = await Promise.all([
          context.client.publicGet(
            `${BASE}/public-pnl`,
            compactObject({ uniqueCode, instType, lastDays }),
          ),
          context.client.publicGet(
            `${BASE}/public-stats`,
            compactObject({ uniqueCode, instType, lastDays }),
          ),
          context.client.publicGet(
            `${BASE}/public-preference-currency`,
            compactObject({ uniqueCode, instType }),
          ),
        ]);

        return {
          pnl: normalize(pnlRes).data,
          stats: normalize(statsRes).data,
          preference: normalize(preferenceRes).data,
        };
      },
    },
    {
      name: "copytrading_my_status",
      module: "copytrading",
      description:
        "Query the lead traders I am currently copying, including cumulative P&L per trader. Private. Rate limit: 5/2s.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          instType: { type: "string", enum: ["SPOT", "SWAP"] },
        },
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.privateGet(
          `${BASE}/current-lead-traders`,
          compactObject({ instType: readString(args, "instType") ?? "SWAP" }),
          privateRateLimit("copytrading_my_status", 5),
        );
        return normalize(response);
      },
    },
    {
      name: "copytrading_set_copy_trading",
      module: "copytrading",
      description:
        "Start copy trading a lead trader for the first time. [CAUTION] Allocates real funds. Private. Rate limit: 5/2s.",
      isWrite: true,
      inputSchema: {
        type: "object",
        properties: {
          uniqueCode: { type: "string", description: "Lead trader unique code (16 chars)" },
          copyTotalAmt: { type: "string", description: "Max total USDT to allocate for this trader" },
          copyMgnMode: { type: "string", enum: ["cross", "isolated", "copy"], description: "Margin mode: cross/isolated/copy(follow trader). Default: isolated" },
          copyInstIdType: { type: "string", enum: ["copy", "custom"], description: "Instrument selection: copy=follow trader's instruments (default), custom=user-defined (instId required)" },
          instId: { type: "string", description: "Comma-separated instrument IDs, required when copyInstIdType=custom, e.g. BTC-USDT-SWAP,ETH-USDT-SWAP" },
          copyMode: { type: "string", enum: ["fixed_amount", "ratio_copy"], description: "Copy mode: fixed_amount (copyAmt required, default) or ratio_copy (copyRatio required)" },
          copyAmt: { type: "string", description: "Fixed USDT per order, required when copyMode=fixed_amount" },
          copyRatio: { type: "string", description: "Copy ratio, required when copyMode=ratio_copy" },
          subPosCloseType: { type: "string", enum: ["copy_close", "market_close", "manual_close"], description: "How to handle open positions when stopping copy: copy_close (default), market_close, manual_close" },
          tpRatio: { type: "string", description: "Take-profit ratio per order, e.g. 0.1 = 10%" },
          slRatio: { type: "string", description: "Stop-loss ratio per order, e.g. 0.1 = 10%" },
          slTotalAmt: { type: "string", description: "Total stop-loss amount (USDT). Auto-stop copy trading when net loss reaches this amount" },
          instType: { type: "string", enum: ["SPOT", "SWAP"] },
        },
        required: ["uniqueCode", "copyTotalAmt"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.privatePost(
          `${BASE}/first-copy-settings`,
          compactObject({
            instType: readString(args, "instType") ?? "SWAP",
            uniqueCode: requireString(args, "uniqueCode"),
            copyMgnMode: readString(args, "copyMgnMode") ?? "isolated",
            copyInstIdType: readString(args, "copyInstIdType") ?? "copy",
            instId: readString(args, "instId"),
            copyMode: readString(args, "copyMode") ?? "fixed_amount",
            copyTotalAmt: requireString(args, "copyTotalAmt"),
            copyAmt: readString(args, "copyAmt"),
            copyRatio: readString(args, "copyRatio"),
            subPosCloseType: readString(args, "subPosCloseType") ?? "copy_close",
            tpRatio: readString(args, "tpRatio"),
            slRatio: readString(args, "slRatio"),
            slTotalAmt: readString(args, "slTotalAmt"),
            tag: context.config.sourceTag,
          }),
          privateRateLimit("copytrading_set_copy_trading", 5),
        );
        return normalize(response);
      },
    },
    {
      name: "copytrading_stop_copy_trader",
      module: "copytrading",
      description:
        "Stop copy trading a lead trader. [CAUTION] Can close all positions. Private. Rate limit: 5/2s.",
      isWrite: true,
      inputSchema: {
        type: "object",
        properties: {
          uniqueCode: { type: "string", description: "Lead trader unique code" },
          subPosCloseType: { type: "string", enum: ["market_close", "copy_close", "manual_close"], description: "market_close=close all now, copy_close=follow trader, manual_close=keep open" },
          instType: { type: "string", enum: ["SPOT", "SWAP"] },
        },
        required: ["uniqueCode"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.privatePost(
          `${BASE}/stop-copy-trading`,
          compactObject({
            instType: readString(args, "instType") ?? "SWAP",
            uniqueCode: requireString(args, "uniqueCode"),
            subPosCloseType: readString(args, "subPosCloseType"),
          }),
          privateRateLimit("copytrading_stop_copy_trader", 5),
        );
        return normalize(response);
      },
    },
  ];
}
