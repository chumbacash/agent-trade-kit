import type { OkxRestClient } from "@okx-hub/core";
import { printJson, printTable } from "../formatter.js";

export async function cmdAccountBalance(
  client: OkxRestClient,
  ccy: string | undefined,
  json: boolean,
): Promise<void> {
  const params: Record<string, unknown> = {};
  if (ccy) params["ccy"] = ccy;
  const res = await client.privateGet("/api/v5/account/balance", params);
  const data = res.data as Record<string, unknown>[];
  if (json) return printJson(data);
  const details = (data?.[0]?.["details"] as Record<string, unknown>[]) ?? [];
  printTable(
    details
      .filter((d) => Number(d["eq"]) > 0)
      .map((d) => ({
        currency: d["ccy"],
        equity: d["eq"],
        available: d["availEq"],
        frozen: d["frozenBal"],
      })),
  );
}
