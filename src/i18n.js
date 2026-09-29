const requiredKeys = [
  'app.title', 'app.language', 'app.alertOn', 'app.alertOff', 'app.loading', 'app.previousCandle', 'app.mtf', 'app.note', 'app.fresh', 'app.stale', 'source.proxy',
  'status.CONNECTING', 'status.LOADING', 'status.LIVE', 'status.ERROR', 'status.TICK DISCONNECTED', 'status.CANDLE DISCONNECTED',
  'view.chart', 'view.patterns', 'view.session', 'view.review',
  'readiness.title', 'readiness.setup', 'readiness.confirmed', 'readiness.waiting', 'readiness.gateCount', 'readiness.gates', 'readiness.levels', 'readiness.noLevels', 'readiness.closedOnly',
  'gate.feed', 'gate.trend4h', 'gate.trend30m', 'gate.trigger5m', 'gate.session', 'gate.volatility', 'gate.pass', 'gate.waiting', 'gate.blocked',
  'level.entry', 'level.sl', 'level.tp',
  'session.title', 'session.utc', 'session.asiaRange', 'session.high', 'session.low', 'session.complete', 'session.incomplete', 'session.distance', 'session.state', 'session.custom', 'session.default', 'session.advanced', 'session.save', 'session.reset', 'session.notInSession', 'session.waiting', 'session.breakout', 'session.retest', 'session.invalidated',
  'review.title', 'review.localOnly', 'review.sampleWarning', 'review.total', 'review.completed', 'review.winRate', 'review.averageR', 'review.expired', 'review.open', 'review.filters', 'review.all', 'review.session', 'review.setup', 'review.direction', 'review.timeframe', 'review.noRows', 'review.outcome', 'review.r',
  'outcome.OPEN', 'outcome.WIN', 'outcome.LOSS', 'outcome.REVERSAL', 'outcome.EXPIRED', 'outcome.CLOSED',
  'pattern.support', 'pattern.resistance', 'pattern.note', 'pattern.explanation', 'pattern.bullish', 'pattern.bearish', 'pattern.neutral',
];

const messages = {
  en: {
    app: { title: 'Gold Signal', language: 'Language', alertOn: '🔔 Alerts ON', alertOff: '🔕 Alerts OFF', loading: 'Loading market data…', previousCandle: 'from previous candle', mtf: 'Multi-timeframe context', note: 'Educational prototype only. PAXG/USDT may differ from your broker’s XAU/USD feed. Signals are rules, not guarantees or financial advice.', fresh: 'Fresh', stale: 'Stale' },
    source: { proxy: 'Source: Binance PAXG/USDT public market data proxy. It can differ from Vantage XAUUSD; it is not broker-tick or fill data.' },
    status: { CONNECTING: 'CONNECTING', LOADING: 'LOADING', LIVE: 'LIVE', ERROR: 'ERROR', 'TICK DISCONNECTED': 'TICK DISCONNECTED', 'CANDLE DISCONNECTED': 'CANDLE DISCONNECTED' },
    view: { chart: 'Chart', patterns: 'Patterns', session: 'Session', review: 'Review' },
    readiness: {
      title: 'Trade readiness', setup: 'Gold Trend + Session Breakout', confirmed: 'CONFIRMED', waiting: 'WAIT',
      gateCount: '{passed} / {total} gates pass', gates: 'Six readiness gates', levels: 'Reference levels',
      noLevels: 'Levels are unavailable until every gate confirms.', closedOnly: 'Signals use closed candles only; live ticks update the price marker and paper outcomes.',
    },
    gate: {
      feed: 'Feed freshness', trend4h: '4h trend', trend30m: '30m trend', trigger5m: '5m confirmation', session: 'Session context', volatility: 'Volatility',
      pass: 'Pass', waiting: 'Waiting', blocked: 'Blocked',
    },
    level: { entry: 'ENTRY', sl: 'STOP LOSS', tp: 'TAKE PROFIT' },
    session: {
      title: 'Session context', utc: 'UTC schedule', asiaRange: 'Asian range', high: 'High', low: 'Low', complete: 'Complete', incomplete: 'Building', distance: 'Distance to range', state: 'State', custom: 'Custom', default: 'Default', advanced: 'Advanced UTC schedule', save: 'Save schedule', reset: 'Use defaults',
      notInSession: 'Not in Session', waiting: 'Waiting', breakout: 'Breakout', retest: 'Retest', invalidated: 'Invalidated',
    },
    review: {
      title: 'Review', localOnly: 'Local paper journal only. It is not a historical backtest, broker execution record, or profitability claim.',
      sampleWarning: 'Fewer than 10 completed outcomes: treat these observations as too small for a conclusion.', total: 'Setups', completed: 'Completed', winRate: 'Win rate', averageR: 'Average R', expired: 'Expired', open: 'Open',
      filters: 'Filters', all: 'All', session: 'Session', setup: 'Setup', direction: 'Direction', timeframe: 'Timeframe', noRows: 'No local setups match these filters.', outcome: 'Outcome', r: 'R result',
    },
    outcome: { OPEN: 'Open', WIN: 'Win', LOSS: 'Loss', REVERSAL: 'Reversal', EXPIRED: 'Expired', CLOSED: 'Closed' },
    pattern: { support: 'SUPPORT', resistance: 'RESISTANCE', note: 'Pattern results are heuristic estimates from recent candle geometry, not predictions or financial advice.', explanation: 'The pattern score is a heuristic based on recent closed-candle geometry.', bullish: 'BULLISH', bearish: 'BEARISH', neutral: 'NEUTRAL' },
  },
  zh: {
    app: { title: '黄金信号', language: '语言', alertOn: '🔔 提醒已开启', alertOff: '🔕 提醒已关闭', loading: '正在加载市场数据…', previousCandle: '相对上一根K线', mtf: '多周期背景', note: '仅供学习的原型。PAXG/USDT 可能与您的经纪商 XAU/USD 报价不同。信号基于规则，不代表保证，也不是投资建议。', fresh: '新鲜', stale: '过期' },
    source: { proxy: '数据源：Binance PAXG/USDT 公开市场数据代理。它可能与 Vantage XAUUSD 报价不同，不是经纪商逐笔报价或成交数据。' },
    status: { CONNECTING: '连接中', LOADING: '加载中', LIVE: '实时', ERROR: '错误', 'TICK DISCONNECTED': '实时价格断开', 'CANDLE DISCONNECTED': 'K线断开' },
    view: { chart: '图表', patterns: '形态', session: '交易时段', review: '复盘' },
    readiness: {
      title: '交易就绪度', setup: '黄金趋势 + 时段突破', confirmed: '已确认', waiting: '观望',
      gateCount: '{passed} / {total} 个条件通过', gates: '六项就绪条件', levels: '参考价位',
      noLevels: '所有条件确认前，不显示可执行参考价位。', closedOnly: '信号只使用已收盘K线；实时价格只更新价格标记和本地模拟结果。',
    },
    gate: {
      feed: '数据新鲜度', trend4h: '4小时趋势', trend30m: '30分钟趋势', trigger5m: '5分钟确认', session: '时段背景', volatility: '波动率',
      pass: '通过', waiting: '等待中', blocked: '阻止',
    },
    level: { entry: '入场价', sl: '止损', tp: '止盈' },
    session: {
      title: '交易时段背景', utc: 'UTC 时段表', asiaRange: '亚洲时段区间', high: '高点', low: '低点', complete: '已完成', incomplete: '构建中', distance: '距区间', state: '状态', custom: '自定义', default: '默认', advanced: '高级 UTC 时段设置', save: '保存时段', reset: '恢复默认',
      notInSession: '非交易时段', waiting: '等待中', breakout: '突破', retest: '回踩', invalidated: '失效',
    },
    review: {
      title: '复盘', localOnly: '仅本地模拟日志，不是历史回测、经纪商成交记录或盈利承诺。',
      sampleWarning: '已完成结果少于10笔：样本过小，不能据此得出结论。', total: '信号数', completed: '已完成', winRate: '胜率', averageR: '平均 R', expired: '过期', open: '进行中',
      filters: '筛选', all: '全部', session: '时段', setup: '策略', direction: '方向', timeframe: '周期', noRows: '没有本地信号符合这些筛选条件。', outcome: '结果', r: 'R 结果',
    },
    outcome: { OPEN: '进行中', WIN: '盈利', LOSS: '亏损', REVERSAL: '反转离场', EXPIRED: '过期', CLOSED: '已结束' },
    pattern: { support: '支撑位', resistance: '阻力位', note: '形态结果是根据近期K线几何结构作出的启发式估计，不代表预测或投资建议。', explanation: '形态评分基于近期已收盘K线的几何结构。', bullish: '看涨', bearish: '看跌', neutral: '中性' },
  },
};

const valueAtPath = (object, key) => key.split('.').reduce((value, segment) => value?.[segment], object);

export function t(language, key, variables = {}) {
  const template = valueAtPath(messages[language] ?? messages.en, key)
    ?? valueAtPath(messages.en, key)
    ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => variables[name] ?? `{${name}}`);
}

export function missingKeys(language) {
  return requiredKeys.filter((key) => typeof valueAtPath(messages[language], key) !== 'string');
}

export const supportedLanguages = Object.freeze(['en', 'zh']);
