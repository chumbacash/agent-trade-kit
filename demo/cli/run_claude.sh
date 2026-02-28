#!/bin/bash
# 多周期信号 + 账户余额 → Claude 综合判断 + 仓位建议
# 用法:
#   ./run_claude.sh                  # 默认 BTC-USDT, 1H
#   ./run_claude.sh ETH-USDT         # 指定币种
#   ./run_claude.sh BTC-USDT 4H      # 指定周期（自动匹配更高周期）

INST=${1:-BTC-USDT}
BAR=${2:-1H}
LIMIT=300
DIR="$(dirname "$0")"

# 自动匹配大周期
case $BAR in
  15m) HIGHER_BAR="1H"  ;;
  30m) HIGHER_BAR="4H"  ;;
  1H)  HIGHER_BAR="4H"  ;;
  4H)  HIGHER_BAR="1D"  ;;
  *)   HIGHER_BAR="4H"  ;;
esac

echo "正在获取 $INST $BAR / $HIGHER_BAR 信号及账户余额..."

# 小周期信号
SIGNALS_LOW=$(okx market candles "$INST" --bar "$BAR" --limit "$LIMIT" --json \
  | python3 "$DIR/analyze.py" --inst "$INST" --bar "$BAR" --for-claude)

# 大周期信号
SIGNALS_HIGH=$(okx market candles "$INST" --bar "$HIGHER_BAR" --limit "$LIMIT" --json \
  | python3 "$DIR/analyze.py" --inst "$INST" --bar "$HIGHER_BAR" --for-claude)

# 账户余额（需要 API key，失败时跳过）
BALANCE=$(okx account balance --json 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    details = data[0].get('details', []) if data else []
    usdt = next((d for d in details if d['ccy'] == 'USDT'), None)
    if usdt:
        print(f\"账户可用 USDT: {float(usdt['availEq']):,.2f}\")
    else:
        print('账户余额: 未获取')
except:
    print('账户余额: 未获取')
" 2>/dev/null)

# 组合上下文
CONTEXT="=== $INST $BAR 信号（短周期）===
$SIGNALS_LOW

=== $INST $HIGHER_BAR 信号（大周期趋势）===
$SIGNALS_HIGH

=== 账户 ===
$BALANCE"

PROMPT="你是一名量化交易分析师，擅长多周期共振判断。
基于以下信号，给出：
1. 结论：做多 / 观望 / 做空
2. 理由：两个周期信号是否共振，逻辑推理（3句以内）
3. 仓位建议：基于账户余额建议投入比例和金额（保守 10-20%，激进不超过 30%）"

echo "$CONTEXT" | claude -p "$PROMPT"
