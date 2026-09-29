import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SESSION_SCHEDULE,
  assessSessionBreakout,
  buildAsianRange,
  loadSessionSchedule,
  resolveSession,
  saveSessionSchedule,
} from '../src/sessions.js';

const at = (iso, high, low, close = (high + low) / 2) => ({
  time: Math.floor(new Date(iso).getTime() / 1000),
  open: close,
  high,
  low,
  close,
});

const bars = [
  at('2026-09-29T00:00:00Z', 100, 98),
  at('2026-09-29T03:00:00Z', 101, 97),
  at('2026-09-29T05:59:00Z', 100, 98),
  at('2026-09-29T06:00:00Z', 110, 90),
];

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

test('resolves default London at 09:00 UTC', () => {
  assert.deepEqual(resolveSession(new Date('2026-09-29T09:00:00Z')), {
    name: 'London', active: true, custom: false,
  });
});

test('uses half-open UTC boundaries', () => {
  assert.equal(resolveSession(new Date('2026-09-29T06:00:00Z')).name, 'Off hours');
  assert.equal(resolveSession(new Date('2026-09-29T07:00:00Z')).name, 'London');
});

test('builds Asian range from closed 00:00-06:00 UTC bars only', () => {
  const now = new Date('2026-09-29T09:00:00Z');
  assert.deepEqual(buildAsianRange(bars, now, DEFAULT_SESSION_SCHEDULE), {
    high: 101, low: 97, complete: true,
  });
});

test('marks an in-progress Asian range incomplete', () => {
  const now = new Date('2026-09-29T05:30:00Z');
  assert.deepEqual(buildAsianRange(bars, now, DEFAULT_SESSION_SCHEDULE), {
    high: 101, low: 97, complete: false,
  });
});

test('persists a custom schedule and marks it Custom', () => {
  const storage = memoryStorage();
  const customSchedule = {
    Asia: { start: 1, end: 6 },
    London: { start: 7, end: 11 },
    'New York': { start: 13, end: 17 },
  };
  saveSessionSchedule(storage, customSchedule);
  assert.equal(loadSessionSchedule(storage).custom, true);
});

test('identifies an ATR-normalized London breakout above the Asian range', () => {
  const outcome = assessSessionBreakout(
    bars,
    102,
    1,
    new Date('2026-09-29T09:00:00Z'),
    DEFAULT_SESSION_SCHEDULE,
  );
  assert.equal(outcome.state, 'Breakout');
  assert.equal(outcome.direction, 'BUY');
  assert.equal(outcome.distanceAtr, 1);
});
