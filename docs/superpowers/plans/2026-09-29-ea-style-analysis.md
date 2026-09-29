# EA-Style XAUUSD Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build a transparent, mobile-first XAUUSD Trade Readiness, Session, and Review experience without adding automated trading or account-risk controls.

**Architecture:** Replace the current chain of global-function overrides with small browser ES modules. Pure analysis modules return structured data and use Node built-in tests; the app module owns data streaming, chart updates, storage, and DOM rendering. The existing PAXG/USDT proxy remains the only feed and is labelled as a proxy at every decision point.

**Tech Stack:** Static HTML/CSS, browser ES modules, Lightweight Charts 5.2.0, Web Storage, Node built-in test runner, GitHub Pages.

**Spec:** docs/superpowers/specs/2026-09-29-ea-style-analysis-design.md

## Global Constraints

- Preserve iPhone-first responsive PWA behavior and English/Simplified Chinese support.
- Support only XAUUSD analysis with 1m, 5m, 15m, 30m, and 4h views.
- Use the current free PAXG/USDT proxy; show its non-Vantage limitation and never claim zero-delay broker ticks, spread, fills, or profitability.
- Keep closed candles as the only signal inputs; live ticks update the price marker and paper outcomes only.
- A confirmed signal requires every gate: Feed, 4h, 30m, 5m, Session, and Volatility.
- Default UTC schedule is Asia 00:00-06:00, London 07:00-11:00, New York 13:00-17:00; custom hours persist locally and are labelled Custom.
- Do not add automatic execution, trade copier, EA behavior, lot sizing, automatic risk profiles, grid, martingale, or averaging-down.
- Keep existing chart, patterns, timeframes, alerts, levels, and local paper journal behavior unless replaced compatibly.
- Use no new runtime dependency beyond Lightweight Charts; tests use Node built-ins only.

## Review Focus

- Stale feed, disconnected stream, or stale candle: Task 3 tests WAIT and null levels.
- Exact UTC boundaries and locally persisted custom hours: Task 2 tests session boundaries and storage round-trip.
- Conflicting 4h/30m bias, missing 5m confirmation, and abnormal ATR/spike: Task 3 tests each blocking reason.
- Legacy journal rows and fewer than ten closed outcomes: Task 4 tests migration, exclusion rules, and sample warning.
- Chinese copy, touch-friendly mobile layout, and existing-tab regression: Task 6 tests translation keys; Task 8 verifies browser behavior at 390px.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| package.json | Node test command and ES-module mode; no runtime dependencies. |
| src/indicators.js | Pure EMA, RSI, ATR, and trend helpers. |
| src/sessions.js | UTC schedule, storage adapter, Asian range, breakout/retest analysis. |
| src/strategy.js | Produces the structured Trade Readiness decision. |
| src/journal.js | Journal migration, paper R calculation, filtering, and aggregations. |
| src/data.js | REST/WebSocket data client and 12-second freshness state. |
| src/patterns.js | Existing pattern calculation, extracted without rule changes. |
| src/chart.js | Lightweight Charts and price-line management. |
| src/i18n.js | English/Chinese labels, states, and explanation templates. |
| src/ui.js | DOM rendering for Readiness, Session, Review, and controls. |
| src/app.js | Browser orchestration and all side effects. |
| index.html | Semantic layout, styles, and module entry only. |
| test/*.test.js | Node tests for pure modules and app state. |

### Task 1: Test foundation and indicator utilities

**Files:**
- Create: package.json
- Create: src/indicators.js
- Create: test/indicators.test.js

**Interfaces:**
- Produces: ema(values, period), rsi(values, period = 14), atr(bars, period = 14), and trendForBars(bars, fastPeriod = 50, slowPeriod = 200).
- Consumed by: sessions, strategy, and patterns modules.

- [ ] **Step 1: Write the failing indicator tests**

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ema, atr, trendForBars } from '../src/indicators.js';

test('ema returns null until enough values exist', () => {
  assert.equal(ema([1, 2], 3), null);
});

test('trendForBars returns BUY only when price and fast trend are above slow trend', () => {
  assert.equal(trendForBars(risingBars(240)), 'BUY');
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test test/indicators.test.js
Expected: FAIL because src/indicators.js does not exist.

- [ ] **Step 3: Implement src/indicators.js**

Use OHLC objects with time, open, high, low, and close. Return null rather than NaN when input is insufficient. trendForBars returns BUY, SELL, or WAIT without reading global state.

- [ ] **Step 4: Run test to verify it passes**

Run: node --test test/indicators.test.js
Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add package.json src/indicators.js test/indicators.test.js
git commit -m "test: add pure indicator foundation"
~~~

### Task 2: UTC session schedule and range analysis

**Files:**
- Create: src/sessions.js
- Create: test/sessions.test.js

**Interfaces:**
- Consumes: atr from src/indicators.js and a storage-like object with getItem/setItem.
- Produces: DEFAULT_SESSION_SCHEDULE, normalizeSessionSchedule(input), loadSessionSchedule(storage), saveSessionSchedule(storage, schedule), resolveSession(now, schedule), buildAsianRange(bars, now, schedule), and assessSessionBreakout(bars, livePrice, atrValue, now, schedule).
- Consumed by: strategy and UI modules.

- [ ] **Step 1: Write the failing session tests**

~~~js
test('resolves default London at 09:00 UTC', () => {
  assert.deepEqual(resolveSession(new Date('2026-09-29T09:00:00Z')), { name: 'London', active: true, custom: false });
});

test('builds Asian range from closed 00:00-06:00 UTC bars only', () => {
  assert.deepEqual(buildAsianRange(bars, now, DEFAULT_SESSION_SCHEDULE), { high: 101, low: 97, complete: true });
});

test('persists custom schedule and marks it Custom', () => {
  saveSessionSchedule(memoryStorage, customSchedule);
  assert.equal(loadSessionSchedule(memoryStorage).custom, true);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test test/sessions.test.js
Expected: FAIL because src/sessions.js does not exist.

- [ ] **Step 3: Implement src/sessions.js**

Use half-open UTC intervals: 06:00 is outside Asia and 07:00 is inside London. assessSessionBreakout returns Waiting, Breakout, Retest, Invalidated, or Not in Session plus ATR-normalized distance to the closest Asian boundary. Missing/incomplete range returns Waiting.

- [ ] **Step 4: Run test to verify it passes**

Run: node --test test/sessions.test.js
Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/sessions.js test/sessions.test.js
git commit -m "feat: add UTC session range analysis"
~~~

### Task 3: Trade Readiness decision engine

**Files:**
- Create: src/strategy.js
- Create: test/strategy.test.js

**Interfaces:**
- Consumes: indicators and sessions interfaces.
- Produces: evaluateReadiness({ cache, livePrice, dataHealth, now, schedule }) returning Decision with side, state, gates, session, levels, reason, observedAt, and source.
- Consumed by: journal, UI, and app modules.

- [ ] **Step 1: Write failing decision-engine tests**

~~~js
test('blocks stale feed and exposes no actionable levels', () => {
  const d = evaluateReadiness({ cache: alignedCache, livePrice: 100, dataHealth: { fresh: false }, now, schedule });
  assert.equal(d.side, 'WAIT');
  assert.equal(gate(d, 'feed').state, 'blocked');
  assert.deepEqual(d.levels, { entry: null, sl: null, tp: null, initialRisk: null });
});

test('confirms BUY only when all six gates pass', () => {
  const d = evaluateReadiness({ cache: confirmedBuyCache, livePrice: 100, dataHealth: { fresh: true }, now: londonNow, schedule });
  assert.equal(d.state, 'confirmed');
  assert.equal(d.gates.filter(x => x.state === 'pass').length, 6);
});

test('reports distinct 30m conflict and 5m waiting gate reasons', () => {
  assert.equal(gate(conflictDecision, 'trend30m').state, 'blocked');
  assert.equal(gate(waitingDecision, 'trigger5m').state, 'waiting');
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test test/strategy.test.js
Expected: FAIL because src/strategy.js does not exist.

- [ ] **Step 3: Implement evaluateReadiness in src/strategy.js**

Preserve Strategy V2 rules: 4h EMA50/EMA200 bias, matching 30m filter, 5m pullback plus closed-candle breakout/retest, two-closed-candle confirmation, and ATR safer-range/spike guard. Add mandatory session confirmation. Populate levels only for confirmed state. Every gate has stable id, pass/waiting/blocked state, and concise English reason.

- [ ] **Step 4: Run test to verify it passes**

Run: node --test test/strategy.test.js
Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/strategy.js test/strategy.test.js
git commit -m "feat: add trade readiness decision engine"
~~~

### Task 4: Local journal migration and Review analytics

**Files:**
- Create: src/journal.js
- Create: test/journal.test.js

**Interfaces:**
- Consumes: Decision from strategy.
- Produces: migrateJournal(rows), recordConfirmedSetup(rows, decision), resolvePaperOutcome(row, price), filterReview(rows, filters), and aggregateReview(rows, filters).
- Consumed by: app and UI modules.

- [ ] **Step 1: Write failing journal tests**

~~~js
test('migrates legacy row without dropping it', () => {
  assert.equal(migrateJournal([{ key: 'legacy', status: 'WIN' }])[0].setupType, 'Legacy');
});

test('calculates BUY R from initial risk and returns -1R at the stop', () => {
  assert.equal(resolvePaperOutcome({ side: 'BUY', entry: 100, sl: 98 }, 102).r, 1);
  assert.equal(resolvePaperOutcome({ side: 'BUY', entry: 100, sl: 98 }, 98).r, -1);
});

test('excludes expiries and warns below ten completed outcomes', () => {
  const summary = aggregateReview(rowsWithNineClosedAndOneExpired, {});
  assert.equal(summary.minimumSampleWarning, true);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test test/journal.test.js
Expected: FAIL because src/journal.js does not exist.

- [ ] **Step 3: Implement src/journal.js**

Rows store setupType, session, timeframe, gate snapshot, entry, sl, tp, initialRisk, exit, outcome, and r. Never treat expiry as zero return: show it but exclude it from average R and win-rate denominators. Support composable session, setup, direction, and timeframe filters.

- [ ] **Step 4: Run test to verify it passes**

Run: node --test test/journal.test.js
Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/journal.js test/journal.test.js
git commit -m "feat: add journal review analytics"
~~~

### Task 5: Extract data, chart, and pattern infrastructure

**Files:**
- Create: src/data.js
- Create: src/chart.js
- Create: src/patterns.js
- Create: test/data.test.js
- Modify: index.html

**Interfaces:**
- Produces: freshnessFor({ lastTickAt, lastCandleAt, now, maxAgeMs = 12000 }), createMarketDataClient(options), createGoldChart(element), and analyzePatterns(bars).
- Consumed by: app and UI modules.

- [ ] **Step 1: Write failing data-health test**

~~~js
test('freshness requires both tick and candle timestamps below twelve seconds', () => {
  assert.equal(freshnessFor({ lastTickAt: 1000, lastCandleAt: 1000, now: 12999 }).fresh, true);
  assert.equal(freshnessFor({ lastTickAt: 1000, lastCandleAt: 1000, now: 13000 }).fresh, false);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test test/data.test.js
Expected: FAIL because src/data.js does not exist.

- [ ] **Step 3: Extract focused infrastructure modules**

Move current REST fallback, Binance streams, candle upsert, source/error status, Lightweight Charts, price lines, support/resistance lines, and heuristic patterns without changing the feed, chart colors, or pattern rules. The data client accepts callbacks and never updates DOM itself. Keep old inline application code until Task 7 switches to app startup.

- [ ] **Step 4: Run test to verify it passes**

Run: node --test test/data.test.js
Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/data.js src/chart.js src/patterns.js test/data.test.js index.html
git commit -m "refactor: extract market data and chart modules"
~~~

### Task 6: Accessible mobile UI, translations, and controls

**Files:**
- Create: src/i18n.js
- Create: src/ui.js
- Create: test/i18n.test.js
- Modify: index.html

**Interfaces:**
- Consumes: Decision, session analysis, and Review summary.
- Produces: t(language, key, variables), renderReadiness(root, decision, language), renderSession(root, sessionAnalysis, schedule, language), renderReview(root, summary, language), and renderStatic(language).
- Consumed by: app module.

- [ ] **Step 1: Write failing translation tests**

~~~js
test('every readiness, session, and review key has English and Chinese text', () => {
  assert.deepEqual(missingKeys('en'), []);
  assert.deepEqual(missingKeys('zh'), []);
});

test('gate count uses a count rather than profit probability', () => {
  assert.match(t('en', 'readiness.gateCount', { passed: 5, total: 6 }), /5 / 6/);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test test/i18n.test.js
Expected: FAIL because src/i18n.js does not exist.

- [ ] **Step 3: Implement responsive UI and translations**

Add Chart, Patterns, Session, and Review tabs. Add top readiness card with setup name, pass count, reason, six expandable gate explanations, and no actionable levels while WAIT. Add Session screen with UTC time, Asia range, state, distance, stale note, and Advanced schedule controls. Add Review filters and grouped summary. Use buttons, labels, live regions, minimum 44px touch targets, and translations for all new copy. Do not add any risk-profile card.

- [ ] **Step 4: Run test to verify it passes**

Run: node --test test/i18n.test.js
Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/i18n.js src/ui.js test/i18n.test.js index.html
git commit -m "feat: add readiness session and review views"
~~~

### Task 7: App orchestration and compatibility migration

**Files:**
- Create: src/app.js
- Create: test/app-state.test.js
- Modify: index.html
- Modify: manifest.json
- Modify: sw.js

**Interfaces:**
- Consumes: every module above.
- Produces: buildAppState({ cache, livePrice, health, now, schedule, journal }) for tests and bootApp() for browser startup.
- Preserves: timeframes, alert permission/throttle, language setting, chart behavior, patterns, and legacy journal rows.

- [ ] **Step 1: Write failing app-state tests**

~~~js
test('buildAppState carries confirmed decision into journal-ready review state', () => {
  const state = buildAppState(confirmedInput);
  assert.equal(state.decision.state, 'confirmed');
  assert.equal(state.review.rows[0].setupType, 'Gold Trend + Session Breakout');
});

test('buildAppState does not create journal setup for WAIT', () => {
  assert.equal(buildAppState(waitingInput).review.rows.length, 0);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test test/app-state.test.js
Expected: FAIL because src/app.js does not exist.

- [ ] **Step 3: Implement app orchestration and module startup**

Wire data events through data client, update cache/chart/UI, compute readiness only from closed candles, record confirmed transitions once, resolve only open local records from live price, and persist language/alerts/schedule/journal locally. Keep ten-minute alerts and notify only on transition into confirmed. Replace the inline script and duplicate global overrides with one module entry. Update service-worker cache version for new files.

- [ ] **Step 4: Run full test suite**

Run: node --test
Expected: PASS for indicators, sessions, strategy, journal, data, i18n, and app-state tests.

- [ ] **Step 5: Commit**

~~~bash
git add src/app.js test/app-state.test.js index.html manifest.json sw.js
git commit -m "refactor: wire EA-style signal monitor modules"
~~~

### Task 8: Documentation, deployment, and browser acceptance

**Files:**
- Modify: README.md
- Modify: docs/superpowers/specs/2026-09-29-ea-style-analysis-design.md only for approved wording corrections.

**Interfaces:**
- Consumes: completed PWA.
- Produces: user-facing setup notes and verified GitHub Pages release.

- [ ] **Step 1: Update README usage notes**

Document gates, default UTC sessions, Custom label, local-only journal, R-result rule, PAXG proxy limitation, and no trade execution/Vantage ticks.

- [ ] **Step 2: Run final automated verification**

Run: node --test
Expected: all tests PASS with no skipped tests.

Run: node --check src/app.js && node --check src/strategy.js && node --check src/ui.js
Expected: no syntax errors.

- [ ] **Step 3: Perform browser acceptance checks after GitHub Pages deploys**

At 390px width verify no page-level horizontal scroll; both languages cover new views; all tabs work; stale state is WAIT with unavailable levels; saved schedule displays Custom; Review warns on small samples; existing chart, patterns, timeframes, alerts, and proxy caveat still work.

- [ ] **Step 4: Commit**

~~~bash
git add README.md docs/superpowers/specs/2026-09-29-ea-style-analysis-design.md
git commit -m "docs: explain EA-style analysis workflow"
~~~

## Plan Self-Review

- Spec coverage: Tasks 1-7 cover analysis, sessions, storage, Review, translations, proxy state, alerts, and PWA architecture. Task 8 covers deployed mobile verification.
- Scope: no task introduces broker integration, execution, account controls, grid, martingale, averaging-down, news filters, or performance claims.
- Type consistency: Strategy emits Decision; Journal stores Decision snapshots; UI renders Decision/Session/Review; App owns browser side effects.
- Review-focus coverage: stale feed is Task 3; session persistence is Task 2; conflicts are Task 3; legacy/small samples are Task 4; Chinese/mobile regression is Tasks 6 and 8.
- Proportion: eight independently testable tasks map directly to the approved design without prescribing implementation bodies beyond fixed interfaces and behavior.
