import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

test('service worker activates a new cache immediately and refreshes online assets from the network', () => {
  assert.match(serviceWorker, /self\.skipWaiting\(\)/);
  assert.match(serviceWorker, /self\.clients\.claim\(\)/);
  assert.match(serviceWorker, /fetch\(event\.request, \{ cache: 'no-store' \}\)/);
  assert.doesNotMatch(serviceWorker, /caches\.match\(event\.request\)\.then\(response => \{\s*return response \|\| fetch\(event\.request\)/);
});
