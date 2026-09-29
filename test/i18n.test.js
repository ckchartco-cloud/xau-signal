import test from 'node:test';
import assert from 'node:assert/strict';
import { missingKeys, t } from '../src/i18n.js';

test('every readiness, session, and review key has English and Chinese text', () => {
  assert.deepEqual(missingKeys('en'), []);
  assert.deepEqual(missingKeys('zh'), []);
});

test('gate count uses a count rather than a profit probability', () => {
  assert.equal(t('en', 'readiness.gateCount', { passed: 5, total: 6 }), '5 / 6 gates pass');
});

test('Chinese source disclosure still identifies the PAXG proxy limitation', () => {
  assert.match(t('zh', 'source.proxy'), /PAXG/);
  assert.match(t('zh', 'source.proxy'), /Vantage/);
});
