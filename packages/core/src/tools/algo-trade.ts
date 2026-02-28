import type { ToolSpec } from "./types.js";
import {
  asRecord,
  compactObject,
  readNumber,
  readString,
  requireString,
} from "./helpers.js";
import { privateRateLimit } from "./common.js";

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

export function registerAlgoTradeTools(): ToolSpec[] {
  return [
    {
      name: "swap_place_algo_order",
      module: "swap",
      description:
        "Place a SWAP/FUTURES take-profit or stop-loss algo order. [CAUTION] Executes real trades. " +
        "Use ordType='conditional' for a single TP, single SL, or combined TP+SL on one order. " +
        "Use ordType='oco' (one-cancels-other) to place TP and SL simultaneously — whichever triggers first cancels the other. " +
        "Set tpOrdPx='-1' or slOrdPx='-1' to execute the closing leg as a market order. " +
        "Private endpoint. Rate limit: 20 req/s per UID.",
      isWrite: true,
      inputSchema: {
        type: "object",
        properties: {
          instId: {
            type: "string",
            description: "Instrument ID, e.g. BTC-USDT-SWAP.",
          },
          tdMode: {
            type: "string",
            enum: ["cross", "isolated"],
            description: "Trade mode: cross or isolated margin.",
          },
          side: {
            type: "string",
            enum: ["buy", "sell"],
            description:
              "Closing side: use 'sell' to close a long position, 'buy' to close a short position.",
          },
          posSide: {
            type: "string",
            enum: ["long", "short", "net"],
            description:
              "Position side. Use 'net' for one-way mode (default for most accounts). Use 'long' or 'short' only in hedge mode.",
          },
          ordType: {
            type: "string",
            enum: ["conditional", "oco"],
            description:
              "Algo order type. 'conditional': set TP only, SL only, or both TP+SL together. 'oco': set TP and SL as a pair — the first to trigger cancels the other.",
          },
          sz: {
            type: "string",
            description:
              "Number of contracts to close (e.g. '1'). Should match your open position size.",
          },
          tpTriggerPx: {
            type: "string",
            description:
              "Take-profit trigger price. When market reaches this price, the TP order is submitted. Required if setting a take-profit.",
          },
          tpOrdPx: {
            type: "string",
            description:
              "Take-profit order price. Set to '-1' for a market order when triggered. Required if tpTriggerPx is set.",
          },
          tpTriggerPxType: {
            type: "string",
            enum: ["last", "index", "mark"],
            description:
              "Price type for tpTriggerPx. 'last': last traded price (default). 'index': index price. 'mark': mark price.",
          },
          slTriggerPx: {
            type: "string",
            description:
              "Stop-loss trigger price. When market reaches this price, the SL order is submitted. Required if setting a stop-loss.",
          },
          slOrdPx: {
            type: "string",
            description:
              "Stop-loss order price. Set to '-1' for a market order when triggered (recommended to ensure execution). Required if slTriggerPx is set.",
          },
          slTriggerPxType: {
            type: "string",
            enum: ["last", "index", "mark"],
            description:
              "Price type for slTriggerPx. 'last': last traded price (default). 'index': index price. 'mark': mark price.",
          },
          reduceOnly: {
            type: "boolean",
            description:
              "Set true to ensure this order only reduces an existing position. Recommended for TP/SL orders.",
          },
          clOrdId: {
            type: "string",
            description: "Client-supplied order ID. Up to 32 characters.",
          },
        },
        required: ["instId", "tdMode", "side", "ordType", "sz"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const reduceOnly = args.reduceOnly;
        const response = await context.client.privatePost(
          "/api/v5/trade/order-algo",
          compactObject({
            instId: requireString(args, "instId"),
            tdMode: requireString(args, "tdMode"),
            side: requireString(args, "side"),
            posSide: readString(args, "posSide"),
            ordType: requireString(args, "ordType"),
            sz: requireString(args, "sz"),
            tpTriggerPx: readString(args, "tpTriggerPx"),
            tpOrdPx: readString(args, "tpOrdPx"),
            tpTriggerPxType: readString(args, "tpTriggerPxType"),
            slTriggerPx: readString(args, "slTriggerPx"),
            slOrdPx: readString(args, "slOrdPx"),
            slTriggerPxType: readString(args, "slTriggerPxType"),
            reduceOnly:
              typeof reduceOnly === "boolean" ? String(reduceOnly) : undefined,
            clOrdId: readString(args, "clOrdId"),
          }),
          privateRateLimit("swap_place_algo_order", 20),
        );
        return normalize(response);
      },
    },
    {
      name: "swap_cancel_algo_orders",
      module: "swap",
      description:
        "Cancel one or more pending SWAP/FUTURES algo orders (TP/SL). " +
        "Accepts a list of {algoId, instId} objects. Private endpoint. Rate limit: 20 req/s per UID.",
      isWrite: true,
      inputSchema: {
        type: "object",
        properties: {
          orders: {
            type: "array",
            description:
              "List of algo orders to cancel. Each item must have algoId and instId.",
            items: {
              type: "object",
              properties: {
                algoId: {
                  type: "string",
                  description: "Algo order ID to cancel.",
                },
                instId: {
                  type: "string",
                  description: "Instrument ID, e.g. BTC-USDT-SWAP.",
                },
              },
              required: ["algoId", "instId"],
            },
          },
        },
        required: ["orders"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const orders = args.orders;
        if (!Array.isArray(orders) || orders.length === 0) {
          throw new Error("orders must be a non-empty array.");
        }
        const response = await context.client.privatePost(
          "/api/v5/trade/cancel-algos",
          orders,
          privateRateLimit("swap_cancel_algo_orders", 20),
        );
        return normalize(response);
      },
    },
    {
      name: "swap_get_algo_orders",
      module: "swap",
      description:
        "Query pending or completed SWAP/FUTURES algo orders (TP/SL, OCO). Private endpoint. Rate limit: 20 req/s.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "history"],
            description:
              "Query pending (active) algo orders or completed history. Default: 'pending'.",
          },
          ordType: {
            type: "string",
            enum: ["conditional", "oco"],
            description: "Filter by algo order type.",
          },
          instId: {
            type: "string",
            description: "Instrument ID filter, e.g. BTC-USDT-SWAP.",
          },
          algoId: {
            type: "string",
            description: "Filter by specific algo order ID.",
          },
          after: {
            type: "string",
            description: "Pagination: orders earlier than this algo order ID.",
          },
          before: {
            type: "string",
            description: "Pagination: orders newer than this algo order ID.",
          },
          limit: {
            type: "number",
            description: "Number of results, default 100, max 100.",
          },
        },
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const status = readString(args, "status") ?? "pending";
        const path =
          status === "history"
            ? "/api/v5/trade/orders-algo-history"
            : "/api/v5/trade/orders-algo-pending";
        const response = await context.client.privateGet(
          path,
          compactObject({
            instType: "SWAP",
            ordType: readString(args, "ordType"),
            instId: readString(args, "instId"),
            algoId: readString(args, "algoId"),
            after: readString(args, "after"),
            before: readString(args, "before"),
            limit: readNumber(args, "limit"),
          }),
          privateRateLimit("swap_get_algo_orders", 20),
        );
        return normalize(response);
      },
    },
  ];
}
