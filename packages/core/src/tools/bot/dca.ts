import type { ToolSpec } from "../types.js";
import {
  asRecord,
  compactObject,
  readNumber,
  readString,
  requireString,
} from "../helpers.js";
import { privateRateLimit } from "../common.js";

const BASE = "/api/v5/tradingBot/dca";

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

export function registerDcaTools(): ToolSpec[] {
  return [
    {
      name: "dca_create_order",
      module: "bot.dca",
      description:
        "Create a new DCA (Dollar-Cost Averaging) bot order. [CAUTION] Executes real trades. " +
        "Private endpoint. Rate limit: 20 req/2s per UID.",
      isWrite: true,
      inputSchema: {
        type: "object",
        properties: {
          instId: { type: "string", description: "e.g. BTC-USDT" },
          investmentAmount: { type: "string", description: "Amount per cycle" },
          investmentCcy: { type: "string", description: "Investment currency, e.g. USDT" },
          recurringDay: { type: "string", description: "Recurring day" },
          recurringTime: { type: "string", description: "Recurring time (0~23)" },
          timeZone: { type: "string", description: "UTC timezone offset, e.g. 8" },
          maxPx: { type: "string", description: "Upper price limit" },
          minPx: { type: "string", description: "Lower price limit" },
        },
        required: ["instId", "investmentAmount", "investmentCcy"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.privatePost(
          `${BASE}/order-algo`,
          compactObject({
            instId: requireString(args, "instId"),
            investmentAmount: requireString(args, "investmentAmount"),
            investmentCcy: requireString(args, "investmentCcy"),
            recurringDay: readString(args, "recurringDay"),
            recurringTime: readString(args, "recurringTime"),
            timeZone: readString(args, "timeZone"),
            maxPx: readString(args, "maxPx"),
            minPx: readString(args, "minPx"),
          }),
          privateRateLimit("dca_create_order", 20),
        );
        return normalize(response);
      },
    },
    {
      name: "dca_stop_order",
      module: "bot.dca",
      description:
        "Stop a running DCA bot. [CAUTION] This will stop the bot. " +
        "Private endpoint. Rate limit: 20 req/2s per UID.",
      isWrite: true,
      inputSchema: {
        type: "object",
        properties: {
          algoId: { type: "string" },
        },
        required: ["algoId"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.privatePost(
          `${BASE}/stop-order-algo`,
          [{ algoId: requireString(args, "algoId") }],
          privateRateLimit("dca_stop_order", 20),
        );
        return normalize(response);
      },
    },
    {
      name: "dca_get_orders",
      module: "bot.dca",
      description:
        "Query DCA bot orders. Use status='active' for running bots, status='history' for completed/stopped. " +
        "Private endpoint. Rate limit: 20 req/2s per UID.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "history"],
            description: "active=running (default); history=stopped",
          },
          algoId: { type: "string" },
          after: { type: "string", description: "Pagination: before this algo ID" },
          before: { type: "string", description: "Pagination: after this algo ID" },
          limit: { type: "number", description: "Max results (default 100)" },
        },
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const status = readString(args, "status") ?? "active";
        const path =
          status === "history"
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
          privateRateLimit("dca_get_orders", 20),
        );
        return normalize(response);
      },
    },
    {
      name: "dca_get_order_details",
      module: "bot.dca",
      description:
        "Query details of a single DCA bot by algo ID. " +
        "Private endpoint. Rate limit: 20 req/2s per UID.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          algoId: { type: "string" },
        },
        required: ["algoId"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.privateGet(
          `${BASE}/orders-algo-details`,
          { algoId: requireString(args, "algoId") },
          privateRateLimit("dca_get_order_details", 20),
        );
        return normalize(response);
      },
    },
    {
      name: "dca_get_sub_orders",
      module: "bot.dca",
      description:
        "Query sub-orders generated by a DCA bot. " +
        "Private endpoint. Rate limit: 20 req/2s per UID.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          algoId: { type: "string" },
          after: { type: "string", description: "Pagination: before this order ID" },
          before: { type: "string", description: "Pagination: after this order ID" },
          limit: { type: "number", description: "Max results (default 100)" },
        },
        required: ["algoId"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.privateGet(
          `${BASE}/sub-orders`,
          compactObject({
            algoId: requireString(args, "algoId"),
            after: readString(args, "after"),
            before: readString(args, "before"),
            limit: readNumber(args, "limit"),
          }),
          privateRateLimit("dca_get_sub_orders", 20),
        );
        return normalize(response);
      },
    },
  ];
}
