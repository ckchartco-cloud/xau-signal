const finiteValues = (values) => Array.isArray(values) && values.every(Number.isFinite);

export function ema(values, period) {
  if (!Number.isInteger(period) || period <= 0 || !finiteValues(values) || values.length < period) return null;

  let value = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
  const multiplier = 2 / (period + 1);
  for (let index = period; index < values.length; index += 1) {
    value = values[index] * multiplier + value * (1 - multiplier);
  }
  return value;
}

export function rsi(values, period = 14) {
  if (!Number.isInteger(period) || period <= 0 || !finiteValues(values) || values.length <= period) return null;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    averageGain = ((averageGain * (period - 1)) + Math.max(change, 0)) / period;
    averageLoss = ((averageLoss * (period - 1)) + Math.max(-change, 0)) / period;
  }

  if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
  const relativeStrength = averageGain / averageLoss;
  return 100 - (100 / (1 + relativeStrength));
}

export function atr(bars, period = 14) {
  if (!Array.isArray(bars) || !Number.isInteger(period) || period <= 0 || bars.length <= period) return null;

  const ranges = [];
  for (let index = 1; index < bars.length; index += 1) {
    const bar = bars[index];
    const previous = bars[index - 1];
    if (![bar?.high, bar?.low, previous?.close].every(Number.isFinite)) return null;
    ranges.push(Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - previous.close),
      Math.abs(bar.low - previous.close),
    ));
  }

  if (ranges.length < period) return null;
  return ranges.slice(-period).reduce((sum, value) => sum + value, 0) / period;
}

export function trendForBars(bars, fastPeriod = 50, slowPeriod = 200) {
  if (!Array.isArray(bars) || bars.length < slowPeriod) return 'WAIT';
  const closes = bars.map((bar) => bar?.close);
  const fast = ema(closes, fastPeriod);
  const slow = ema(closes, slowPeriod);
  const last = closes.at(-1);
  if (![fast, slow, last].every(Number.isFinite)) return 'WAIT';
  if (fast > slow && last > fast) return 'BUY';
  if (fast < slow && last < fast) return 'SELL';
  return 'WAIT';
}
