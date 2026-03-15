/**
 * Spot Recurring Buy (现货定投) MCP tools.
 *
 * Base path: /api/v5/tradingBot/recurring
 * algoOrdType: "recurring"
 *
 * ROLLBACK NOTE: This entire file can be deleted to remove Spot Recurring Buy
 * support. Also remove the import from ./index.ts and the "bot.recurring"
 * entry from constants.ts BOT_SUB_MODULE_IDS.
 */
import type { ToolSpec } from "../types.js";
import {
  asRecord,
  compactObject,
  normalizeResponse,
  readNumber,
  readString,
  requireString,
} from "../helpers.js";
import { privateRateLimit } from "../common.js";
import { OkxApiError } from "../../utils/errors.js";

const BASE = "/api/v5/tradingBot/recurring";

/** For write operations: surface any inner sCode/sMsg errors from data items. */
function normalizeWrite(response: {
  endpoint: string;
  requestTime: string;
  data: unknown;
}): Record<string, unknown> {
  const data = response.data;
  if (Array.isArray(data) && data.length > 0) {
    const failed = data.filter(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        "sCode" in (item as object) &&
        (item as Record<string, unknown>)["sCode"] !== "0",
    ) as Record<string, unknown>[];
    if (failed.length > 0) {
      const messages = failed.map(
        (item) => `[${item["sCode"]}] ${item["sMsg"] ?? "Operation failed"}`,
      );
      throw new OkxApiError(messages.join("; "), {
        code: String(failed[0]!["sCode"] ?? ""),
        endpoint: response.endpoint,
      });
    }
  }
  return {
    endpoint: response.endpoint,
    requestTime: response.requestTime,
    data,
  };
}

export function registerRecurringTools(): ToolSpec[] {
  return [
    {
      name: "recurring_create_order",
      module: "bot.recurring",
      description:
        "Create a Spot Recurring Buy (定投) order. " +
        "Required: stgyName, recurringList (JSON array of {ccy, ratio}), period, recurringDay, recurringTime, recurringHour, timeZone, amt, investmentCcy, tdMode. " +
        "[CAUTION] Executes real trades.",
      isWrite: true,
      inputSchema: {
        type: "object",
        properties: {
          stgyName: { type: "string", description: "Strategy name, e.g. 'My BTC DCA'" },
          recurringList: {
            type: "string",
            description: "JSON array of coins with ratio, e.g. '[{\"ccy\":\"BTC\",\"ratio\":\"0.5\"},{\"ccy\":\"ETH\",\"ratio\":\"0.5\"}]'. Ratios must sum to 1.",
          },
          period: {
            type: "string",
            enum: ["hourly", "daily", "weekly", "monthly"],
            description: "Recurring period",
          },
          recurringDay: {
            type: "string",
            description: "Day of period. weekly: '1'-'7' (Mon-Sun); monthly: '1'-'28'; daily/hourly: ignored",
          },
          recurringTime: {
            type: "string",
            description: "Investment hour of day, integer 0-23, e.g. '8' for 8:00. For hourly, this is the start hour.",
          },
          recurringHour: {
            type: "string",
            description: "Hour interval for hourly period: '1','4','8','12'. Required when period='hourly'",
          },
          timeZone: {
            type: "string",
            description: "Timezone in UTC offset format, e.g. '8' for UTC+8",
          },
          amt: { type: "string", description: "Amount per recurring buy (in investmentCcy)" },
          investmentCcy: { type: "string", description: "Investment currency, e.g. 'USDT'" },
          tdMode: {
            type: "string",
            enum: ["cross", "cash"],
            description: "Trade mode: 'cross' (margin) or 'cash' (spot)",
          },
          tradeQuoteCcy: { type: "string", description: "Quote currency for trading, e.g. 'USDT'. Required when the trading pair supports multiple quote currencies (optional)" },
          algoClOrdId: { type: "string", description: "Client-assigned algo order ID (optional)" },
        },
        required: ["stgyName", "recurringList", "period", "recurringTime", "timeZone", "amt", "investmentCcy", "tdMode"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);

        // Parse and validate recurringList
        const recurringListStr = requireString(args, "recurringList");
        let recurringList: unknown[];
        try {
          recurringList = JSON.parse(recurringListStr) as unknown[];
        } catch {
          throw new Error("recurringList must be a valid JSON array, e.g. '[{\"ccy\":\"BTC\",\"ratio\":\"0.5\"}]'");
        }
        if (!Array.isArray(recurringList) || recurringList.length === 0) {
          throw new Error("recurringList must be a non-empty array");
        }

        const period = requireString(args, "period");
        if (period === "hourly" && !readString(args, "recurringHour")) {
          throw new Error("recurringHour is required when period='hourly'. Use '1', '4', '8', or '12'.");
        }

        const response = await context.client.privatePost(
          `${BASE}/order-algo`,
          compactObject({
            stgyName: requireString(args, "stgyName"),
            recurringList,
            period,
            recurringDay: readString(args, "recurringDay"),
            recurringTime: requireString(args, "recurringTime"),
            recurringHour: readString(args, "recurringHour"),
            timeZone: requireString(args, "timeZone"),
            amt: requireString(args, "amt"),
            investmentCcy: requireString(args, "investmentCcy"),
            tdMode: requireString(args, "tdMode"),
            tradeQuoteCcy: readString(args, "tradeQuoteCcy"),
            algoClOrdId: readString(args, "algoClOrdId"),
            tag: context.config.sourceTag,
          }),
          privateRateLimit("recurring_create_order", 20),
        );
        return normalizeWrite(response);
      },
    },
    {
      name: "recurring_amend_order",
      module: "bot.recurring",
      description:
        "Amend a running Spot Recurring Buy order. " +
        "Required: algoId, stgyName. Only the strategy name can be changed. " +
        "[CAUTION] Modifies a running recurring buy.",
      isWrite: true,
      inputSchema: {
        type: "object",
        properties: {
          algoId: { type: "string", description: "Recurring buy algo order ID" },
          stgyName: { type: "string", description: "New strategy name" },
        },
        required: ["algoId", "stgyName"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);

        const response = await context.client.privatePost(
          `${BASE}/amend-order-algo`,
          {
            algoId: requireString(args, "algoId"),
            stgyName: requireString(args, "stgyName"),
          },
          privateRateLimit("recurring_amend_order", 20),
        );
        return normalizeWrite(response);
      },
    },
    {
      name: "recurring_stop_order",
      module: "bot.recurring",
      description:
        "Stop a running Spot Recurring Buy order. [CAUTION] This will stop the recurring buy.",
      isWrite: true,
      inputSchema: {
        type: "object",
        properties: {
          algoId: { type: "string", description: "Recurring buy algo order ID" },
        },
        required: ["algoId"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const algoId = requireString(args, "algoId");

        const response = await context.client.privatePost(
          `${BASE}/stop-order-algo`,
          [{ algoId }],
          privateRateLimit("recurring_stop_order", 20),
        );
        return normalizeWrite(response);
      },
    },
    {
      name: "recurring_get_orders",
      module: "bot.recurring",
      description:
        "Query Spot Recurring Buy orders. status='active' for running; status='history' for stopped.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "history"],
            description: "active=running (default); history=stopped",
          },
          algoId: { type: "string", description: "Filter by algo order ID (optional)" },
          after: { type: "string", description: "Pagination cursor (optional)" },
          before: { type: "string", description: "Pagination cursor (optional)" },
          limit: { type: "number", description: "Max results (default 100)" },
        },
        required: [],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const status = readString(args, "status") ?? "active";

        const path = status === "history"
          ? `${BASE}/orders-algo-history`
          : `${BASE}/orders-algo-pending`;
        const response = await context.client.privateGet(
          path,
          compactObject({
            algoId: readString(args, "algoId"),
            after: readString(args, "after"),
            before: readString(args, "before"),
            limit: readNumber(args, "limit"),
          }),
          privateRateLimit("recurring_get_orders", 20),
        );
        return normalizeResponse(response);
      },
    },
    {
      name: "recurring_get_order_details",
      module: "bot.recurring",
      description:
        "Query details of a single Spot Recurring Buy order by algo ID.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          algoId: { type: "string", description: "Recurring buy algo order ID" },
        },
        required: ["algoId"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const algoId = requireString(args, "algoId");

        const response = await context.client.privateGet(
          `${BASE}/orders-algo-details`,
          { algoId },
          privateRateLimit("recurring_get_order_details", 20),
        );
        return normalizeResponse(response);
      },
    },
    {
      name: "recurring_get_sub_orders",
      module: "bot.recurring",
      description:
        "Query sub-orders (individual buy executions) of a Spot Recurring Buy order.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          algoId: { type: "string", description: "Recurring buy algo order ID" },
          ordId: { type: "string", description: "Filter by sub-order ID (optional)" },
          after: { type: "string", description: "Pagination cursor (optional)" },
          before: { type: "string", description: "Pagination cursor (optional)" },
          limit: { type: "number", description: "Max results (default 300, max 300)" },
        },
        required: ["algoId"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const algoId = requireString(args, "algoId");

        const response = await context.client.privateGet(
          `${BASE}/sub-orders`,
          compactObject({
            algoId,
            ordId: readString(args, "ordId"),
            after: readString(args, "after"),
            before: readString(args, "before"),
            limit: readNumber(args, "limit"),
          }),
          privateRateLimit("recurring_get_sub_orders", 20),
        );
        return normalizeResponse(response);
      },
    },
  ];
}
