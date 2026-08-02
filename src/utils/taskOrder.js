import { questUrgency } from './urgency'
import { localMidnight, parseQuestTime } from './api'

const KEY = 'qm_task_order'

// Minutes since local midnight for a quest's reminder time, or Infinity if
// it has none (so untimed quests always sort after timed ones sharing a day).
function timeOfDayMinutes(task) {
  const t = parseQuestTime(task.notes)
  if (!t) return Infinity
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function loadTaskOrder() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (parsed && Array.isArray(parsed.order)) return parsed
    // Legacy: a bare array
    if (Array.isArray(parsed)) return { order: parsed, updatedAt: '' }
  } catch {}
  return { order: [], updatedAt: '' }
}

export function saveTaskOrder(order) {
  const payload = { order, updatedAt: new Date().toISOString() }
  try { localStorage.setItem(KEY, JSON.stringify(payload)) } catch {}
  return payload
}

// Writes a payload as-is (preserving its updatedAt) — used when adopting a
// version pulled from Drive so we don't overwrite its timestamp.
export function saveTaskOrderRaw(payload) {
  try { localStorage.setItem(KEY, JSON.stringify(payload)) } catch {}
  return payload
}

// Builds the manual base sequence: saved order first (for ids that still exist),
// then any newly-seen tasks appended at the end.
function baseSequence(tasks, savedOrder) {
  const byId = new Map(tasks.map(t => [t.id, t]))
  const seen = new Set()
  const base = []
  for (const id of savedOrder) {
    if (byId.has(id) && !seen.has(id)) { base.push(id); seen.add(id) }
  }
  for (const t of tasks) {
    if (!seen.has(t.id)) { base.push(t.id); seen.add(t.id) }
  }
  return base
}

// Returns task objects in display order:
//  - undated quests keep their manual slot
//  - dated quests are sorted by due date within whatever slots dated quests occupy
// So an undated quest dropped between two dated quests stays put, and dated
// quests never get jumbled out of date order.
export function computeDisplayOrder(tasks, savedOrder) {
  const byId = new Map(tasks.map(t => [t.id, t]))
  const base = baseSequence(tasks, savedOrder)

  const datedSlots = []
  const datedIds = []
  base.forEach((id, i) => {
    const t = byId.get(id)
    if (t?.due) { datedSlots.push(i); datedIds.push(id) }
  })
  datedIds.sort((a, b) => {
    const diff = new Date(byId.get(a).due) - new Date(byId.get(b).due)
    // Same due date — break the tie by reminder time-of-day (earlier first),
    // since `due` alone carries no time component.
    return diff !== 0 ? diff : timeOfDayMinutes(byId.get(a)) - timeOfDayMinutes(byId.get(b))
  })

  const resultIds = [...base]
  datedSlots.forEach((slotIdx, k) => { resultIds[slotIdx] = datedIds[k] })

  return resultIds.map(id => byId.get(id)).filter(Boolean)
}

// Auto-sort by urgency: most overdue at top, freshest undated at bottom.
// Dated and undated tasks are ranked on the same tier scale so a stale
// undated quest (yellow) correctly outranks a fresh dated quest (green).

// A same-day/tier tie-break: earlier reminder times score higher (sort
// first). Deliberately small (well under the ~7pt gap between adjacent
// day-of-window pct steps — see questUrgency's WINDOW=14 — and under the
// overdue band's 100pt/day step) so this only ever breaks ties within the
// same day/tier, never reorders across days. Untimed quests get 0.
function timeUrgencyBoost(task) {
  const mins = timeOfDayMinutes(task)
  if (mins === Infinity) return 0
  return ((1440 - mins) / 1440) * 0.9
}

export function computeAutoSortOrder(tasks, taskSeenMap) {
  const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() })()
  const TIER = { overdue: 5000, critical: 4000, urgent: 3000, aging: 2000, fresh: 1000 }

  function score(task) {
    // Dated-overdue gets its own band so it always outranks stale undated tasks
    if (task.due) {
      const dueMs = localMidnight(task.due).getTime()
      const daysLeft = Math.round((dueMs - todayMs) / 86400000)
      if (daysLeft < 0) return 10000 + (-daysLeft) * 100 + timeUrgencyBoost(task)
    }
    const { pct, tier } = questUrgency(task, taskSeenMap)
    return (TIER[tier] ?? 1000) + pct + timeUrgencyBoost(task)
  }

  return [...tasks].sort((a, b) => score(b) - score(a))
}

// Reorders the displayed id list after a drag (from index -> to index).
export function reorderIds(displayedIds, fromIndex, toIndex) {
  const next = [...displayedIds]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}
