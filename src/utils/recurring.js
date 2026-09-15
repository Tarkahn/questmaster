const KEY = 'qm_recurring'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function todayStr() {
  return new Date().toLocaleDateString('en-CA')
}

// --- date helpers (all local-calendar arithmetic, never UTC-instant math) ---

function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m0: m - 1, d }
}

function ymdToStr(y, m0, d) {
  const mm = String(m0 + 1).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function daysInMonth(y, m0) {
  // Calendar-field arithmetic only (no instant subtraction), so this is safe
  // across DST regardless of the runtime's local timezone.
  return new Date(y, m0 + 1, 0).getDate()
}

// Day count anchored to UTC midnight for the given calendar fields. Used only
// to diff two calendar dates (e.g. every-2-weeks anchoring) — UTC has no DST,
// so subtracting two of these is always an exact whole-day count, unlike
// subtracting two local `Date` instants across a DST boundary.
function utcDayNum({ y, m0, d }) {
  return Date.UTC(y, m0, d) / 86400000
}

function ordinal(n) {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

// Most recent weekday-pattern occurrence on or before `todayS`, or null if
// `days` is empty (an old-style "Never" def, or a schedule def's `days: []`).
function lastWeekdayOnOrBefore(days, todayS) {
  if (!days || days.length === 0) return null
  const todayNum = utcDayNum(parseYMD(todayS))
  for (let back = 0; back < 7; back++) {
    const dayNum = todayNum - back
    const d = new Date(dayNum * 86400000)
    if (days.includes(d.getUTCDay())) {
      return ymdToStr(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    }
  }
  return null // unreachable: `days` non-empty means some weekday matches within 7 days
}

// Most recent occurrence of a { unit, every, start } schedule on or before
// `todayS`, or null if `start` is in the future (or missing/invalid).
function lastScheduleOnOrBefore(schedule, todayS) {
  const { unit, every } = schedule || {}
  const start = schedule?.start
  if (!start || todayS < start) return null
  const s = parseYMD(start)

  if (unit === 'week') {
    const period = Math.max(1, every || 1) * 7
    const startNum = utcDayNum(s)
    const diffDays = utcDayNum(parseYMD(todayS)) - startNum
    const k = Math.floor(diffDays / period)
    const occNum = startNum + k * period
    const d = new Date(occNum * 86400000)
    return ymdToStr(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }

  if (unit === 'month' || unit === 'year') {
    const monthsEvery = Math.max(1, every || 1) * (unit === 'year' ? 12 : 1)
    const t = parseYMD(todayS)
    const monthsDiff = (t.y - s.y) * 12 + (t.m0 - s.m0)
    const occAt = (k) => {
      const totalMonths = s.m0 + k * monthsEvery
      const y = s.y + Math.floor(totalMonths / 12)
      const m0 = ((totalMonths % 12) + 12) % 12
      const dim = daysInMonth(y, m0)
      const d = Math.min(s.d, dim) // month-end clamp, e.g. Jan 31 -> Feb 28/29
      return ymdToStr(y, m0, d)
    }
    let k = Math.floor(monthsDiff / monthsEvery)
    let occ = occAt(k)
    // `k` is the largest month-multiple whose *month* is <= today's month, but
    // within that month the clamped day can still fall after today (e.g. a
    // 31st-of-the-month def partway through a 28-day February) — step back
    // one period. `k` is never 0 at this point (occAt(0) === start, and we
    // already checked todayS >= start), so this can't go negative.
    if (occ > todayS) occ = occAt(k - 1)
    return occ
  }

  return null
}

function lastOccurrenceOnOrBefore(def, todayS) {
  if (def.schedule) return lastScheduleOnOrBefore(def.schedule, todayS)
  return lastWeekdayOnOrBefore(def.days, todayS)
}

export function loadRecurring() {
  return loadRecurringMeta().defs
}

// Whole-payload read used only by the Drive sync/merge — includes updatedAt
// so the sync can compare "who has the newer copy" instead of merging field
// by field (a per-field merge is what let a stale Drive read resurrect a
// just-deleted def, and clobber a fresh lastTaskId/lastCompletedDate with an
// older Drive value).
export function loadRecurringMeta() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (parsed && Array.isArray(parsed.defs)) {
      return { defs: parsed.defs.filter(d => d.title), updatedAt: parsed.updatedAt || '' }
    }
    // Legacy: a bare array (written before updatedAt existed)
    if (Array.isArray(parsed)) return { defs: parsed.filter(d => d.title), updatedAt: '' }
  } catch {}
  return { defs: [], updatedAt: '' }
}

export function saveRecurring(defs) {
  const payload = { defs, updatedAt: new Date().toISOString() }
  try { localStorage.setItem(KEY, JSON.stringify(payload)) } catch {}
  return payload
}

// Writes a payload as-is (preserving its updatedAt) — used when adopting a
// version pulled from Drive so we don't overwrite its timestamp.
export function saveRecurringRaw(payload) {
  try { localStorage.setItem(KEY, JSON.stringify(payload)) } catch {}
  return payload
}

// `schedule`, when given, is { unit: 'week'|'month'|'year', every: n, start:
// 'YYYY-MM-DD' } and `days` is forced to [] — see docs/plans/longer-repeat-
// periods.md for why an empty array rather than an omitted `days` field (a
// device still on the old build must treat this def as "Never", not crash).
export function createRecurringDef({ title, notes, days, dueTime, reminderMinutes, schedule }) {
  if (!title?.trim()) throw new Error('Recurring def requires a title')
  return {
    id: `rq_${Date.now()}`,
    title: title.trim(),
    notes: notes || '',
    days: schedule ? [] : days, // array of 0-6 (0 = Sun); [] under a schedule
    schedule: schedule || undefined, // omitted (not just falsy) for weekday defs, so JSON.stringify drops the key and the shape matches pre-existing defs
    dueTime: dueTime || null, // 'HH:MM' 24h, optional
    reminderMinutes: dueTime ? (reminderMinutes ?? 30) : null, // Google Calendar reminder lead time, minutes
    active: true,
    createdAt: todayStr(),
    lastMaterializedDate: null,
    lastTaskId: null,
    lastCompletedDate: null,
    streak: 0,
    bestStreak: 0,
    missedCount: 0,
    missedHistory: [], // [{date, title}] — capped at 60 entries
  }
}

export function setLastTaskId(defs, defId, taskId) {
  return defs.map(d => d.id === defId ? { ...d, lastTaskId: taskId } : d)
}

export function recordCompletion(defs, defId) {
  return defs.map(d => {
    if (d.id !== defId) return d
    const streak = (d.streak || 0) + 1
    return { ...d, streak, bestStreak: Math.max(d.bestStreak || 0, streak), lastCompletedDate: todayStr() }
  })
}

export function recordMiss(defs, defId) {
  const today = todayStr()
  return defs.map(d => {
    if (d.id !== defId) return d
    const missedHistory = [...(d.missedHistory || []), { date: today, title: d.title }].slice(-60)
    return { ...d, streak: 0, missedCount: (d.missedCount || 0) + 1, lastTaskId: null, missedHistory }
  })
}

// A def is due when: active, its most recent occurrence on or before today
// exists, that occurrence is on or after createdAt (a def created mid-cycle
// waits for its next real occurrence rather than catching up to one that
// predates it — see plan), and that occurrence is later than
// lastMaterializedDate (or lastMaterializedDate is null). `today` defaults to
// the real current date; a fixed string lets the check script test other
// dates deterministically.
export function isDueToday(def, today = todayStr()) {
  if (!def.active) return false
  const occ = lastOccurrenceOnOrBefore(def, today)
  if (!occ) return false
  if (def.createdAt && occ < def.createdAt) return false
  if (def.lastMaterializedDate && occ <= def.lastMaterializedDate) return false
  return true
}

export function getDueToday(defs, today = todayStr()) {
  return defs.filter(d => isDueToday(d, today))
}

export function markMaterialized(defs, id) {
  return defs.map(d => d.id === id ? { ...d, lastMaterializedDate: todayStr() } : d)
}

// Takes the full def (not just `days`) so schedule-based defs get their own
// label. Existing weekday labels are unchanged.
export function scheduleLabel(def) {
  const schedule = def?.schedule
  if (!schedule) {
    const days = def?.days
    if (!days || days.length === 0) return 'Never'
    const sorted = [...days].sort((a, b) => a - b)
    if (sorted.length === 7) return 'Daily'
    if (sorted.join() === '1,2,3,4,5') return 'Weekdays'
    if (sorted.join() === '0,6') return 'Weekends'
    if (sorted.length === 1) return `Every ${DAY_NAMES[sorted[0]]}`
    return sorted.map(d => DAY_NAMES[d]).join(', ')
  }

  const { unit, every, start } = schedule
  if (!start) return 'Never'
  const s = parseYMD(start)

  if (unit === 'week') {
    const dow = new Date(s.y, s.m0, s.d).getDay()
    const label = every === 2 ? 'Every 2 weeks' : every === 1 ? 'Weekly' : `Every ${every} weeks`
    return `${label} (${DAY_NAMES[dow]})`
  }
  if (unit === 'month') {
    const label = every === 3 ? 'Quarterly' : every === 1 ? 'Monthly' : `Every ${every} months`
    return `${label} on the ${ordinal(s.d)}`
  }
  if (unit === 'year') {
    const label = every === 1 ? 'Yearly' : `Every ${every} years`
    return `${label} on ${MONTH_ABBR[s.m0]} ${s.d}`
  }
  return 'Never'
}
