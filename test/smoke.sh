#!/usr/bin/env bash
# test/smoke.sh — 冒烟测试：验证公开行情 API 可正常调用（无需认证）
# 用法: ./test/smoke.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="node $SCRIPT_DIR/../packages/cli/dist/index.js"
PASS=0
FAIL=0

run_test() {
  local desc="$1"
  shift
  if output=$("$@" 2>&1); then
    echo "  ✅  $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌  $desc"
    echo "      $output"
    FAIL=$((FAIL + 1))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  okx_hub smoke tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "▶ market"
run_test "ticker BTC-USDT"       $CLI market ticker BTC-USDT
run_test "ticker ETH-USDT"       $CLI market ticker ETH-USDT
run_test "tickers SPOT (json)"   $CLI --json market tickers SPOT
run_test "orderbook BTC-USDT"    $CLI market orderbook BTC-USDT
run_test "candles BTC-USDT"      $CLI market candles BTC-USDT --bar 1H --limit 3

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  passed: $PASS  failed: $FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ "$FAIL" -eq 0 ]
