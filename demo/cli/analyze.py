#!/usr/bin/env python3
"""
OKX 技术分析脚本 - 通过 pipe 接收 candles JSON，输出交易信号摘要

用法:
  okx market candles BTC-USDT --bar 1H --limit 200 --json | python3 analyze.py
  okx market candles BTC-USDT --bar 1H --limit 200 --json | python3 analyze.py --inst BTC-USDT
"""

import json
import sys
import math
import argparse
from datetime import datetime


# ── 指标计算 ────────────────────────────────────────────────────────────────

def ema(values: list[float], period: int) -> list[float]:
    k = 2 / (period + 1)
    result = [None] * len(values)
    result[period - 1] = sum(values[:period]) / period
    for i in range(period, len(values)):
        result[i] = values[i] * k + result[i - 1] * (1 - k)
    return result


def sma(values: list[float], period: int) -> list[float | None]:
    result = [None] * len(values)
    for i in range(period - 1, len(values)):
        result[i] = sum(values[i - period + 1:i + 1]) / period
    return result


def calculate_rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def calculate_macd(closes: list[float], fast=12, slow=26, signal=9):
    if len(closes) < slow + signal:
        return None, None, None
    ema_fast = ema(closes, fast)
    ema_slow = ema(closes, slow)
    macd_line = [
        (ema_fast[i] - ema_slow[i]) if ema_fast[i] is not None and ema_slow[i] is not None else None
        for i in range(len(closes))
    ]
    valid_macd = [v for v in macd_line if v is not None]
    if len(valid_macd) < signal:
        return None, None, None
    signal_start = next(i for i, v in enumerate(macd_line) if v is not None)
    signal_line_vals = ema(valid_macd, signal)
    signal_line = [None] * signal_start + [None] * (signal - 1) + signal_line_vals[signal - 1:]
    signal_line = signal_line[:len(closes)]
    last_macd = next((v for v in reversed(macd_line) if v is not None), None)
    last_signal = next((v for v in reversed(signal_line) if v is not None), None)
    last_hist = (last_macd - last_signal) if last_macd is not None and last_signal is not None else None
    return last_macd, last_signal, last_hist


def calculate_ma(closes: list[float], period: int) -> float | None:
    vals = sma(closes, period)
    return next((v for v in reversed(vals) if v is not None), None)


def calculate_bb(closes: list[float], period: int = 20, mult: float = 2.0):
    if len(closes) < period:
        return None, None, None
    window = closes[-period:]
    mid = sum(window) / period
    variance = sum((x - mid) ** 2 for x in window) / period
    std = math.sqrt(variance)
    return mid + mult * std, mid, mid - mult * std


def calculate_atr(highs: list[float], lows: list[float], closes: list[float], period: int = 14) -> float | None:
    """平均真实波幅 ATR"""
    if len(closes) < period + 1:
        return None
    trs = []
    for i in range(1, len(closes)):
        hl = highs[i] - lows[i]
        hc = abs(highs[i] - closes[i - 1])
        lc = abs(lows[i] - closes[i - 1])
        trs.append(max(hl, hc, lc))
    # Wilder 平滑（与 RSI 一致）
    atr = sum(trs[:period]) / period
    for i in range(period, len(trs)):
        atr = (atr * (period - 1) + trs[i]) / period
    return atr


def calculate_stoch_rsi(closes: list[float], rsi_period: int = 14, stoch_period: int = 14, smooth_k: int = 3, smooth_d: int = 3) -> tuple[float, float] | None:
    """
    Stochastic RSI，返回 (K, D)，范围 0~100
    K 从下方穿越 D（金叉）：看多
    K 从上方穿越 D（死叉）：看空
    """
    if len(closes) < rsi_period + stoch_period + smooth_k + smooth_d:
        return None
    gains, losses = [], []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    avg_gain = sum(gains[:rsi_period]) / rsi_period
    avg_loss = sum(losses[:rsi_period]) / rsi_period
    rsi_vals = []
    for i in range(rsi_period, len(gains)):
        avg_gain = (avg_gain * (rsi_period - 1) + gains[i]) / rsi_period
        avg_loss = (avg_loss * (rsi_period - 1) + losses[i]) / rsi_period
        if avg_loss == 0:
            rsi_vals.append(100.0)
        else:
            rs = avg_gain / avg_loss
            rsi_vals.append(100 - (100 / (1 + rs)))
    if len(rsi_vals) < stoch_period:
        return None
    raw_k = []
    for i in range(stoch_period - 1, len(rsi_vals)):
        window = rsi_vals[i - stoch_period + 1:i + 1]
        lo, hi = min(window), max(window)
        raw_k.append((rsi_vals[i] - lo) / (hi - lo) * 100 if hi != lo else 50.0)
    if len(raw_k) < smooth_k:
        return None
    k_vals = [sum(raw_k[i - smooth_k + 1:i + 1]) / smooth_k for i in range(smooth_k - 1, len(raw_k))]
    if len(k_vals) < smooth_d:
        return None
    d_vals = [sum(k_vals[i - smooth_d + 1:i + 1]) / smooth_d for i in range(smooth_d - 1, len(k_vals))]
    # 判断金叉/死叉
    prev_k = k_vals[-2] if len(k_vals) >= 2 else None
    prev_d = d_vals[-2] if len(d_vals) >= 2 else None
    return k_vals[-1], d_vals[-1], prev_k, prev_d


def calculate_adx(highs: list[float], lows: list[float], closes: list[float], period: int = 14) -> float | None:
    """
    ADX 趋势强度（0~100）
    < 20: 震荡无趋势  20~25: 趋势初现  >25: 趋势明确  >50: 强趋势
    """
    if len(closes) < period * 2 + 1:
        return None
    plus_dm, minus_dm, trs = [], [], []
    for i in range(1, len(closes)):
        up   = highs[i] - highs[i - 1]
        down = lows[i - 1] - lows[i]
        plus_dm.append(up if up > down and up > 0 else 0)
        minus_dm.append(down if down > up and down > 0 else 0)
        hl = highs[i] - lows[i]
        hc = abs(highs[i] - closes[i - 1])
        lc = abs(lows[i] - closes[i - 1])
        trs.append(max(hl, hc, lc))
    def wilder(vals, p):
        s = sum(vals[:p])
        result = [s]
        for v in vals[p:]:
            s = s - s / p + v
            result.append(s)
        return result
    tr_s  = wilder(trs, period)
    pdm_s = wilder(plus_dm, period)
    mdm_s = wilder(minus_dm, period)
    di_p = [100 * p / t if t else 0 for p, t in zip(pdm_s, tr_s)]
    di_m = [100 * m / t if t else 0 for m, t in zip(mdm_s, tr_s)]
    dx   = [abs(p - m) / (p + m) * 100 if (p + m) else 0 for p, m in zip(di_p, di_m)]
    if len(dx) < period:
        return None
    adx = sum(dx[:period]) / period
    for v in dx[period:]:
        adx = (adx * (period - 1) + v) / period
    return adx


def calculate_volume_signal(volumes: list[float], period: int = 20) -> tuple[float, float, float] | None:
    """
    返回 (当前量, 均量, 量比)
    量比 = 当前成交量 / 20日均量
    """
    if len(volumes) < period + 1:
        return None
    avg_vol = sum(volumes[-period-1:-1]) / period   # 用前 period 根均值，不含当前
    cur_vol = volumes[-1]
    ratio = cur_vol / avg_vol if avg_vol > 0 else 1.0
    return cur_vol, avg_vol, ratio


# ── 信号解读 ────────────────────────────────────────────────────────────────

def rsi_label(rsi: float) -> tuple[str, str]:
    if rsi >= 70:
        return "空", f"RSI {rsi:.1f}，超买区间，注意回调风险"
    elif rsi >= 60:
        return "多", f"RSI {rsi:.1f}，偏强，仍有上行空间"
    elif rsi >= 40:
        return "中", f"RSI {rsi:.1f}，中性区间"
    elif rsi >= 30:
        return "空", f"RSI {rsi:.1f}，偏弱"
    else:
        return "多", f"RSI {rsi:.1f}，超卖区间，关注反弹机会"


def macd_label(hist: float, prev_hist: float | None) -> tuple[str, str]:
    cross = ""
    if prev_hist is not None:
        if prev_hist < 0 and hist > 0:
            cross = "金叉 ↑"
        elif prev_hist > 0 and hist < 0:
            cross = "死叉 ↓"
    direction = "↑ 动能增强" if hist > 0 else "↓ 动能减弱"
    tag = "多" if hist > 0 else "空"
    label = f"柱状图 {hist:+.2f}，{direction}"
    if cross:
        label += f"，{cross}"
    return tag, label


def bb_label(price: float, upper: float, mid: float, lower: float) -> tuple[str, str]:
    band_width = upper - lower
    position = (price - lower) / band_width if band_width > 0 else 0.5
    pct = position * 100
    if price > upper:
        return "空", f"价格突破上轨（位置 {pct:.0f}%），超买注意"
    elif price > mid:
        return "多", f"价格在中轨上方（位置 {pct:.0f}%）"
    elif price > lower:
        return "空", f"价格在中轨下方（位置 {pct:.0f}%）"
    else:
        return "多", f"价格跌破下轨（位置 {pct:.0f}%），关注反弹"


def ma_label(price: float, ma20, ma50, ma200) -> tuple[str, str]:
    above = sum(1 for ma in [ma20, ma50, ma200] if ma is not None and price > ma)
    total = sum(1 for ma in [ma20, ma50, ma200] if ma is not None)
    if above == total:
        return "多", f"价格在 MA20/50/200 全线上方，多头排列"
    elif above == 0:
        return "空", f"价格在 MA20/50/200 全线下方，空头排列"
    else:
        return "中", f"价格部分均线上方（{above}/{total}），趋势混合"


def stoch_rsi_label(k: float, d: float, prev_k: float | None, prev_d: float | None) -> tuple[str, str]:
    """Stochastic RSI 信号解读"""
    cross = ""
    if prev_k is not None and prev_d is not None:
        if prev_k <= prev_d and k > d:
            cross = " 金叉 ↑"
        elif prev_k >= prev_d and k < d:
            cross = " 死叉 ↓"
    if k >= 80:
        zone = "超买区"
        tag = "空"
    elif k <= 20:
        zone = "超卖区"
        tag = "多"
    elif k > d:
        zone = "K>D 偏多"
        tag = "多"
    else:
        zone = "K<D 偏空"
        tag = "空"
    return tag, f"K {k:.1f} / D {d:.1f}，{zone}{cross}"


def adx_label(adx: float) -> tuple[str, str]:
    """ADX 趋势强度解读"""
    if adx >= 50:
        return "中", f"ADX {adx:.1f}，强趋势，顺势操作"
    elif adx >= 25:
        return "中", f"ADX {adx:.1f}，趋势明确，信号可信度高"
    elif adx >= 20:
        return "中", f"ADX {adx:.1f}，趋势初现，注意确认"
    else:
        return "中", f"ADX {adx:.1f}，震荡市，趋势信号仅供参考"


def volume_label(cur_vol: float, avg_vol: float, ratio: float, price_up: bool) -> tuple[str, str]:
    """量价配合信号"""
    if ratio >= 2.0:
        vol_desc = f"放量 {ratio:.1f}x"
    elif ratio >= 1.3:
        vol_desc = f"温和放量 {ratio:.1f}x"
    elif ratio <= 0.5:
        vol_desc = f"极度缩量 {ratio:.1f}x"
    else:
        vol_desc = f"缩量 {ratio:.1f}x"

    if ratio >= 1.3 and price_up:
        return "多", f"{vol_desc}，价涨量增，多头有力"
    elif ratio >= 1.3 and not price_up:
        return "空", f"{vol_desc}，价跌量增，空头主导"
    elif ratio <= 0.7 and price_up:
        return "中", f"{vol_desc}，价涨量缩，上涨动能不足，警惕"
    elif ratio <= 0.7 and not price_up:
        return "中", f"{vol_desc}，价跌量缩，下跌动能衰减，或将企稳"
    else:
        return "中", f"{vol_desc}，量能平稳，方向待确认"


# ── 主流程 ──────────────────────────────────────────────────────────────────

def print_for_claude(inst: str, bar: str, time_str: str, price: float, signals: list, atr: float | None):
    """纯信号输出，供 Claude 做逻辑判断用"""
    tag_map = {"多": "多头", "空": "空头", "中": "中性"}
    print(f"品种: {inst or 'N/A'} | 周期: {bar} | 时间: {time_str}")
    print(f"当前价格: {price:,.2f} USDT")
    if atr:
        print(f"ATR(14): {atr:,.2f}  止损参考: 多单 ▼{price - 1.5*atr:,.2f}  空单 ▲{price + 1.5*atr:,.2f}")
    print()
    labels = ["趋势  ", "MACD  ", "RSI   ", "布林带", "成交量", "StochRSI", "ADX   "]
    for (tag, msg), label in zip(signals, labels):
        print(f"[{label}]  {tag_map.get(tag, tag):<6}  {msg}")
    print()
    bull = sum(1 for t, _ in signals if t == "多")
    bear = sum(1 for t, _ in signals if t == "空")
    print(f"多头信号 {bull} / 空头信号 {bear} / 共 {len(signals)} 项")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inst", default="", help="Instrument ID，仅用于输出标题")
    parser.add_argument("--bar", default="1H", help="K线周期，仅用于输出标题")
    parser.add_argument("--for-claude", action="store_true", help="输出纯信号格式，供 Claude 判断")
    args = parser.parse_args()

    raw = sys.stdin.read().strip()
    candles = json.loads(raw)

    # newest-first → oldest-first
    candles = list(reversed(candles))
    # 过滤未完成的K线（confirm=0 表示当前K线还未收盘）
    candles = [c for c in candles if c[8] == "1"]

    closes  = [float(c[4]) for c in candles]
    highs   = [float(c[2]) for c in candles]
    lows    = [float(c[3]) for c in candles]
    volumes = [float(c[5]) for c in candles]

    last_ts = int(candles[-1][0])
    price = closes[-1]
    time_str = datetime.fromtimestamp(last_ts / 1000).strftime("%Y-%m-%d %H:%M")
    price_up = closes[-1] >= closes[-2] if len(closes) >= 2 else True

    # 计算指标
    rsi = calculate_rsi(closes)
    macd, sig, hist = calculate_macd(closes)
    prev_hist = None
    if len(closes) >= 27:
        _, _, prev_hist = calculate_macd(closes[:-1])
    ma20  = calculate_ma(closes, 20)
    ma50  = calculate_ma(closes, 50)
    ma200 = calculate_ma(closes, 200)
    bb_upper, bb_mid, bb_lower = calculate_bb(closes)
    atr = calculate_atr(highs, lows, closes)
    vol_result = calculate_volume_signal(volumes)
    stoch_result = calculate_stoch_rsi(closes)
    adx = calculate_adx(highs, lows, closes)

    title = f"{args.inst} " if args.inst else ""

    # ── 信号汇总 ────────────────────────────────────────────────────────────
    signals = []
    if ma20 and ma50 and ma200:
        signals.append(ma_label(price, ma20, ma50, ma200))
    if hist is not None:
        signals.append(macd_label(hist, prev_hist))
    if rsi is not None:
        signals.append(rsi_label(rsi))
    if bb_upper is not None:
        signals.append(bb_label(price, bb_upper, bb_mid, bb_lower))
    if vol_result is not None:
        cur_vol, avg_vol, ratio = vol_result
        signals.append(volume_label(cur_vol, avg_vol, ratio, price_up))
    if stoch_result is not None:
        signals.append(stoch_rsi_label(*stoch_result))
    if adx is not None:
        signals.append(adx_label(adx))

    if args.for_claude:
        print_for_claude(args.inst, args.bar, time_str, price, signals, atr)
        return

    # ── 人类可读输出 ────────────────────────────────────────────────────────
    print(f"\n{'='*54}")
    print(f"  {title}技术分析  ({time_str})")
    print(f"{'='*54}")
    print(f"  当前价格: {price:,.2f}")
    print()

    print("── 均线 ─────────────────────────────────────────────")
    for label, val in [("MA20 ", ma20), ("MA50 ", ma50), ("MA200", ma200)]:
        if val:
            diff = price - val
            arrow = "▲" if diff > 0 else "▼"
            print(f"  {label}  {val:>12,.2f}   {arrow} {abs(diff):,.2f} ({diff/val*100:+.1f}%)")
    print()

    print("── RSI (14) ──────────────────────────────────────────")
    if rsi is not None:
        bar_len = int(rsi / 5)
        bar = "█" * bar_len + "░" * (20 - bar_len)
        print(f"  {bar}  {rsi:.1f}")
    print()

    print("── MACD (12/26/9) ────────────────────────────────────")
    if macd is not None:
        print(f"  MACD    {macd:>10.3f}")
        print(f"  Signal  {sig:>10.3f}")
        print(f"  Hist    {hist:>+10.3f}  {'▲' if hist > 0 else '▼'}")
    print()

    print("── 布林带 (20, 2σ) ───────────────────────────────────")
    if bb_upper is not None:
        band_pct = (price - bb_lower) / (bb_upper - bb_lower) * 100
        print(f"  上轨  {bb_upper:>12,.2f}")
        print(f"  中轨  {bb_mid:>12,.2f}   ← 当前位置 {band_pct:.0f}%")
        print(f"  下轨  {bb_lower:>12,.2f}")
    print()

    print("── 成交量 ────────────────────────────────────────────")
    if vol_result is not None:
        cur_vol, avg_vol, ratio = vol_result
        bar_len = min(int(ratio * 10), 20)
        bar = "█" * bar_len + "░" * (20 - bar_len)
        print(f"  {bar}  {ratio:.2f}x")
        print(f"  当前量  {cur_vol:>12,.2f}")
        print(f"  均量    {avg_vol:>12,.2f}  (MA20)")
    print()

    print("── ATR 止损参考 (14) ─────────────────────────────────")
    if atr is not None:
        sl_long  = price - 1.5 * atr
        sl_short = price + 1.5 * atr
        print(f"  ATR     {atr:>12,.2f}")
        print(f"  多单止损 ▼  {sl_long:>10,.2f}   (1.5x ATR)")
        print(f"  空单止损 ▲  {sl_short:>10,.2f}   (1.5x ATR)")
    print()

    print("── Stochastic RSI (14,14,3,3) ────────────────────────")
    if stoch_result is not None:
        k, d, _, _ = stoch_result
        bar_len = min(int(k / 5), 20)
        bar = "█" * bar_len + "░" * (20 - bar_len)
        print(f"  K {bar}  {k:.1f}")
        print(f"  D {'░' * min(int(d/5),20)}{'░' * max(0, 20-min(int(d/5),20))}  {d:.1f}")
        if k >= 80:
            print(f"  ⚠️  超买区间（>80），注意回调")
        elif k <= 20:
            print(f"  ⚠️  超卖区间（<20），关注反弹")
    print()

    print("── ADX 趋势强度 (14) ─────────────────────────────────")
    if adx is not None:
        bar_len = min(int(adx / 5), 20)
        bar = "█" * bar_len + "░" * (20 - bar_len)
        trend = "强趋势" if adx >= 50 else "趋势明确" if adx >= 25 else "趋势初现" if adx >= 20 else "震荡市"
        print(f"  {bar}  {adx:.1f}  [{trend}]")
    print()

    tag_map = {"多": "✅", "空": "🔴", "中": "⚠️ "}
    print("── 信号汇总 ──────────────────────────────────────────")
    signal_labels = ["趋势   ", "动能   ", "RSI    ", "布林带 ", "成交量 ", "StochRSI", "ADX    "]
    for (tag, msg), label in zip(signals, signal_labels):
        print(f"  {tag_map.get(tag, '  ')} {label} {msg}")

    bull = sum(1 for t, _ in signals if t == "多")
    bear = sum(1 for t, _ in signals if t == "空")
    print()
    print(f"  多头信号 {bull} / 空头信号 {bear} / 共 {len(signals)} 项")
    print(f"{'='*54}\n")


if __name__ == "__main__":
    main()
