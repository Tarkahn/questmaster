const KEY = 'qm_recurring'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function loadRecurring() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function saveRecurring(defs) {
  try { localStorage.setItem(KEY, JSON.stringify(defs)) } catch {}
}

export function createRecurringDef({ title, notes, days }) {
  return {
    id: `rq_${Date.now()}`,
    title,
    notes: notes || '',
    days, // array of 0-6 (0 = Sun)
    active: true,
    createdAt: todayStr(),
    lastMaterializedDate: null,
  }
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
