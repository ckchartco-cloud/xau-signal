# EA-Style XAUUSD Analysis Design

**Status:** Approved design; pending user review before implementation  
**Date:** 2026-09-29  
**Scope:** Personal, mobile-first XAUUSD signal monitor hosted on GitHub Pages.

## Purpose

Help an experienced discretionary trader decide whether an XAUUSD setup is ready, incomplete, or unsafe to act on. The app remains a monitoring and analysis tool; it will not send orders, size positions, or implement account-level risk automation.

## User and constraints

- Personal iPhone use, responsive PWA, English and Simplified Chinese.
- XAUUSD only, with 1m, 5m, 15m, 30m, and 4h views.
- Free GitHub Pages hosting and the existing PAXG/USDT public-feed proxy. The UI must clearly state that the price can differ from Vantage XAUUSD.
- Existing alert, chart, pattern, strategy-state, levels, language, and local paper-journal features remain available.
- The removed Automatic trading risk profile must not return.

## Research-informed strategy choice

There is no authoritative market-wide ranking for the most-used XAUUSD EA. Current MQL5 marketplace listings are vendor descriptions rather than independently validated performance. Their recurring design patterns are useful, however: multi-timeframe trend plus breakout/pullback confirmation, Asian/London/New York session handling, volatility/spread-aware no-trade conditions, and a real-time explanation panel.

References:

- [Gold Pro Breakout](https://www.mql5.com/en/market/product/172353): multi-timeframe breakout, pullback confirmation, ATR and spread display, trade statistics.
- [Triple Session Breakout](https://www.mql5.com/en/market/product/170467): Asian, London, and New York range monitoring.
- [AXIO Gold EA](https://www.mql5.com/en/market/product/173872): selective market-structure entries and explicit waiting in unclear conditions.

The app will adopt transparent decision gates, not black-box predictions. It will not add martingale, grid, averaging-down, automatic trading, position sizing, or promises of accuracy.

## Selected approach: Gold Trend + Session Breakout

The existing Strategy V2 remains the foundation: 5-minute entries, 30-minute and 4-hour trend filters, closed-candle confirmation, and ATR-derived levels. The new layer adds session context and a readable gate-by-gate explanation.

A setup is actionable only when every mandatory gate passes. A failing gate produces WAIT and explains the exact reason. No entry, stop-loss, or take-profit values are presented as an actionable setup while the decision is WAIT.

### Mandatory gates

1. **Feed health** — market data must be fresh. A stale or disconnected source always blocks a setup.
2. **4-hour trend** — EMA50/EMA200 and price agree on BUY or SELL bias.
3. **30-minute trend filter** — direction agrees with the 4-hour bias.
4. **5-minute trigger** — trend pullback plus closed-candle breakout/retest confirmation.
5. **Session context** — London or New York active session, with an Asian-range breakout/retest if the session-breakout mode is enabled.
6. **Volatility guard** — ATR is within the existing safer range and the latest closed candle is not an abnormal spike.

The session clock uses UTC. Asia, London, and New York hours are configurable parameters with clearly labelled defaults so seasonal time changes can be adjusted without changing code.

## Mobile user experience

### Home: Trade Readiness

The top of the chart view becomes a compact decision card:

- Decision: BUY, SELL, or WAIT.
- Setup name: Gold Trend + Session Breakout.
- Confidence is shown as a gate count such as 5 / 6 checks passed, never as a predicted probability of profit.
- A single plain-language reason, for example: WAIT: 4h and 30m are bearish, but the 5m retest has not closed.
- Entry, stop-loss, and take-profit remain below the card and only activate on a confirmed setup.

Below it, a horizontal, touch-friendly gate list presents Feed, 4H, 30m, 5m, Session, and Volatility as Pass, Waiting, or Blocked. Tapping a gate opens its short explanation.

### Session view

A new Session tab shows:

- Current UTC time and named session state.
- The completed Asian range high and low.
- London and New York breakout/retest state: Waiting, Breakout, Retest, Invalidated, or Not in Session.
- Distance from price to the nearest range boundary, normalized by ATR.
- A concise note when session data is incomplete or the feed is stale.

### Review view

The existing local paper journal evolves into a Review tab. It is explicitly local analysis, not a broker statement or historical backtest.

New entries record the decision snapshot: timestamp, signal side, setup type, UTC session, gate results, entry, initial stop, target, and final outcome. Existing journal records remain readable; unavailable new fields display as Legacy rather than failing.

The analytics cards show:

- Confirmed setups, wins, losses, reversals, expiries, and open setups.
- Win rate and average R-result for closed records with enough data.
- Results grouped by session, setup type, direction, and selected timeframe.
- A minimum-sample warning whenever a segment has fewer than 10 completed records.

## Technical architecture

The current single-page PWA will stay dependency-light and compatible with GitHub Pages. During implementation, the large inline script will be separated into focused browser modules:

- data.js: feed connection, candle cache, freshness and proxy labels.
- indicators.js: EMA, RSI, ATR, swing/range helpers, and no side effects.
- strategy.js: trend, 5m trigger, volatility guard, and a structured decision result.
- sessions.js: UTC schedules, Asian range construction, breakout/retest state.
- journal.js: local-storage schema, migration, outcome evaluation, and analytics aggregation.
- ui.js: render functions, view tabs, translations, and accessible interactions.
- index.html: semantic mobile layout, styles, and module loading only.

The common interface is a structured decision result:

    {
      side: 'BUY' | 'SELL' | 'WAIT',
      state: 'confirmed' | 'setup' | 'waiting' | 'blocked',
      gates: [{ id, state, label, reason }],
      session: { name, state, asianHigh, asianLow },
      levels: { entry, sl, tp, initialRisk },
      reason,
      observedAt,
      source
    }

Functions calculate data; rendering and storage consume that result. This avoids the current pattern of repeatedly overriding global functions.

## Data, alerts, and safety

- Closed candles decide signals. The live tick only updates the price marker and evaluates an already-recorded paper setup.
- The source label always identifies the PAXG proxy, freshness age, and non-Vantage limitation.
- An alert is allowed only on a transition into confirmed; it includes the setup and one blocking caveat if present. The ten-minute alert throttle remains.
- All storage is local to the browser. Clearing the journal is explicit and does not affect price data or settings.
- The app must never claim zero-delay ticks, broker-level spread, fill quality, profitability, or Vantage-price equivalence.

## Acceptance criteria and verification

1. At 390px width, the decision card and gate list are readable without horizontal page scrolling.
2. English and Chinese translations cover every new visible label, state, and explanation.
3. Feed loss/staleness immediately yields WAIT and hides actionable levels.
4. A confirmed setup requires all mandatory gates; any failed gate names its reason.
5. Session calculations use UTC and can be changed through documented settings.
6. A journal entry stores the decision snapshot and persists after reload; legacy entries render safely.
7. Review calculations group completed local records correctly and show the minimum-sample warning.
8. Existing timeframe switching, patterns, language selection, alerts, chart, levels, and performance/journal behavior continue to work.
9. Browser-level checks cover the decision engine, session boundaries, journal aggregation, translations, and the no-regression UI flow.

## Out of scope

- Vantage API or broker integration.
- Live trade execution, trade copier, EA, or account control.
- Automatic risk profiles, lot sizing, grid, martingale, or averaging-down systems.
- Claims of backtested or live profitability.
- News-calendar trading filter; it requires a reliable data source and is a separate future project.
