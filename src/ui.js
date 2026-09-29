import { t } from './i18n.js';

const formatPrice = (value) => Number.isFinite(value) ? Number(value).toFixed(2) : '—';
const formatR = (value) => Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}R` : '—';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const stateText = (language, state) => t(language, `gate.${state}`);
const sessionStateKey = (state) => ({ 'Not in Session': 'notInSession', Waiting: 'waiting', Breakout: 'breakout', Retest: 'retest', Invalidated: 'invalidated' }[state] ?? 'waiting');
const chineseGateReasons = {
  feed: { pass: '最新价格与K线数据都在新鲜度范围内。', blocked: '实时价格或K线数据已过期；请等待新的数据更新。', waiting: '正在等待完整的市场数据。' },
  trend4h: { pass: '4小时均线趋势已给出明确方向。', blocked: '4小时趋势不支持当前方向。', waiting: '正在等待明确的4小时均线趋势。' },
  trend30m: { pass: '30分钟趋势与4小时方向一致。', blocked: '30分钟趋势与4小时方向冲突。', waiting: '正在等待明确的30分钟均线趋势。' },
  trigger5m: { pass: '两根已收盘的5分钟K线确认了回调后的突破。', blocked: '5分钟触发方向与高周期趋势冲突。', waiting: '正在等待5分钟回调、突破和第二根收盘K线确认。' },
  session: { pass: '当前时段确认亚洲区间的突破或回踩。', blocked: '当前不在可用时段，或时段方向与设定冲突。', waiting: '正在等待完整亚洲区间与时段确认。' },
  volatility: { pass: 'ATR 处于设定的较安全范围内。', blocked: 'ATR 或最新K线异常，当前不满足波动率条件。', waiting: '正在等待完整的 ATR 数据。' },
};
const gateReason = (language, gate) => language === 'zh'
  ? (chineseGateReasons[gate.id]?.[gate.state] ?? gate.reason)
  : gate.reason;

export function renderReadiness(root, decision, language) {
  if (!root || !decision) return;
  const passed = decision.gates.filter((gate) => gate.state === 'pass').length;
  const confirmed = decision.state === 'confirmed';
  const levels = decision.levels ?? {};
  const gateRows = decision.gates.map((gate) => `<details class="gate gate-${escapeHtml(gate.state)}">
    <summary><span>${escapeHtml(t(language, `gate.${gate.id}`))}</span><b>${escapeHtml(stateText(language, gate.state))}</b></summary>
    <p>${escapeHtml(gateReason(language, gate))}</p>
  </details>`).join('');
  root.innerHTML = `<section class="card readiness-card ${confirmed ? 'confirmed' : 'waiting'}" aria-live="polite">
    <div class="line"><div><small>${escapeHtml(t(language, 'readiness.title'))}</small><h2>${escapeHtml(t(language, 'readiness.setup'))}</h2></div><span class="state-pill">${escapeHtml(t(language, confirmed ? 'readiness.confirmed' : 'readiness.waiting'))}</span></div>
    <p class="readiness-count">${escapeHtml(t(language, 'readiness.gateCount', { passed, total: decision.gates.length }))}</p>
    <p class="reason">${escapeHtml(confirmed ? (language === 'zh' ? '六项就绪条件均已通过。' : decision.reason) : gateReason(language, decision.gates.find((gate) => gate.state !== 'pass') ?? { id: 'feed', state: 'waiting', reason: decision.reason }))}</p>
    <div class="readiness-gates"><b>${escapeHtml(t(language, 'readiness.gates'))}</b>${gateRows}</div>
    <div class="levels"><div class="level"><small>${escapeHtml(t(language, 'level.entry'))}</small><b>${confirmed ? formatPrice(levels.entry) : '—'}</b></div><div class="level"><small>${escapeHtml(t(language, 'level.sl'))}</small><b>${confirmed ? formatPrice(levels.sl) : '—'}</b></div><div class="level"><small>${escapeHtml(t(language, 'level.tp'))}</small><b>${confirmed ? formatPrice(levels.tp) : '—'}</b></div></div>
    <p class="muted">${escapeHtml(confirmed ? t(language, 'readiness.closedOnly') : t(language, 'readiness.noLevels'))}</p>
  </section>`;
}

export function renderSession(root, sessionAnalysis, schedule, language) {
  if (!root || !sessionAnalysis || !schedule) return;
  const range = sessionAnalysis.range ?? {};
  const session = sessionAnalysis.session ?? {};
  const custom = Boolean(schedule.custom);
  const windows = ['Asia', 'London', 'New York'].map((name) => {
    const window = schedule[name];
    return `<label>${escapeHtml(name)} <input data-session-name="${escapeHtml(name)}" data-session-field="start" type="number" min="0" max="23" value="${escapeHtml(window.start)}" aria-label="${escapeHtml(name)} start UTC">–<input data-session-name="${escapeHtml(name)}" data-session-field="end" type="number" min="1" max="24" value="${escapeHtml(window.end)}" aria-label="${escapeHtml(name)} end UTC"></label>`;
  }).join('');
  root.innerHTML = `<section class="card" aria-live="polite">
    <div class="line"><div><h2>${escapeHtml(t(language, 'session.title'))}</h2><span class="muted">${escapeHtml(t(language, 'session.utc'))}: ${escapeHtml(session.name ?? '—')}</span></div><span class="state-pill">${escapeHtml(t(language, custom ? 'session.custom' : 'session.default'))}</span></div>
    <div class="session-grid"><div class="level"><small>${escapeHtml(t(language, 'session.asiaRange'))}</small><b>${formatPrice(range.low)} – ${formatPrice(range.high)}</b><span>${escapeHtml(t(language, range.complete ? 'session.complete' : 'session.incomplete'))}</span></div><div class="level"><small>${escapeHtml(t(language, 'session.state'))}</small><b>${escapeHtml(t(language, `session.${sessionStateKey(sessionAnalysis.state)}`))}</b><span>${escapeHtml(t(language, 'session.distance'))}: ${Number.isFinite(sessionAnalysis.distanceAtr) ? `${sessionAnalysis.distanceAtr.toFixed(2)} ATR` : '—'}</span></div></div>
    <details class="advanced-schedule"><summary>${escapeHtml(t(language, 'session.advanced'))}</summary><div class="session-controls">${windows}</div><div class="button-row"><button type="button" data-action="save-schedule">${escapeHtml(t(language, 'session.save'))}</button><button type="button" data-action="reset-schedule">${escapeHtml(t(language, 'session.reset'))}</button></div></details>
  </section>`;
}

export function renderReview(root, summary, language, filters = {}) {
  if (!root || !summary) return;
  const select = (name, label, options) => `<label>${escapeHtml(label)}<select data-review-filter="${escapeHtml(name)}"><option value="all">${escapeHtml(t(language, 'review.all'))}</option>${options.map((option) => `<option value="${escapeHtml(option)}" ${filters[name] === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`;
  const rows = summary.rows ?? [];
  const unique = (field) => [...new Set(rows.map((row) => row[field]).filter(Boolean))];
  const filtersHtml = [
    select('session', t(language, 'review.session'), unique('session')),
    select('setupType', t(language, 'review.setup'), unique('setupType')),
    select('side', t(language, 'review.direction'), unique('side')),
    select('timeframe', t(language, 'review.timeframe'), unique('timeframe')),
  ].join('');
  const tableRows = rows.map((row) => `<tr><td>${escapeHtml(row.session)}</td><td>${escapeHtml(row.side)}</td><td>${escapeHtml(row.timeframe)}</td><td>${escapeHtml(t(language, `outcome.${row.outcome}`))}</td><td>${escapeHtml(formatR(row.r))}</td></tr>`).join('');
  root.innerHTML = `<section class="card review-card"><div class="line"><h2>${escapeHtml(t(language, 'review.title'))}</h2><span class="muted">${escapeHtml(t(language, 'review.localOnly'))}</span></div>
    <fieldset class="review-filters"><legend>${escapeHtml(t(language, 'review.filters'))}</legend>${filtersHtml}</fieldset>
    <div class="review-summary"><div><small>${escapeHtml(t(language, 'review.total'))}</small><b>${summary.total}</b></div><div><small>${escapeHtml(t(language, 'review.completed'))}</small><b>${summary.completed}</b></div><div><small>${escapeHtml(t(language, 'review.winRate'))}</small><b>${summary.winRate == null ? '—' : `${(summary.winRate * 100).toFixed(1)}%`}</b></div><div><small>${escapeHtml(t(language, 'review.averageR'))}</small><b>${formatR(summary.averageR)}</b></div><div><small>${escapeHtml(t(language, 'review.open'))}</small><b>${summary.open}</b></div><div><small>${escapeHtml(t(language, 'review.expired'))}</small><b>${summary.expired}</b></div></div>
    ${summary.minimumSampleWarning ? `<p class="sample-warning">${escapeHtml(t(language, 'review.sampleWarning'))}</p>` : ''}
    ${rows.length ? `<div class="review-table-wrap"><table><thead><tr><th>${escapeHtml(t(language, 'review.session'))}</th><th>${escapeHtml(t(language, 'review.direction'))}</th><th>${escapeHtml(t(language, 'review.timeframe'))}</th><th>${escapeHtml(t(language, 'review.outcome'))}</th><th>${escapeHtml(t(language, 'review.r'))}</th></tr></thead><tbody>${tableRows}</tbody></table></div>` : `<p class="muted">${escapeHtml(t(language, 'review.noRows'))}</p>`}
  </section>`;
}

export function renderStatic(documentRoot, language) {
  documentRoot?.querySelectorAll?.('[data-i18n]').forEach((element) => {
    element.textContent = t(language, element.dataset.i18n);
  });
}
