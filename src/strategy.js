import { atr, ema, rsi, trendForBars } from './indicators.js';
import { DEFAULT_SESSION_SCHEDULE, assessSessionBreakout } from './sessions.js';

const EMPTY_LEVELS = Object.freeze({ entry: null, sl: null, tp: null, initialRisk: null });
const SOURCE = 'PAXG/USDT proxy — not Vantage XAUUSD broker pricing';

const closedBars = (bars) => Array.isArray(bars) && bars.length > 1 ? bars.slice(0, -1) : [];
const makeGate = (id, state, reason) => ({ id, state, reason });
const isActionableDirection = (side) => side === 'BUY' || side === 'SELL';

function fiveMinuteTrigger(bars) {
  const closed = closedBars(bars);
  if (closed.length < 220) return { side: 'WAIT', state: 'waiting', reason: 'Need 220 closed 5m candles.' };

  const closes = closed.map((bar) => bar.close);
  const trend = trendForBars(closed);
  const averageTrueRange = atr(closed);
  const rsiValue = rsi(closes);
  const e20 = ema(closes, 20);
  const firstBreak = closed.at(-2);
  const confirmation = closed.at(-1);
  const pullbackWindow = closed.slice(-7, -2);
  if (!averageTrueRange || !e20 || !firstBreak || !confirmation) {
    return { side: 'WAIT', state: 'waiting', reason: 'Waiting for complete 5m indicator data.' };
  }

  const priorHigh = Math.max(...pullbackWindow.map((bar) => bar.high));
  const priorLow = Math.min(...pullbackWindow.map((bar) => bar.low));
  const pullbackBuy = pullbackWindow.some((bar) => bar.low <= e20 + (averageTrueRange * 0.45) && bar.close < bar.open);
  const pullbackSell = pullbackWindow.some((bar) => bar.high >= e20 - (averageTrueRange * 0.45) && bar.close > bar.open);
  const breakoutBuy = firstBreak.close > priorHigh
    && firstBreak.close > firstBreak.open
    && firstBreak.close - firstBreak.open >= averageTrueRange * 0.25;
  const breakoutSell = firstBreak.close < priorLow
    && firstBreak.close < firstBreak.open
    && firstBreak.open - firstBreak.close >= averageTrueRange * 0.25;
  const confirmBuy = confirmation.close >= firstBreak.close && confirmation.close > confirmation.open;
  const confirmSell = confirmation.close <= firstBreak.close && confirmation.close < confirmation.open;

  if (trend === 'BUY' && pullbackBuy && breakoutBuy && confirmBuy && rsiValue >= 52 && rsiValue <= 75) {
    return { side: 'BUY', state: 'pass', reason: 'Two closed 5m candles confirmed a bullish pullback breakout.', atr: averageTrueRange, last: confirmation };
  }
  if (trend === 'SELL' && pullbackSell && breakoutSell && confirmSell && rsiValue >= 25 && rsiValue <= 48) {
    return { side: 'SELL', state: 'pass', reason: 'Two closed 5m candles confirmed a bearish pullback breakout.', atr: averageTrueRange, last: confirmation };
  }
  return {
    side: 'WAIT',
    state: 'waiting',
    reason: 'Waiting for a matching 5m pullback, breakout, and second closed-candle confirmation.',
    atr: averageTrueRange,
    last: confirmation,
  };
}

function volatilityGate(bars, trigger) {
  const closed = closedBars(bars);
  const last = closed.at(-1);
  const averageTrueRange = trigger.atr ?? atr(closed);
  if (!last || !Number.isFinite(averageTrueRange)) {
    return makeGate('volatility', 'waiting', 'Waiting for complete ATR data.');
  }
  const lastRange = last.high - last.low;
  const normalRange = averageTrueRange >= last.close * 0.00005
    && averageTrueRange <= last.close * 0.008;
  const noSpike = lastRange <= averageTrueRange * 3;
  return normalRange && noSpike
    ? makeGate('volatility', 'pass', 'ATR is within the configured safer range.')
    : makeGate('volatility', 'blocked', 'ATR or the latest candle is outside the safer volatility range.');
}

function levelsFor(side, trigger) {
  const recent = closedBars(trigger.bars).slice(-6);
  const entry = trigger.last.close;
  const swing = side === 'BUY'
    ? Math.min(...recent.map((bar) => bar.low))
    : Math.max(...recent.map((bar) => bar.high));
  const protectiveStop = side === 'BUY'
    ? swing - (trigger.atr * 0.15)
    : swing + (trigger.atr * 0.15);
  const initialRisk = Math.max(Math.abs(entry - protectiveStop), trigger.atr * 1.2);
  const sl = side === 'BUY' ? entry - initialRisk : entry + initialRisk;
  const tp = side === 'BUY' ? entry + (initialRisk * 1.5) : entry - (initialRisk * 1.5);
  return { entry, sl, tp, initialRisk };
}

export function evaluateReadiness({
  cache = {},
  livePrice = null,
  dataHealth = {},
  now = new Date(),
  schedule = DEFAULT_SESSION_SCHEDULE,
} = {}) {
  const fourHourBars = closedBars(cache['4h']);
  const thirtyMinuteBars = closedBars(cache['30m']);
  const fiveMinuteBars = cache['5m'] ?? [];
  const trend4h = trendForBars(fourHourBars);
  const trend30m = trendForBars(thirtyMinuteBars);
  const trigger = { ...fiveMinuteTrigger(fiveMinuteBars), bars: fiveMinuteBars };
  const intendedSide = isActionableDirection(trend4h) ? trend4h : trigger.side;
  const feedGate = dataHealth.fresh
    ? makeGate('feed', 'pass', 'Latest tick and candle are fresh.')
    : makeGate('feed', 'blocked', 'Feed or candle data is stale; wait for a fresh update.');
  const fourHourGate = isActionableDirection(trend4h)
    ? makeGate('trend4h', 'pass', `4h EMA trend is ${trend4h}.`)
    : makeGate('trend4h', 'waiting', 'Waiting for a clear 4h EMA trend.');
  const thirtyMinuteGate = !isActionableDirection(intendedSide) || !isActionableDirection(trend30m)
    ? makeGate('trend30m', 'waiting', 'Waiting for a clear 30m EMA trend.')
    : trend30m === intendedSide
      ? makeGate('trend30m', 'pass', `30m EMA trend agrees with ${intendedSide}.`)
      : makeGate('trend30m', 'blocked', `30m EMA trend conflicts with the ${intendedSide} 4h bias.`);
  const triggerGate = trigger.state === 'pass' && trigger.side === intendedSide
    ? makeGate('trigger5m', 'pass', trigger.reason)
    : trigger.side !== 'WAIT' && isActionableDirection(intendedSide) && trigger.side !== intendedSide
      ? makeGate('trigger5m', 'blocked', `5m trigger conflicts with the ${intendedSide} 4h bias.`)
      : makeGate('trigger5m', 'waiting', trigger.reason);
  const sessionAnalysis = assessSessionBreakout(fiveMinuteBars, trigger.last?.close ?? livePrice, trigger.atr, now, schedule);
  const sessionGate = sessionAnalysis.direction === intendedSide && ['Breakout', 'Retest'].includes(sessionAnalysis.state)
    ? makeGate('session', 'pass', sessionAnalysis.reason)
    : sessionAnalysis.direction !== 'WAIT' && isActionableDirection(intendedSide) && sessionAnalysis.direction !== intendedSide
      ? makeGate('session', 'blocked', `${sessionAnalysis.reason} It conflicts with the ${intendedSide} setup.`)
      : sessionAnalysis.state === 'Not in Session'
        ? makeGate('session', 'blocked', sessionAnalysis.reason)
        : makeGate('session', 'waiting', sessionAnalysis.reason);
  const volatility = volatilityGate(fiveMinuteBars, trigger);
  const gates = [feedGate, fourHourGate, thirtyMinuteGate, triggerGate, sessionGate, volatility];
  const confirmed = isActionableDirection(intendedSide) && gates.every((gate) => gate.state === 'pass');
  const blocked = gates.find((gate) => gate.state === 'blocked');
  const waiting = gates.find((gate) => gate.state === 'waiting');
  const side = confirmed ? intendedSide : 'WAIT';
  const levels = confirmed ? levelsFor(side, trigger) : { ...EMPTY_LEVELS };

  return {
    side,
    state: confirmed ? 'confirmed' : 'waiting',
    gates,
    session: sessionAnalysis,
    levels,
    reason: confirmed
      ? `${side} is confirmed by all six readiness gates.`
      : (blocked ?? waiting)?.reason ?? 'Waiting for readiness data.',
    observedAt: now.toISOString(),
    source: SOURCE,
  };
}
