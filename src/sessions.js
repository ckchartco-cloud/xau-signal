const STORAGE_KEY = 'xauSessionSchedule';

export const DEFAULT_SESSION_SCHEDULE = Object.freeze({
  Asia: Object.freeze({ start: 0, end: 6 }),
  London: Object.freeze({ start: 7, end: 11 }),
  'New York': Object.freeze({ start: 13, end: 17 }),
  custom: false,
});

const sessionNames = ['Asia', 'London', 'New York'];
const copySchedule = (schedule) => Object.fromEntries(
  sessionNames.map((name) => [name, { ...schedule[name] }]),
);

const isValidWindow = (window) => Number.isInteger(window?.start)
  && Number.isInteger(window?.end)
  && window.start >= 0
  && window.end <= 24
  && window.start < window.end;

const sameWindow = (first, second) => first.start === second.start && first.end === second.end;

export function normalizeSessionSchedule(input = DEFAULT_SESSION_SCHEDULE) {
  const normalized = copySchedule(DEFAULT_SESSION_SCHEDULE);
  for (const name of sessionNames) {
    const candidate = input?.[name] ?? (name === 'New York' ? input?.NewYork : null);
    if (isValidWindow(candidate)) normalized[name] = { start: candidate.start, end: candidate.end };
  }

  const custom = sessionNames.some((name) => !sameWindow(normalized[name], DEFAULT_SESSION_SCHEDULE[name]));
  return { ...normalized, custom };
}

export function loadSessionSchedule(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return raw ? normalizeSessionSchedule(JSON.parse(raw)) : normalizeSessionSchedule();
  } catch {
    return normalizeSessionSchedule();
  }
}

export function saveSessionSchedule(storage, schedule) {
  const normalized = normalizeSessionSchedule(schedule);
  storage?.setItem(STORAGE_KEY, JSON.stringify(copySchedule(normalized)));
  return normalized;
}

export function resolveSession(now, schedule = DEFAULT_SESSION_SCHEDULE) {
  const normalized = normalizeSessionSchedule(schedule);
  const hour = now.getUTCHours() + (now.getUTCMinutes() / 60) + (now.getUTCSeconds() / 3600);
  const name = sessionNames.find((candidate) => {
    const window = normalized[candidate];
    return hour >= window.start && hour < window.end;
  });
  return name
    ? { name, active: true, custom: normalized.custom }
    : { name: 'Off hours', active: false, custom: normalized.custom };
}

const utcAtHour = (now, hour) => Date.UTC(
  now.getUTCFullYear(),
  now.getUTCMonth(),
  now.getUTCDate(),
  hour,
  0,
  0,
  0,
);

export function buildAsianRange(bars, now, schedule = DEFAULT_SESSION_SCHEDULE) {
  const normalized = normalizeSessionSchedule(schedule);
  const asia = normalized.Asia;
  const startMs = utcAtHour(now, asia.start);
  const endMs = utcAtHour(now, asia.end);
  const selected = (bars ?? []).filter((bar) => {
    const timestamp = Number(bar?.time) * 1000;
    return Number.isFinite(timestamp) && timestamp >= startMs && timestamp < endMs;
  });

  if (!selected.length) return { high: null, low: null, complete: now.getTime() >= endMs };
  const high = Math.max(...selected.map((bar) => bar.high));
  const low = Math.min(...selected.map((bar) => bar.low));
  return {
    high: Number.isFinite(high) ? high : null,
    low: Number.isFinite(low) ? low : null,
    complete: now.getTime() >= endMs,
  };
}

const baseOutcome = (session, range) => ({
  session,
  range,
  state: 'Waiting',
  direction: 'WAIT',
  boundary: null,
  distanceAtr: null,
  reason: 'Waiting for a complete Asian range and a live price.',
});

export function assessSessionBreakout(bars, livePrice, atrValue, now, schedule = DEFAULT_SESSION_SCHEDULE) {
  const session = resolveSession(now, schedule);
  const range = buildAsianRange(bars, now, schedule);
  const outcome = baseOutcome(session, range);
  if (!session.active) return { ...outcome, state: 'Not in Session', reason: 'The configured trading sessions are currently closed.' };
  if (!range.complete || !Number.isFinite(range.high) || !Number.isFinite(range.low)) return outcome;
  if (!Number.isFinite(livePrice) || !Number.isFinite(atrValue) || atrValue <= 0) {
    return { ...outcome, reason: 'Waiting for fresh price and ATR data.' };
  }

  const distanceToHigh = (livePrice - range.high) / atrValue;
  const distanceToLow = (range.low - livePrice) / atrValue;
  const nearestIsHigh = Math.abs(livePrice - range.high) <= Math.abs(livePrice - range.low);
  const boundary = nearestIsHigh ? range.high : range.low;
  const distanceAtr = Math.abs(livePrice - boundary) / atrValue;
  const closedBars = (bars ?? []).filter((bar) => Number(bar?.time) * 1000 < now.getTime());
  const last = closedBars.at(-1);
  const breakoutThreshold = atrValue * 0.1;

  if (livePrice > range.high + breakoutThreshold) {
    return { ...outcome, state: 'Breakout', direction: 'BUY', boundary: range.high, distanceAtr, reason: 'Price is above the Asian range high.' };
  }
  if (livePrice < range.low - breakoutThreshold) {
    return { ...outcome, state: 'Breakout', direction: 'SELL', boundary: range.low, distanceAtr, reason: 'Price is below the Asian range low.' };
  }
  if (last?.high > range.high + breakoutThreshold && Math.abs(livePrice - range.high) <= atrValue * 0.25) {
    return { ...outcome, state: 'Retest', direction: 'BUY', boundary: range.high, distanceAtr, reason: 'Price is retesting a broken Asian range high.' };
  }
  if (last?.low < range.low - breakoutThreshold && Math.abs(livePrice - range.low) <= atrValue * 0.25) {
    return { ...outcome, state: 'Retest', direction: 'SELL', boundary: range.low, distanceAtr, reason: 'Price is retesting a broken Asian range low.' };
  }
  if (last?.high > range.high + breakoutThreshold && livePrice < range.high - breakoutThreshold) {
    return { ...outcome, state: 'Invalidated', direction: 'WAIT', boundary: range.high, distanceAtr, reason: 'The upside Asian-range break returned inside the range.' };
  }
  if (last?.low < range.low - breakoutThreshold && livePrice > range.low + breakoutThreshold) {
    return { ...outcome, state: 'Invalidated', direction: 'WAIT', boundary: range.low, distanceAtr, reason: 'The downside Asian-range break returned inside the range.' };
  }
  return { ...outcome, boundary, distanceAtr, reason: 'Price remains inside the Asian range.' };
}
