import test from 'node:test';
import assert from 'node:assert/strict';
import { freshnessFor } from '../src/data.js';

test('freshness requires both tick and candle timestamps below twelve seconds', () => {
  assert.equal(freshnessFor({ lastTickAt: 1000, lastCandleAt: 1000, now: 12999 }).fresh, true);
  assert.equal(freshnessFor({ lastTickAt: 1000, lastCandleAt: 1000, now: 13000 }).fresh, false);
});

test('freshness explains a missing or stale input without treating it as live', () => {
  const health = freshnessFor({ lastTickAt: null, lastCandleAt: 1000, now: 2000 });
  assert.equal(health.fresh, false);
  assert.match(health.reason, /tick/i);
});
