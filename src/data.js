export const MARKET_SOURCE = 'Binance PAXG/USDT public market data (gold-backed token proxy)';
export const DEFAULT_FRAMES = ['1m', '5m', '15m', '30m', '4h'];

const DEFAULT_BASES = ['https://data-api.binance.vision/api/v3', 'https://api.binance.com/api/v3'];

export function freshnessFor({ lastTickAt, lastCandleAt, now = Date.now(), maxAgeMs = 12000 } = {}) {
  const tickAgeMs = Number.isFinite(lastTickAt) ? now - lastTickAt : null;
  const candleAgeMs = Number.isFinite(lastCandleAt) ? now - lastCandleAt : null;
  const tickFresh = tickAgeMs !== null && tickAgeMs >= 0 && tickAgeMs < maxAgeMs;
  const candleFresh = candleAgeMs !== null && candleAgeMs >= 0 && candleAgeMs < maxAgeMs;
  const reason = !tickFresh
    ? 'Latest price tick is missing or stale.'
    : !candleFresh
      ? 'Latest candle update is missing or stale.'
      : 'Latest price tick and candle are fresh.';
  return { fresh: tickFresh && candleFresh, tickAgeMs, candleAgeMs, maxAgeMs, reason };
}

const klineToBar = (row) => ({
  time: Math.floor(Number(row[0]) / 1000),
  open: Number(row[1]),
  high: Number(row[2]),
  low: Number(row[3]),
  close: Number(row[4]),
});

export function upsertBar(cache, timeframe, bar, limit = 300) {
  const bars = cache[timeframe] ?? [];
  const index = bars.findIndex((item) => item.time === bar.time);
  if (index >= 0) bars[index] = bar;
  else {
    bars.push(bar);
    bars.sort((first, second) => first.time - second.time);
    if (bars.length > limit) bars.splice(0, bars.length - limit);
  }
  cache[timeframe] = bars;
  return bars;
}

export function createMarketDataClient({
  symbol = 'PAXGUSDT',
  frames = DEFAULT_FRAMES,
  cache = {},
  fetchImpl = globalThis.fetch?.bind(globalThis),
  webSocketFactory = (url) => new WebSocket(url),
  now = () => Date.now(),
  onStatus = () => {},
  onTick = () => {},
  onCandle = () => {},
  onError = () => {},
} = {}) {
  let tickSocket;
  let candleSocket;
  let lastTickAt = null;
  let lastCandleAt = null;
  let livePrice = null;
  const bases = DEFAULT_BASES;

  const health = () => freshnessFor({ lastTickAt, lastCandleAt, now: now() });
  const emitStatus = (status, error = false) => onStatus({ status, error, health: health() });

  async function getJson(path) {
    let lastError;
    for (const base of bases) {
      try {
        const response = await fetchImpl(`${base}${path}`, { cache: 'no-store' });
        if (response.ok) return response.json();
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error('Market data unavailable');
  }

  async function load(timeframe) {
    const rows = await getJson(`/klines?symbol=${symbol}&interval=${timeframe}&limit=300`);
    const bars = rows.map(klineToBar);
    cache[timeframe] = bars;
    lastCandleAt = now();
    onCandle({ timeframe, bar: bars.at(-1), closed: false, initial: true, cache, health: health() });
    return bars;
  }

  async function loadAll() {
    await Promise.all(frames.map(load));
    return cache;
  }

  function handleTrade(message) {
    const price = Number(message.p);
    if (!Number.isFinite(price)) return;
    livePrice = price;
    lastTickAt = now();
    const bucket = Math.floor(Number(message.T) / 60000) * 60;
    const current = cache['1m']?.at(-1);
    if (current?.time === bucket) {
      upsertBar(cache, '1m', {
        ...current,
        high: Math.max(current.high, price),
        low: Math.min(current.low, price),
        close: price,
      });
    }
    onTick({ price, timestamp: Number(message.T), cache, health: health() });
  }

  function handleCandle(payload) {
    const kline = payload.data?.k;
    if (!kline || !frames.includes(kline.i)) return;
    const bar = {
      time: Math.floor(Number(kline.t) / 1000),
      open: Number(kline.o),
      high: Number(kline.h),
      low: Number(kline.l),
      close: Number(kline.c),
    };
    upsertBar(cache, kline.i, bar);
    lastCandleAt = now();
    onCandle({ timeframe: kline.i, bar, closed: Boolean(kline.x), cache, health: health() });
  }

  function startStreams() {
    const streamSymbol = symbol.toLowerCase();
    tickSocket = webSocketFactory(`wss://data-stream.binance.vision/ws/${streamSymbol}@trade`);
    tickSocket.onopen = () => emitStatus('LIVE');
    tickSocket.onmessage = (event) => handleTrade(JSON.parse(event.data));
    tickSocket.onerror = (error) => onError(error);
    tickSocket.onclose = () => emitStatus('TICK DISCONNECTED', true);

    const streams = frames.map((frame) => `${streamSymbol}@kline_${frame}`).join('/');
    candleSocket = webSocketFactory(`wss://data-stream.binance.vision/stream?streams=${streams}`);
    candleSocket.onopen = () => emitStatus('LIVE');
    candleSocket.onmessage = (event) => handleCandle(JSON.parse(event.data));
    candleSocket.onerror = (error) => onError(error);
    candleSocket.onclose = () => emitStatus('CANDLE DISCONNECTED', true);
  }

  async function start() {
    emitStatus('LOADING');
    try {
      await loadAll();
      emitStatus('LIVE');
      startStreams();
      return cache;
    } catch (error) {
      emitStatus('ERROR', true);
      onError(error);
      throw error;
    }
  }

  function stop() {
    tickSocket?.close();
    candleSocket?.close();
  }

  return { cache, load, loadAll, start, stop, health, get livePrice() { return livePrice; } };
}
