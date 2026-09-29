import test from 'node:test';
import assert from 'node:assert/strict';
import { atr, ema, rsi, trendForBars } from '../src/indicators.js';

const risingBars = (count) => Array.from({ length: count }, (_, index) => {
  const close = 100 + index;
  return { time: index, open: close - 0.5, high: close + 1, low: close - 1, close };
});

test('ema returns null until enough values exist', () => {
  assert.equal(ema([1, 2], 3), null);
});

test('ema gives the stable recursive value for a known series', () => {
  assert.equal(ema([1, 2, 3, 4, 5], 3), 4);
});

test('rsi and atr return null instead of NaN when data is insufficient', () => {
  assert.equal(rsi([1, 2], 14), null);
  assert.equal(atr(risingBars(14), 14), null);
});

test('atr measures true range using the previous close', () => {
  const bars = [
    { time: 1, open: 10, high: 11, low: 9, close: 10 },
    { time: 2, open: 10, high: 14, low: 12, close: 13 },
    { time: 3, open: 13, high: 15, low: 12, close: 14 },
  ];
  assert.equal(atr(bars, 2), 3.5);
});

test('trendForBars returns BUY only when price and fast trend are above slow trend', () => {
  assert.equal(trendForBars(risingBars(240)), 'BUY');
});

test('trendForBars returns WAIT until the slow trend has enough closed bars', () => {
  assert.equal(trendForBars(risingBars(199)), 'WAIT');
});
