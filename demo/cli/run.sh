#!/bin/bash
# 人类可读的技术分析输出
# 用法:
#   ./run.sh                  # 默认 BTC-USDT, 1H
#   ./run.sh ETH-USDT         # 指定币种
#   ./run.sh BTC-USDT 4H      # 指定币种 + 周期

INST=${1:-BTC-USDT}
BAR=${2:-1H}
LIMIT=300

echo "正在获取 $INST $BAR K线数据..."

okx market candles "$INST" --bar "$BAR" --limit "$LIMIT" --json \
  | python3 "$(dirname "$0")/analyze.py" --inst "$INST" --bar "$BAR"
