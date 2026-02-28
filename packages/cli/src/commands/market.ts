import type { OkxRestClient } from "@okx-hub/core";
import { printJson, printKv, printTable } from "../formatter.js";

export async function cmdMarketTicker(
  client: OkxRestClient,
  instId: string,
  json: boolean,
): Promise<void> {
  const res = await client.publicGet("/api/v5/market/ticker", { instId });
  const items = res.data as Record<string, unknown>[];
  if (json) return printJson(items);
  if (!items?.length) { process.stdout.write("No data\n"); return; }
  const t = items[0];
  printKv({
    instId: t["instId"],
    last: t["last"],
    "24h change %": t["sodUtc8"],
    "24h high": t["high24h"],
    "24h low": t["low24h"],
    "24h vol": t["vol24h"],
    time: new Date(Number(t["ts"])).toLocaleString(),
  });
}

export async function cmdMarketTickers(
  client: OkxRestClient,
  instType: string,
  json: boolean,
): Promise<void> {
  const res = await client.publicGet("/api/v5/market/tickers", { instType });
  const items = res.data as Record<string, unknown>[];
  if (json) return printJson(items);
  printTable(
    (items ?? []).map((t) => ({
      instId: t["instId"],
      last: t["last"],
      "24h high": t["high24h"],
      "24h low": t["low24h"],
      "24h vol": t["vol24h"],
    })),
  );
}

export async function cmdMarketOrderbook(
  client: OkxRestClient,
  instId: string,
  sz: number | undefined,
  json: boolean,
): Promise<void> {
  const params: Record<string, unknown> = { instId };
  if (sz !== undefined) params["sz"] = String(sz);
  const res = await client.publicGet("/api/v5/market/books", params);
  if (json) return printJson(res.data);
  const book = (res.data as Record<string, unknown>[])[0];
  if (!book) { process.stdout.write("No data\n"); return; }
  const asks = (book["asks"] as string[][]).slice(0, 5);
  const bids = (book["bids"] as string[][]).slice(0, 5);
  process.stdout.write("Asks (price / size):\n");
  for (const [p, s] of asks.reverse()) process.stdout.write(`  ${p.padStart(16)}  ${s}\n`);
  process.stdout.write("Bids (price / size):\n");
  for (const [p, s] of bids) process.stdout.write(`  ${p.padStart(16)}  ${s}\n`);
}

export async function cmdMarketCandles(
  client: OkxRestClient,
  instId: string,
  opts: { bar?: string; limit?: number; json: boolean },
): Promise<void> {
  const params: Record<string, unknown> = { instId };
  if (opts.bar) params["bar"] = opts.bar;
  if (opts.limit) params["limit"] = String(opts.limit);
  const res = await client.publicGet("/api/v5/market/candles", params);
  const candles = res.data as string[][];
  if (opts.json) return printJson(candles);
  printTable(
    (candles ?? []).map(([ts, o, h, l, c, vol]) => ({
      time: new Date(Number(ts)).toLocaleString(),
      open: o, high: h, low: l, close: c, vol,
    })),
  );
}
