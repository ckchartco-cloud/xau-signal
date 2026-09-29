import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

test('the app entry is versioned and service-worker network fetches bypass browser HTTP cache', () => {
  assert.match(index, /src="\.\/src\/app\.js\?v=[^"]+"/);
  assert.match(serviceWorker, /fetch\(event\.request, \{ cache: 'no-store' \}\)/);
});
