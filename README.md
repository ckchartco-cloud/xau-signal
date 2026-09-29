# XAU Signal

Mobile-first, personal XAUUSD setup monitor hosted as a GitHub Pages PWA.

## What it does

- Shows 1m, 5m, 15m, 30m, and 4h charts for the PAXG/USDT market-data proxy.
- Uses the **Gold Trend + Session Breakout** checklist: fresh feed, 4h trend, 30m trend, two closed 5m confirmation candles, session context, and volatility.
- A BUY or SELL appears only when all six gates pass. Otherwise the app shows WAIT and hides its reference levels.
- Supports English and Simplified Chinese, browser alerts, pattern summaries, local Session settings, and a local Review journal.

## Important data limitation

The free feed is Binance **PAXG/USDT**, a gold-backed-token proxy. It can differ from Vantage XAUUSD and is not Vantage broker-tick data, spread data, fill data, or a guarantee of no delay. The app does not send orders or calculate lot sizes.

## Sessions and signal rules

All session times use UTC by default:

- Asia range: 00:00–06:00
- London: 07:00–11:00
- New York: 13:00–17:00

The Session tab lets you edit the hours for this browser. Saved changes are local and visibly marked **Custom**. Signals use completed candles only; live price updates only the price marker and the resolution of already-recorded paper setups.

## Review journal

The Review tab stores its data in your browser only. It is not a backtest or broker statement. A result is calculated in units of initial risk: `(exit − entry, adjusted for direction) / initial risk`; a stop is `-1R`. Expired setups are displayed but excluded from win rate and average R. Treat fewer than ten completed results as too small a sample for conclusions.

## Use on iPhone

Open the GitHub Pages URL in Safari, then use **Share → Add to Home Screen**. Browser notifications depend on the browser and permission settings.

## Safety boundaries

This is an analysis monitor, not an EA. It intentionally does not include automatic trading, trade copying, automatic risk profiles, grid, martingale, averaging-down, account controls, or profitability claims.
