import type { RateLimitConfig } from "../utils/rate-limiter.js";

export const OKX_CANDLE_BARS = [
  "1m", "3m", "5m", "15m", "30m",
  "1H", "2H", "4H", "6H", "12H",
  "1D", "2D", "3D", "1W", "1M", "3M",
] as const;

export const OKX_INST_TYPES = [
  "SPOT", "SWAP", "FUTURES", "OPTION", "MARGIN",
] as const;

export function publicRateLimit(key: string, rps = 20): RateLimitConfig {
  return {
    key: `public:${key}`,
    capacity: rps,
    refillPerSecond: rps,
  };
}

export function privateRateLimit(key: string, rps = 10): RateLimitConfig {
  return {
    key: `private:${key}`,
    capacity: rps,
    refillPerSecond: rps,
  };
}
