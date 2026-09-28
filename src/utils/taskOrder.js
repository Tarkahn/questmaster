import { questUrgency, questDeadlineMs, missionDeadlineMs } from './urgency.js'
import { localMidnight, parseQuestTime } from './api.js'

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
    if (parsed && Array.isArray(parsed.order)) {
      return {
        order: parsed.order,
        dragged: Array.isArray(parsed.dragged) ? parsed.dragged : [],
        updatedAt: parsed.updatedAt || '',
      }
    }
    // Legacy: a bare array
    if (Array.isArray(parsed)) return { order: parsed, dragged: [], updatedAt: '' }
  } catch {}
  return { order: [], dragged: [], updatedAt: '' }
}

export function saveTaskOrder(order, dragged = []) {
  const payload = { order, dragged, updatedAt: new Date().toISOString() }
  try { localStorage.setItem(KEY, JSON.stringify(payload)) } catch {}
  return payload
}

// Writes a payload as-is (preserving its updatedAt) — used when adopting a
// version pulled from Drive so we don't overwrite its timestamp.
export function saveTaskOrderRaw(payload) {
  const normalized = {
    order: payload.order,
    dragged: Array.isArray(payload.dragged) ? payload.dragged : [],
    updatedAt: payload.updatedAt || '',
  }
  try { localStorage.setItem(KEY, JSON.stringify(normalized)) } catch {}
  return normalized
}

// Locked = fixed in strict time order, never draggable: has a due date, or
// has a reminder time with no due date (a spawned recurring quest with a set
// time, treated as due today at that time — see effectiveDeadlineMs). Free =
// no date and no time; these can be dragged anywhere, including between two
// locked items.
export function isLockedQuest(task) {
  return Boolean(task.due) || timeOfDayMinutes(task) !== Infinity
}

// The order key for a quest: a spawned recurring instance gets a brand-new
// task id every day it recurs, so it's keyed by its stable recurring
// definition id instead — tomorrow's spawn then inherits today's slot. Every
// other quest keeps its own task id. `defIdByTaskId` also migrates an old
// saved order that stored a recurring instance's (pre-fix) task id directly:
// on load, that id resolves to the same def id a fresh spawn would use.
export function keyForTask(task, defIdByTaskId) {
  return (defIdByTaskId && defIdByTaskId.get(task.id)) || task.id
}

export function keyForMission(event) {
  return `mission:${event.id}`
}

// Canonicalizes a saved order (which may still hold a recurring instance's
// raw, pre-fix task id) to today's keys before computeOrder sees it, so a
// task id that happens to be today's current recurring instance resolves to
// the same def-id key `keyForTask` would give it.
export function canonicalizeOrder(order, defIdByTaskId) {
  if (!defIdByTaskId) return order
  return order.map(id => defIdByTaskId.get(id) || id)
}

function effectiveDeadlineMs(task) {
  if (task.due) return questDeadlineMs(task)
  const mins = timeOfDayMinutes(task)
  if (mins === Infinity) return null
  const todayIso = new Date().toLocaleDateString('en-CA')
  return localMidnight(todayIso).getTime() + mins * 60000
}

// Builds ordering entries for quests, optionally combined with missions
// (Full List). Same shape either way, so computeOrder doesn't need to know
// which view it's serving.
export function buildOrderEntries(tasks, defIdByTaskId, missions = []) {
  const questEntries = tasks.map(task => ({
    key: keyForTask(task, defIdByTaskId),
    type: 'quest',
    item: task,
    locked: isLockedQuest(task),
    deadlineMs: effectiveDeadlineMs(task),
  }))
  const missionEntries = missions.map(event => ({
    key: keyForMission(event),
    type: 'mission',
    item: event,
    locked: true,
    deadlineMs: missionDeadlineMs(event),
  }))
  return [...questEntries, ...missionEntries]
}

// Builds the manual base sequence of keys: saved order first (for keys still
// present among `entries`), then any newly-seen entries appended at the end.
function baseSequence(entries, savedOrder) {
  const byKey = new Map(entries.map(e => [e.key, e]))
  const seen = new Set()
  const base = []
  for (const key of savedOrder) {
    if (byKey.has(key) && !seen.has(key)) { base.push(key); seen.add(key) }
  }
  for (const e of entries) {
    if (!seen.has(e.key)) { base.push(e.key); seen.add(e.key) }
  }
  return base
}

// The one ordering function for every view and every Auto-sort state:
//  - locked entries (dated quests, missions, spawned-with-a-time recurring
//    quests) always sort into strict time order, in whatever slots they
//    occupy in the base sequence
//  - free entries (no date, no time) keep the manual slot Rick gave them
//  - with Auto-sort on, free entries Rick has dragged (in `dragged`) still
//    keep their slot; the rest are re-ordered by staleness around them
// Feed it quest-only entries for the main list, or quest+mission entries for
// Full List — same function, same shared order, so a placement made in one
// view holds in the other.
export function computeOrder(entries, savedOrder, { autoSort = false, dragged = [], taskSeenMap } = {}) {
  const byKey = new Map(entries.map(e => [e.key, e]))
  const base = baseSequence(entries, savedOrder)

  const lockedSlots = []
  const lockedKeys = []
  const freeSlots = []
  base.forEach((key, i) => {
    if (byKey.get(key).locked) { lockedSlots.push(i); lockedKeys.push(key) }
    else freeSlots.push(i)
  })
  lockedKeys.sort((a, b) => byKey.get(a).deadlineMs - byKey.get(b).deadlineMs)

  const result = [...base]
  lockedSlots.forEach((slotIdx, k) => { result[slotIdx] = lockedKeys[k] })

  if (autoSort) {
    const draggedSet = new Set(dragged)
    const undraggedSlots = freeSlots.filter(i => !draggedSet.has(base[i]))
    const undraggedKeys = undraggedSlots.map(i => base[i])
    undraggedKeys.sort((a, b) =>
      questUrgency(byKey.get(b).item, taskSeenMap).pct - questUrgency(byKey.get(a).item, taskSeenMap).pct
    )
    undraggedSlots.forEach((slotIdx, k) => { result[slotIdx] = undraggedKeys[k] })
  }

  return result.map(key => byKey.get(key))
}

// Reorders the displayed key list after a drag (from index -> to index).
export function reorderIds(displayedIds, fromIndex, toIndex) {
  const next = [...displayedIds]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

// A view only ever displays a subset of the saved order (e.g. the main list
// never shows missions, and the look-ahead window can hide future missions).
// So a drag can't just overwrite the saved order with what's on screen —
// that would drop whatever isn't currently visible. Instead, find the moved
// key's new neighbour in the DISPLAYED list and place it right after that
// same neighbour in the FULL saved order, leaving every other key (visible
// or not) exactly where it was.
export function reorderSavedOrder(fullOrder, displayedKeys, fromIndex, toIndex) {
  const movedKey = displayedKeys[fromIndex]
  const newDisplayed = reorderIds(displayedKeys, fromIndex, toIndex)
  const newIndex = newDisplayed.indexOf(movedKey)
  const anchorKey = newIndex > 0 ? newDisplayed[newIndex - 1] : null

  const withoutMoved = fullOrder.filter(k => k !== movedKey)
  if (anchorKey == null) return [movedKey, ...withoutMoved]

  const anchorPos = withoutMoved.indexOf(anchorKey)
  if (anchorPos === -1) return [...withoutMoved, movedKey]
  return [...withoutMoved.slice(0, anchorPos + 1), movedKey, ...withoutMoved.slice(anchorPos + 1)]
}
