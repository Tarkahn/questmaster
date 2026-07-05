const KEY = 'qm_recurring'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function todayStr() {
  return new Date().toLocaleDateString('en-CA')
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

export function createRecurringDef({ title, notes, days, dueTime, reminderMinutes }) {
  if (!title?.trim()) throw new Error('Recurring def requires a title')
  return {
    id: `rq_${Date.now()}`,
    title: title.trim(),
    notes: notes || '',
    days, // array of 0-6 (0 = Sun)
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

export function isDueToday(def) {
  if (!def.active) return false
  return def.days.includes(new Date().getDay())
}

export function getDueToday(defs) {
  const today = todayStr()
  return defs.filter(d => isDueToday(d) && d.lastMaterializedDate !== today)
}

export function markMaterialized(defs, id) {
  return defs.map(d => d.id === id ? { ...d, lastMaterializedDate: todayStr() } : d)
}

export function scheduleLabel(days) {
  if (!days || days.length === 0) return 'Never'
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 7) return 'Daily'
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays'
  if (sorted.join() === '0,6') return 'Weekends'
  if (sorted.length === 1) return `Every ${DAY_NAMES[sorted[0]]}`
  return sorted.map(d => DAY_NAMES[d]).join(', ')
}
