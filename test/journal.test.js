import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateReview,
  filterReview,
  migrateJournal,
  recordConfirmedSetup,
  resolvePaperOutcome,
} from '../src/journal.js';

test('migrates a legacy row without dropping it', () => {
  const [row] = migrateJournal([{ key: 'legacy', status: 'WIN' }]);
  assert.equal(row.setupType, 'Legacy');
  assert.equal(row.outcome, 'WIN');
});

test('calculates BUY R from initial risk and returns -1R at the stop', () => {
  assert.equal(resolvePaperOutcome({ side: 'BUY', entry: 100, sl: 98 }, 102).r, 1);
  assert.equal(resolvePaperOutcome({ side: 'BUY', entry: 100, sl: 98 }, 98).r, -1);
});

test('records a confirmed readiness decision with immutable gate and level snapshots', () => {
  const decision = {
    side: 'BUY',
    state: 'confirmed',
    observedAt: '2026-09-29T09:00:00.000Z',
    session: { session: { name: 'London' } },
    gates: [{ id: 'feed', state: 'pass' }],
    levels: { entry: 100, sl: 98, tp: 103, initialRisk: 2 },
  };
  const [row] = recordConfirmedSetup([], decision);
  assert.equal(row.setupType, 'Gold Trend + Session Breakout');
  assert.notEqual(row.gates, decision.gates);
  assert.equal(row.initialRisk, 2);
});

test('filters composably by session, setup, direction, and timeframe', () => {
  const rows = [
    { key: 'a', session: 'London', setupType: 'Gold Trend + Session Breakout', side: 'BUY', timeframe: '5m' },
    { key: 'b', session: 'New York', setupType: 'Legacy', side: 'SELL', timeframe: '30m' },
  ];
  assert.deepEqual(filterReview(rows, { session: 'London', side: 'BUY', timeframe: '5m' }).map((row) => row.key), ['a']);
});

test('excludes expiries and warns below ten completed outcomes', () => {
  const rows = [
    ...Array.from({ length: 9 }, (_, index) => ({ key: String(index), outcome: index % 2 ? 'LOSS' : 'WIN', r: index % 2 ? -1 : 1 })),
    { key: 'expired', outcome: 'EXPIRED', r: 0 },
  ];
  const summary = aggregateReview(rows, {});
  assert.equal(summary.minimumSampleWarning, true);
  assert.equal(summary.completed, 9);
  assert.equal(summary.expired, 1);
  assert.equal(summary.averageR, 1 / 9);
});
