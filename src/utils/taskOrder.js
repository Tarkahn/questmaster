const KEY = 'qm_task_order'

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
  datedIds.sort((a, b) => new Date(byId.get(a).due) - new Date(byId.get(b).due))

  const resultIds = [...base]
  datedSlots.forEach((slotIdx, k) => { resultIds[slotIdx] = datedIds[k] })

  return resultIds.map(id => byId.get(id)).filter(Boolean)
}

// Auto-sort by urgency: most overdue at top, freshest undated at bottom.
// Dated and undated tasks are ranked on the same tier scale so a stale
// undated quest (yellow) correctly outranks a fresh dated quest (green).
import { questUrgency } from './urgency'
import { localMidnight } from './api'

export function computeAutoSortOrder(tasks, taskSeenMap) {
  const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() })()
  const TIER = { overdue: 5000, critical: 4000, urgent: 3000, aging: 2000, fresh: 1000 }

  function score(task) {
    // Dated-overdue gets its own band so it always outranks stale undated tasks
    if (task.due) {
      const dueMs = localMidnight(task.due).getTime()
      const daysLeft = Math.round((dueMs - todayMs) / 86400000)
      if (daysLeft < 0) return 10000 + (-daysLeft) * 100
    }
    const { pct, tier } = questUrgency(task, taskSeenMap)
    return (TIER[tier] ?? 1000) + pct
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
