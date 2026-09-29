const OPEN_OUTCOME = 'OPEN';
const EXCLUDED_OUTCOME = 'EXPIRED';
const completedOutcomes = new Set(['WIN', 'LOSS', 'REVERSAL', 'CLOSED']);

const finite = (value) => Number.isFinite(Number(value));
const numeric = (value) => finite(value) ? Number(value) : null;
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

const normalizeOutcome = (row) => String(row?.outcome ?? row?.status ?? OPEN_OUTCOME).toUpperCase();
const initialRiskFor = (row) => {
  const explicit = numeric(row?.initialRisk);
  if (explicit && explicit > 0) return explicit;
  const entry = numeric(row?.entry);
  const stop = numeric(row?.sl);
  return entry != null && stop != null && entry !== stop ? Math.abs(entry - stop) : null;
};

export function migrateJournal(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const initialRisk = initialRiskFor(row);
    const outcome = normalizeOutcome(row);
    return {
      ...row,
      key: row?.key ?? `legacy-${index}`,
      setupType: row?.setupType ?? 'Legacy',
      session: row?.session ?? 'Unknown',
      timeframe: row?.timeframe ?? row?.tf ?? 'Unknown',
      side: row?.side ?? row?.direction ?? 'WAIT',
      gates: clone(row?.gates ?? row?.gateSnapshot ?? []),
      initialRisk,
      outcome,
      status: outcome,
      r: finite(row?.r) ? Number(row.r) : null,
    };
  });
}

export function recordConfirmedSetup(rows = [], decision) {
  const existing = migrateJournal(rows);
  if (decision?.state !== 'confirmed' || !['BUY', 'SELL'].includes(decision.side)) return existing;
  const levels = decision.levels ?? {};
  const key = `readiness-${decision.observedAt}-${decision.side}`;
  if (existing.some((row) => row.key === key)) return existing;
  const row = {
    key,
    observedAt: decision.observedAt,
    setupType: 'Gold Trend + Session Breakout',
    session: decision.session?.session?.name ?? 'Unknown',
    timeframe: '5m',
    side: decision.side,
    gates: clone(decision.gates ?? []),
    entry: numeric(levels.entry),
    sl: numeric(levels.sl),
    tp: numeric(levels.tp),
    initialRisk: numeric(levels.initialRisk) ?? initialRiskFor(levels),
    exit: null,
    r: null,
    outcome: OPEN_OUTCOME,
    status: OPEN_OUTCOME,
  };
  return [row, ...existing];
}

export function resolvePaperOutcome(row, price) {
  const [migrated] = migrateJournal([row]);
  const exit = numeric(price);
  const entry = numeric(migrated?.entry);
  const risk = initialRiskFor(migrated);
  if (!migrated || exit == null || entry == null || risk == null) return migrated ?? row;

  const r = (migrated.side === 'SELL' ? entry - exit : exit - entry) / risk;
  const alreadyClosed = migrated.outcome !== OPEN_OUTCOME;
  if (alreadyClosed) return { ...migrated, exit: migrated.exit ?? exit, r: migrated.r ?? r };

  const stopHit = migrated.side === 'SELL' ? exit >= migrated.sl : exit <= migrated.sl;
  const targetHit = finite(migrated.tp)
    && (migrated.side === 'SELL' ? exit <= migrated.tp : exit >= migrated.tp);
  const outcome = stopHit ? 'LOSS' : targetHit ? 'WIN' : OPEN_OUTCOME;
  return {
    ...migrated,
    exit,
    r: stopHit ? -1 : r,
    outcome,
    status: outcome,
  };
}

export function filterReview(rows = [], filters = {}) {
  return migrateJournal(rows).filter((row) => {
    const matches = (filter, value) => !filter || filter === 'all' || filter === value;
    return matches(filters.session, row.session)
      && matches(filters.setupType ?? filters.setup, row.setupType)
      && matches(filters.side ?? filters.direction, row.side)
      && matches(filters.timeframe ?? filters.tf, row.timeframe);
  });
}

export function aggregateReview(rows = [], filters = {}) {
  const filtered = filterReview(rows, filters);
  const expired = filtered.filter((row) => row.outcome === EXCLUDED_OUTCOME);
  const eligible = filtered.filter((row) => completedOutcomes.has(row.outcome) && Number.isFinite(row.r));
  const wins = eligible.filter((row) => row.r > 0);
  const losses = eligible.filter((row) => row.r < 0);
  const averageR = eligible.length
    ? eligible.reduce((sum, row) => sum + row.r, 0) / eligible.length
    : null;
  return {
    rows: filtered,
    total: filtered.length,
    open: filtered.filter((row) => row.outcome === OPEN_OUTCOME).length,
    completed: eligible.length,
    expired: expired.length,
    wins: wins.length,
    losses: losses.length,
    winRate: eligible.length ? wins.length / eligible.length : null,
    averageR,
    minimumSampleWarning: eligible.length < 10,
  };
}
