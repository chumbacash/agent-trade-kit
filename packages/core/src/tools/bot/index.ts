import type { ToolSpec } from "../types.js";
import { registerGridTools } from "./grid.js";
import { registerDcaTools } from "./dca.js";
import { registerTwapTools } from "./twap.js";
import { registerRecurringTools } from "./recurring.js";

export function registerBotTools(): ToolSpec[] {
  return [
    ...registerGridTools(),
    ...registerDcaTools(),
    ...registerTwapTools(),
    ...registerRecurringTools(),
  ];
}
