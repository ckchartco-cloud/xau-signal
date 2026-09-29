import { atr } from './indicators.js';

const clamp = (value) => Math.max(0, Math.min(1, value));
const slope = (values) => values.length < 2 ? 0 : (values.at(-1) - values[0]) / (values.length - 1);

export function analyzePatterns(bars = []) {
  const closed = bars.slice(0, -1);
  if (closed.length < 60) return {
    best: { name: 'Waiting for candles…', score: 0, bias: 'NEUTRAL', reason: 'Need at least 60 closed candles.' },
    candidates: [], support: null, resistance: null,
  };
  const window = closed.slice(-60);
  const closes = window.map((bar) => bar.close);
  const averageTrueRange = atr(closed) ?? closes.at(-1) * 0.001;
  const highs = [];
  const lows = [];
  for (let index = 2; index < window.length - 2; index += 1) {
    if (window[index].high >= window[index - 1].high && window[index].high >= window[index + 1].high) highs.push(window[index].high);
    if (window[index].low <= window[index - 1].low && window[index].low <= window[index + 1].low) lows.push(window[index].low);
  }
  const highSlope = slope(highs.slice(-5));
  const lowSlope = slope(lows.slice(-5));
  const flatHigh = clamp(1 - Math.abs(highSlope) / (averageTrueRange * 0.25));
  const flatLow = clamp(1 - Math.abs(lowSlope) / (averageTrueRange * 0.25));
  const risingHigh = clamp(highSlope / (averageTrueRange * 0.25));
  const risingLow = clamp(lowSlope / (averageTrueRange * 0.25));
  const fallingHigh = clamp(-highSlope / (averageTrueRange * 0.25));
  const fallingLow = clamp(-lowSlope / (averageTrueRange * 0.25));
  const closeSlope = slope(closes.slice(-15));
  const priorSlope = slope(closes.slice(-45, -15));
  const similarHigh = highs.length > 1 ? clamp(1 - Math.abs(highs.at(-1) - highs.at(-2)) / (averageTrueRange * 2)) : 0;
  const similarLow = lows.length > 1 ? clamp(1 - Math.abs(lows.at(-1) - lows.at(-2)) / (averageTrueRange * 2)) : 0;
  const recent = window.slice(-20);
  const previous = window.slice(-40, -20);
  const recentRange = Math.max(...recent.map((bar) => bar.high)) - Math.min(...recent.map((bar) => bar.low));
  const previousRange = Math.max(...previous.map((bar) => bar.high)) - Math.min(...previous.map((bar) => bar.low));
  const contraction = clamp(1 - recentRange / (previousRange || recentRange));
  const candidates = [
    { name: 'Ascending triangle', score: 35 + 25 * flatHigh + 40 * risingLow, bias: 'BULLISH', reason: 'Repeated highs are relatively flat while swing lows are rising.' },
    { name: 'Descending triangle', score: 35 + 25 * flatLow + 40 * fallingHigh, bias: 'BEARISH', reason: 'Repeated lows are relatively flat while swing highs are falling.' },
    { name: 'Double top', score: highs.length > 1 ? 20 + 60 * similarHigh + 20 * clamp(-closeSlope / (averageTrueRange * 0.2)) : 0, bias: 'BEARISH', reason: 'Two recent swing highs are close together with downward momentum developing.' },
    { name: 'Double bottom', score: lows.length > 1 ? 20 + 60 * similarLow + 20 * clamp(closeSlope / (averageTrueRange * 0.2)) : 0, bias: 'BULLISH', reason: 'Two recent swing lows are close together with upward momentum developing.' },
    { name: 'Rising wedge', score: 20 + 25 * risingHigh + 25 * risingLow + 30 * clamp(risingLow - risingHigh), bias: 'BEARISH', reason: 'Both boundaries rise, with the lower boundary advancing faster.' },
    { name: 'Falling wedge', score: 20 + 25 * fallingHigh + 25 * fallingLow + 30 * clamp(fallingHigh - fallingLow), bias: 'BULLISH', reason: 'Both boundaries fall, with the upper boundary declining faster.' },
    { name: 'Bull flag', score: 10 + 45 * clamp(priorSlope / (averageTrueRange * 0.2)) + 45 * clamp(-closeSlope / (averageTrueRange * 0.2)), bias: 'BULLISH', reason: 'A strong prior rise is followed by a short downward consolidation.' },
    { name: 'Bear flag', score: 10 + 45 * clamp(-priorSlope / (averageTrueRange * 0.2)) + 45 * clamp(closeSlope / (averageTrueRange * 0.2)), bias: 'BEARISH', reason: 'A strong prior fall is followed by a short upward consolidation.' },
    { name: 'Range / consolidation', score: 20 + 25 * flatHigh + 25 * flatLow + 30 * contraction, bias: 'NEUTRAL', reason: 'Recent price action is contained in a contracting horizontal range.' },
  ].map((candidate) => ({ ...candidate, score: Math.round(Math.min(100, candidate.score)) })).sort((first, second) => second.score - first.score);
  const best = candidates[0].score < 45
    ? { name: 'No clear pattern', score: candidates[0].score, bias: 'NEUTRAL', reason: 'Recent candles do not form a strong enough geometric pattern yet.' }
    : candidates[0];
  return {
    best,
    candidates,
    support: Math.min(...recent.map((bar) => bar.low)),
    resistance: Math.max(...recent.map((bar) => bar.high)),
  };
}
