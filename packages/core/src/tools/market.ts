import type { ToolSpec } from "./types.js";
import { asRecord, compactObject, readNumber, readString, requireString } from "./helpers.js";
import { publicRateLimit, OKX_CANDLE_BARS, OKX_INST_TYPES } from "./common.js";

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

export function registerMarketTools(): ToolSpec[] {
  return [
    {
      name: "market_get_ticker",
      module: "market",
      description:
        "Get ticker data for a single instrument. Public endpoint, no authentication required. Rate limit: 20 req/s.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          instId: {
            type: "string",
            description: "Instrument ID, e.g. BTC-USDT, BTC-USDT-SWAP.",
          },
        },
        required: ["instId"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.publicGet(
          "/api/v5/market/ticker",
          { instId: requireString(args, "instId") },
          publicRateLimit("market_get_ticker", 20),
        );
        return normalize(response);
      },
    },
    {
      name: "market_get_tickers",
      module: "market",
      description:
        "Get ticker data for all instruments of a given type. Public endpoint, no authentication required. Rate limit: 20 req/s.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          instType: {
            type: "string",
            enum: [...OKX_INST_TYPES],
            description: "Instrument type: SPOT, SWAP, FUTURES, OPTION, MARGIN.",
          },
          uly: {
            type: "string",
            description: "Underlying, e.g. BTC-USD. Required for OPTION.",
          },
          instFamily: {
            type: "string",
            description: "Instrument family, e.g. BTC-USD.",
          },
        },
        required: ["instType"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.publicGet(
          "/api/v5/market/tickers",
          compactObject({
            instType: requireString(args, "instType"),
            uly: readString(args, "uly"),
            instFamily: readString(args, "instFamily"),
          }),
          publicRateLimit("market_get_tickers", 20),
        );
        return normalize(response);
      },
    },
    {
      name: "market_get_orderbook",
      module: "market",
      description:
        "Get the order book (bids/asks) for an instrument. Public endpoint, no authentication required. Rate limit: 20 req/s.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          instId: {
            type: "string",
            description: "Instrument ID, e.g. BTC-USDT.",
          },
          sz: {
            type: "number",
            description: "Order book depth per side. Default 1, max 400.",
          },
        },
        required: ["instId"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.publicGet(
          "/api/v5/market/books",
          compactObject({
            instId: requireString(args, "instId"),
            sz: readNumber(args, "sz"),
          }),
          publicRateLimit("market_get_orderbook", 20),
        );
        return normalize(response);
      },
    },
    {
      name: "market_get_candles",
      module: "market",
      description:
        "Get candlestick (OHLCV) data for an instrument. Public endpoint, no authentication required. Rate limit: 40 req/s.",
      isWrite: false,
      inputSchema: {
        type: "object",
        properties: {
          instId: {
            type: "string",
            description: "Instrument ID, e.g. BTC-USDT.",
          },
          bar: {
            type: "string",
            enum: [...OKX_CANDLE_BARS],
            description: "Bar size. Default 1m.",
          },
          after: {
            type: "string",
            description: "Pagination: return records earlier than this timestamp (ms).",
          },
          before: {
            type: "string",
            description: "Pagination: return records newer than this timestamp (ms).",
          },
          limit: {
            type: "number",
            description: "Number of results, default 100, max 300.",
          },
        },
        required: ["instId"],
      },
      handler: async (rawArgs, context) => {
        const args = asRecord(rawArgs);
        const response = await context.client.publicGet(
          "/api/v5/market/candles",
          compactObject({
            instId: requireString(args, "instId"),
            bar: readString(args, "bar"),
            after: readString(args, "after"),
            before: readString(args, "before"),
            limit: readNumber(args, "limit"),
          }),
          publicRateLimit("market_get_candles", 40),
        );
        return normalize(response);
      },
    },
  ];
}
