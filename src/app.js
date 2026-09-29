import { createGoldChart } from './chart.js';
import { createMarketDataClient, DEFAULT_FRAMES } from './data.js';
import { trendForBars } from './indicators.js';
import { aggregateReview, migrateJournal, recordConfirmedSetup, resolvePaperOutcome } from './journal.js';
import { analyzePatterns } from './patterns.js';
import { DEFAULT_SESSION_SCHEDULE, loadSessionSchedule, saveSessionSchedule } from './sessions.js';
import { evaluateReadiness } from './strategy.js';
import { t } from './i18n.js';
import { renderReadiness, renderReview, renderSession, renderStatic } from './ui.js';

const JOURNAL_KEY = 'xauReviewJournal';
const ALERT_KEY = 'xauAlerts';
const LANGUAGE_KEY = 'xauLanguage';
const FRAME_LABELS = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '4h': '4h' };
const PATTERN_ZH = {
  'Ascending triangle': '上升三角形', 'Descending triangle': '下降三角形', 'Double top': '双顶', 'Double bottom': '双底', 'Rising wedge': '上升楔形', 'Falling wedge': '下降楔形', 'Bull flag': '看涨旗形', 'Bear flag': '看跌旗形', 'Range / consolidation': '区间/盘整', 'No clear pattern': '没有明确形态', 'Waiting for candles…': '正在等待K线…',
};

export function buildAppState({ cache = {}, livePrice = null, health = {}, now = new Date(), schedule = DEFAULT_SESSION_SCHEDULE, journal = [], filters = {} } = {}) {
  const decision = evaluateReadiness({ cache, livePrice, dataHealth: health, now, schedule });
  const rows = decision.state === 'confirmed' ? recordConfirmedSetup(journal, decision) : migrateJournal(journal);
  return { decision, review: aggregateReview(rows, filters), journal: rows };
}

export function canNotify({ alertsOn, previousState, key, lastKey, lastAlertAt, now }) {
  return Boolean(alertsOn)
    && previousState !== 'confirmed'
    && key !== lastKey
    && now - lastAlertAt >= 10 * 60 * 1000;
}

const byId = (id) => document.getElementById(id);
const safeRead = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) ?? '') ?? fallback; } catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const formatPrice = (value) => Number.isFinite(value) ? Number(value).toFixed(2) : '—';
const signalLabel = (language, side) => language === 'zh'
  ? (side === 'BUY' ? '▲ 买入' : side === 'SELL' ? '▼ 卖出' : '● 观望')
  : (side === 'BUY' ? '▲ BUY' : side === 'SELL' ? '▼ SELL' : '● WAIT');

function supportResistance(bars, current) {
  const closed = bars?.slice(0, -1) ?? [];
  if (closed.length < 10 || !Number.isFinite(current)) return { support: [], resistance: [] };
  const distance = Math.max(current * 0.0015, (closed.at(-1).high - closed.at(-1).low) * 2);
  const support = [];
  const resistance = [];
  for (let index = Math.max(2, closed.length - 120); index < closed.length - 1; index += 1) {
    const bar = closed[index];
    if (bar.high > current && bar.high >= closed[index - 1].high && bar.high >= closed[index + 1].high && !resistance.some((price) => Math.abs(price - bar.high) <= distance)) resistance.push(bar.high);
    if (bar.low < current && bar.low <= closed[index - 1].low && bar.low <= closed[index + 1].low && !support.some((price) => Math.abs(price - bar.low) <= distance)) support.push(bar.low);
  }
  return { support: support.sort((a, b) => b - a), resistance: resistance.sort((a, b) => a - b) };
}

export function bootApp() {
  const cache = {};
  let language = localStorage.getItem(LANGUAGE_KEY) === 'zh' ? 'zh' : 'en';
  let alertsOn = localStorage.getItem(ALERT_KEY) === 'on';
  let schedule = loadSessionSchedule(localStorage);
  let journal = migrateJournal(safeRead(JOURNAL_KEY, []));
  let reviewFilters = {};
  let livePrice = null;
  let selectedFrame = '5m';
  let status = 'CONNECTING';
  let statusError = false;
  let latestDecisionState = 'waiting';
  let lastConfirmedKey = '';
  let lastAlertKey = '';
  let lastAlertAt = 0;
  let queued = false;
  const chart = createGoldChart(byId('chart'));
  const client = createMarketDataClient({
    cache,
    onStatus: ({ status: next, error }) => { status = next; statusError = error; queueRender(); },
    onTick: ({ price }) => { livePrice = price; settleOpenJournal(); queueRender(); },
    onCandle: ({ timeframe, bar }) => { if (timeframe === selectedFrame) chart.update(bar); expireOldJournal(); queueRender(); },
    onError: (error) => { byId('error').textContent = error?.message ?? String(error); },
  });

  const setStatus = () => {
    const element = byId('status');
    element.textContent = t(language, `status.${status}`);
    element.className = `status${statusError ? ' error' : ''}`;
  };
  const persistJournal = () => write(JOURNAL_KEY, journal);
  const currentClosedTime = () => cache['5m']?.at(-2)?.time ?? null;
  const signalTime = () => {
    const seconds = currentClosedTime();
    return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
  };
  const settleOpenJournal = () => {
    if (!Number.isFinite(livePrice)) return;
    let changed = false;
    journal = journal.map((row) => {
      if (row.outcome !== 'OPEN') return row;
      const resolved = resolvePaperOutcome(row, livePrice);
      if (resolved.outcome !== 'OPEN') { changed = true; return resolved; }
      return row;
    });
    if (changed) persistJournal();
  };
  const expireOldJournal = () => {
    const closedTime = currentClosedTime();
    if (!Number.isFinite(closedTime)) return;
    let changed = false;
    journal = journal.map((row) => {
      const observed = Date.parse(row.observedAt) / 1000;
      if (row.outcome === 'OPEN' && Number.isFinite(observed) && closedTime - observed >= 8 * 300) {
        changed = true;
        return { ...row, outcome: 'EXPIRED', status: 'EXPIRED' };
      }
      return row;
    });
    if (changed) persistJournal();
  };
  const notifyConfirmed = (decision) => {
    const key = `${decision.side}-${decision.levels.entry}`;
    const currentTime = Date.now();
    if (!canNotify({ alertsOn, previousState: latestDecisionState, key, lastKey: lastAlertKey, lastAlertAt, now: currentTime })) return;
    lastAlertKey = key;
    lastAlertAt = currentTime;
    const body = language === 'zh' ? `已确认 ${signalLabel(language, decision.side)}：六项条件均已通过。` : `Confirmed ${decision.side}: all six readiness gates pass.`;
    if ('Notification' in window && Notification.permission === 'granted') new Notification(t(language, 'app.title'), { body });
  };
  const renderPattern = () => {
    const root = byId('patternsRoot');
    const pattern = analyzePatterns(cache[selectedFrame] ?? []);
    const name = (value) => language === 'zh' ? (PATTERN_ZH[value] ?? value) : value;
    const bias = (value) => t(language, `pattern.${value === 'BULLISH' ? 'bullish' : value === 'BEARISH' ? 'bearish' : 'neutral'}`);
    root.innerHTML = `<section class="card"><div class="line"><div><small>${selectedFrame}</small><h2>${name(pattern.best.name)}</h2></div><span class="state-pill">${pattern.best.score}% · ${bias(pattern.best.bias)}</span></div><p class="reason">${language === 'zh' ? t(language, 'pattern.explanation') : pattern.best.reason}</p><div class="levels"><div class="level"><small>${t(language, 'pattern.support')}</small><b>${formatPrice(pattern.support)}</b></div><div class="level"><small>${t(language, 'pattern.resistance')}</small><b>${formatPrice(pattern.resistance)}</b></div></div><div class="pattern-alternatives">${pattern.candidates.slice(1, 4).map((item) => `<div class="row"><span>${name(item.name)}</span><span>${item.score}% · ${bias(item.bias)}</span></div>`).join('')}</div><p class="note">${t(language, 'pattern.note')}</p></section>`;
  };
  const renderChart = (decision) => {
    const bars = cache[selectedFrame] ?? [];
    const price = livePrice ?? bars.at(-1)?.close;
    byId('price').textContent = formatPrice(price);
    const previous = bars.at(-2)?.close;
    byId('change').textContent = Number.isFinite(previous) && Number.isFinite(price) ? `${((price / previous - 1) * 100).toFixed(2)}% ${t(language, 'app.previousCandle')}` : t(language, 'app.loading');
    const signal = byId('signal');
    signal.textContent = signalLabel(language, decision.side);
    signal.className = `signal ${decision.side.toLowerCase()}`;
    byId('signalTf').textContent = selectedFrame;
    byId('signalInfo').textContent = `${decision.gates.filter((gate) => gate.state === 'pass').length} / 6 gates pass · ${decision.source}`;
    byId('updated').textContent = new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-GB');
    byId('mtf').innerHTML = ['4h', '30m', '5m'].map((frame) => {
      const side = trendForBars((cache[frame] ?? []).slice(0, -1));
      return `<div class="row"><span>${FRAME_LABELS[frame]}</span><span class="${side.toLowerCase()}">${signalLabel(language, side)}</span></div>`;
    }).join('');
    if (bars.length) chart.setLevels(decision.levels);
    chart.setSupportResistance(supportResistance(bars, price));
    chart.setLivePrice(price);
  };
  const render = () => {
    queued = false;
    setStatus();
    renderStatic(document, language);
    const decision = evaluateReadiness({ cache, livePrice, dataHealth: client.health(), now: new Date(), schedule });
    const confirmedKey = decision.state === 'confirmed' ? `${decision.side}-${decision.levels.entry}` : '';
    if (confirmedKey && confirmedKey !== lastConfirmedKey) {
      journal = recordConfirmedSetup(journal, { ...decision, observedAt: signalTime() });
      persistJournal();
      notifyConfirmed(decision);
    }
    lastConfirmedKey = confirmedKey;
    latestDecisionState = decision.state;
    const health = client.health();
    byId('source').textContent = `${t(language, 'source.proxy')} · ${t(language, health.fresh ? 'app.fresh' : 'app.stale')}`;
    byId('alertBtn').textContent = t(language, alertsOn ? 'app.alertOn' : 'app.alertOff');
    byId('alertBtn').classList.toggle('on', alertsOn);
    renderReadiness(byId('readinessRoot'), decision, language);
    renderChart(decision);
    renderPattern();
    renderSession(byId('sessionRoot'), decision.session, schedule, language);
    renderReview(byId('reviewRoot'), aggregateReview(journal, reviewFilters), language, reviewFilters);
  };
  const queueRender = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  };
  const selectFrame = async (frame) => {
    selectedFrame = frame;
    document.querySelectorAll('[data-frame]').forEach((button) => button.classList.toggle('active', button.dataset.frame === frame));
    try {
      if (!cache[frame]) await client.load(frame);
      chart.setData(cache[frame]);
      queueRender();
    } catch (error) { byId('error').textContent = error.message; }
  };
  const setView = (view) => {
    ['chart', 'patterns', 'session', 'review'].forEach((name) => {
      byId(`${name}View`).hidden = name !== view;
      byId(`${name}Tab`).classList.toggle('active', name === view);
    });
  };

  document.querySelectorAll('[data-frame]').forEach((button) => button.addEventListener('click', () => selectFrame(button.dataset.frame)));
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  byId('language').value = language;
  byId('language').addEventListener('change', (event) => { language = event.target.value; localStorage.setItem(LANGUAGE_KEY, language); queueRender(); });
  byId('alertBtn').addEventListener('click', async () => {
    alertsOn = !alertsOn;
    localStorage.setItem(ALERT_KEY, alertsOn ? 'on' : 'off');
    if (alertsOn && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    queueRender();
  });
  byId('app').addEventListener('click', (event) => {
    if (event.target.dataset.action === 'save-schedule') {
      const candidate = {};
      ['Asia', 'London', 'New York'].forEach((name) => {
        const inputs = [...byId('sessionRoot').querySelectorAll(`[data-session-name="${name}"]`)];
        candidate[name] = { start: Number(inputs.find((input) => input.dataset.sessionField === 'start')?.value), end: Number(inputs.find((input) => input.dataset.sessionField === 'end')?.value) };
      });
      schedule = saveSessionSchedule(localStorage, candidate);
      queueRender();
    }
    if (event.target.dataset.action === 'reset-schedule') { schedule = saveSessionSchedule(localStorage, DEFAULT_SESSION_SCHEDULE); queueRender(); }
  });
  byId('app').addEventListener('change', (event) => {
    const field = event.target.dataset.reviewFilter;
    if (field) { reviewFilters = { ...reviewFilters, [field]: event.target.value }; queueRender(); }
  });
  setView('chart');
  render();
  client.start().then(() => selectFrame(selectedFrame)).catch((error) => { byId('error').textContent = `Market data unavailable. ${error.message}`; });
  setInterval(queueRender, 5000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') bootApp();
