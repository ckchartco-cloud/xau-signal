import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SESSION_SCHEDULE } from '../src/sessions.js';
import { buildAppState } from '../src/app.js';

const now = new Date('2026-09-29T09:00:00Z');

function trendBars(count, direction, intervalSeconds, endTime) {
  const multiplier = direction === 'SELL' ? -1 : 1;
  const start = endTime - (count * intervalSeconds);
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + (multiplier * index * 0.02);
    return { time: start + (index * intervalSeconds), open: close - (multiplier * 0.03), high: close + 0.1, low: close - 0.1, close };
  });
}

function confirmedCache() {
  const end = Math.floor(now.getTime() / 1000);
  const five = trendBars(231, 'BUY', 300, end);
  [104.38, 104.18, 104.36, 104.16, 104.34, 104.14, 104.32, 104.42, 104.15, 104.31, 104.18, 104.35].forEach((close, index) => {
    const at = five.length - 14 + index;
    five[at] = { ...five[at], open: close - 0.03, high: close + 0.1, low: close - 0.1, close };
  });
  five[five.length - 7] = { ...five[five.length - 7], open: 104.55, high: 104.6, low: 104.25, close: 104.42 };
  five[five.length - 2] = { ...five.at(-2), open: 104.5, high: 104.8, low: 104.45, close: 104.7 };
  five[five.length - 1] = { ...five.at(-1), open: 104.68, high: 104.95, low: 104.65, close: 104.85 };
  return {
    '4h': [...trendBars(231, 'BUY', 14400, end), { ...trendBars(231, 'BUY', 14400, end).at(-1), time: end }],
    '30m': [...trendBars(231, 'BUY', 1800, end), { ...trendBars(231, 'BUY', 1800, end).at(-1), time: end }],
    '5m': [...five, { ...five.at(-1), time: end }],
  };
}

const confirmedInput = {
  cache: confirmedCache(), livePrice: 104.85, health: { fresh: true }, now, schedule: DEFAULT_SESSION_SCHEDULE, journal: [],
};

test('buildAppState carries a confirmed decision into journal-ready review state', () => {
  const state = buildAppState(confirmedInput);
  assert.equal(state.decision.state, 'confirmed');
  assert.equal(state.review.rows[0].setupType, 'Gold Trend + Session Breakout');
});

test('buildAppState does not create a journal setup for WAIT', () => {
  const state = buildAppState({ ...confirmedInput, health: { fresh: false } });
  assert.equal(state.decision.state, 'waiting');
  assert.equal(state.review.rows.length, 0);
});
