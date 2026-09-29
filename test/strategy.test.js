import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SESSION_SCHEDULE } from '../src/sessions.js';
import { evaluateReadiness } from '../src/strategy.js';

const londonNow = new Date('2026-09-29T09:00:00Z');
const gate = (decision, id) => decision.gates.find((item) => item.id === id);

function trendBars(count, direction, intervalSeconds, endTime) {
  const multiplier = direction === 'SELL' ? -1 : 1;
  const start = endTime - (count * intervalSeconds);
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + (multiplier * index * 0.02);
    return {
      time: start + (index * intervalSeconds),
      open: close - (multiplier * 0.03),
      high: close + 0.1,
      low: close - 0.1,
      close,
    };
  });
}

function confirmedFiveMinuteBars(now) {
  const interval = 5 * 60;
  const end = Math.floor(now.getTime() / 1000);
  const closed = trendBars(231, 'BUY', interval, end);
  [104.38, 104.18, 104.36, 104.16, 104.34, 104.14, 104.32, 104.42, 104.15, 104.31, 104.18, 104.35]
    .forEach((close, index) => {
      const barIndex = closed.length - 14 + index;
      closed[barIndex] = { ...closed[barIndex], open: close - 0.03, high: close + 0.1, low: close - 0.1, close };
    });
  const pullback = closed.length - 7;
  closed[pullback] = { ...closed[pullback], open: 104.55, high: 104.6, low: 104.25, close: 104.42 };
  closed[closed.length - 2] = { ...closed.at(-2), open: 104.5, high: 104.8, low: 104.45, close: 104.7 };
  closed[closed.length - 1] = { ...closed.at(-1), open: 104.68, high: 104.95, low: 104.65, close: 104.85 };
  const current = { ...closed.at(-1), time: end, open: 104.85, high: 104.9, low: 104.8, close: 104.85 };
  return [...closed, current];
}

function cacheFor(now, { thirtyMinuteDirection = 'BUY', triggered = true } = {}) {
  const end = Math.floor(now.getTime() / 1000);
  const fiveMinute = triggered
    ? confirmedFiveMinuteBars(now)
    : [...trendBars(231, 'BUY', 5 * 60, end), { ...trendBars(231, 'BUY', 5 * 60, end).at(-1), time: end }];
  return {
    '4h': [...trendBars(231, 'BUY', 4 * 60 * 60, end), { ...trendBars(231, 'BUY', 4 * 60 * 60, end).at(-1), time: end }],
    '30m': [...trendBars(231, thirtyMinuteDirection, 30 * 60, end), { ...trendBars(231, thirtyMinuteDirection, 30 * 60, end).at(-1), time: end }],
    '5m': fiveMinute,
  };
}

const confirmedBuyCache = cacheFor(londonNow);
const alignedCache = cacheFor(londonNow);

test('blocks a stale feed and exposes no actionable levels', () => {
  const decision = evaluateReadiness({
    cache: alignedCache,
    livePrice: 105.15,
    dataHealth: { fresh: false },
    now: londonNow,
    schedule: DEFAULT_SESSION_SCHEDULE,
  });
  assert.equal(decision.side, 'WAIT');
  assert.equal(gate(decision, 'feed').state, 'blocked');
  assert.deepEqual(decision.levels, { entry: null, sl: null, tp: null, initialRisk: null });
});

test('confirms BUY only when all six gates pass', () => {
  const decision = evaluateReadiness({
    cache: confirmedBuyCache,
    livePrice: 105.15,
    dataHealth: { fresh: true },
    now: londonNow,
    schedule: DEFAULT_SESSION_SCHEDULE,
  });
  assert.equal(decision.side, 'BUY');
  assert.equal(decision.state, 'confirmed');
  assert.equal(decision.gates.filter((item) => item.state === 'pass').length, 6);
  assert.ok(decision.levels.entry > decision.levels.sl);
});

test('reports distinct 30m conflict and 5m waiting gate reasons', () => {
  const conflictDecision = evaluateReadiness({
    cache: cacheFor(londonNow, { thirtyMinuteDirection: 'SELL' }),
    livePrice: 105.15,
    dataHealth: { fresh: true },
    now: londonNow,
    schedule: DEFAULT_SESSION_SCHEDULE,
  });
  const waitingDecision = evaluateReadiness({
    cache: cacheFor(londonNow, { triggered: false }),
    livePrice: 104.62,
    dataHealth: { fresh: true },
    now: londonNow,
    schedule: DEFAULT_SESSION_SCHEDULE,
  });
  assert.equal(gate(conflictDecision, 'trend30m').state, 'blocked');
  assert.equal(gate(waitingDecision, 'trigger5m').state, 'waiting');
});

test('blocks abnormal five-minute volatility before a signal is confirmed', () => {
  const volatile = cacheFor(londonNow);
  volatile['5m'][volatile['5m'].length - 2] = {
    ...volatile['5m'].at(-2), high: 120, low: 90,
  };
  const decision = evaluateReadiness({
    cache: volatile,
    livePrice: 105.15,
    dataHealth: { fresh: true },
    now: londonNow,
    schedule: DEFAULT_SESSION_SCHEDULE,
  });
  assert.equal(gate(decision, 'volatility').state, 'blocked');
  assert.equal(decision.side, 'WAIT');
});
