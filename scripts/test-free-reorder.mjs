// Plain-function tests for the free-reorder ordering logic (src/utils/taskOrder.js).
// No test runner in this repo — run directly with `node scripts/test-free-reorder.mjs`.
// Covers acceptance checks A-C, D, E-partial, F, G from
// docs/handoff/free-reorder-implement.md. H (cross-device sync) and I (side
// quest nested drag) aren't pure-function-testable; see the report for how
// those were checked instead.

import assert from 'node:assert/strict'
import {
  computeOrder,
  buildOrderEntries,
  keyForTask,
  isLockedQuest,
  reorderIds,
  reorderSavedOrder,
  canonicalizeOrder,
  loadTaskOrder,
} from '../src/utils/taskOrder.js'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

function iso(daysFromToday, hour = 0) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function task(id, { due = null, time = null } = {}) {
  return { id, due, notes: time ? `[qm-time:${time}]\n` : '' }
}

function mission(id, { daysFromToday = 0, hour = 9 } = {}) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return { id, start: { dateTime: new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).toISOString() } }
}

// ---- A: free quest dropped between two dated quests stays there after reload ----
test('A: free quest between two dated quests survives reload, dated stay in date order', () => {
  const d1 = task('d1', { due: iso(1) })
  const d2 = task('d2', { due: iso(5) })
  const f1 = task('f1')
  const entries = buildOrderEntries([d1, f1, d2], new Map())
  const savedOrder = ['d1', 'f1', 'd2'] // f1 dropped between them
  const order1 = computeOrder(entries, savedOrder)
  assert.deepEqual(order1.map(e => e.key), ['d1', 'f1', 'd2'])

  // "Reload": fresh entries, same saved order, same result.
  const entries2 = buildOrderEntries([d2, d1, f1], new Map()) // arrival order shuffled
  const order2 = computeOrder(entries2, savedOrder)
  assert.deepEqual(order2.map(e => e.key), ['d1', 'f1', 'd2'])
})

// ---- B: dragging never reorders locked items relative to each other ----
test('B: dropping a free quest at every index leaves the 3 locked items in date order', () => {
  const locked = [task('L1', { due: iso(1) }), task('L2', { due: iso(3) }), task('L3', { due: iso(6) })]
  const free = [task('F1'), task('F2'), task('F3')]
  const entries = buildOrderEntries([...locked, ...free], new Map())
  const baseOrder = ['L1', 'F1', 'L2', 'F2', 'L3', 'F3']

  for (let toIndex = 0; toIndex < 6; toIndex++) {
    const savedOrder = reorderSavedOrder(baseOrder, baseOrder, 5, toIndex) // move F3 around
    const order = computeOrder(entries, savedOrder)
    const lockedKeysInResult = order.map(e => e.key).filter(k => k.startsWith('L'))
    assert.deepEqual(lockedKeysInResult, ['L1', 'L2', 'L3'], `toIndex=${toIndex}`)
  }
})

// ---- C: recurring quest with no time keeps its slot across a spawn (new task id) ----
test('C: recurring quest (no time) placed third keeps that slot after next day\'s spawn', () => {
  const f1 = task('f1')
  const f2 = task('f2')
  const rDay1 = task('rt-day1') // today's spawn, no due/time
  const defIdByTaskId1 = new Map([['rt-day1', 'def-r1']])
  const entries1 = buildOrderEntries([f1, f2, rDay1], defIdByTaskId1)
  const savedOrder = ['f1', 'f2', 'def-r1'] // recurring placed 3rd (index 2)
  const order1 = computeOrder(entries1, savedOrder)
  assert.equal(order1[2].key, 'def-r1')
  assert.equal(order1[2].item.id, 'rt-day1')

  // Next day: new task id for the same definition.
  const rDay2 = task('rt-day2')
  const defIdByTaskId2 = new Map([['rt-day2', 'def-r1']])
  const entries2 = buildOrderEntries([f1, f2, rDay2], defIdByTaskId2)
  const order2 = computeOrder(entries2, savedOrder) // same saved order, keyed by def id
  assert.equal(order2[2].key, 'def-r1')
  assert.equal(order2[2].item.id, 'rt-day2', 'third slot now holds the new spawn')
})

// ---- D: recurring quest with a time is locked and sits in time order among today's dated items ----
test('D: timed-no-date recurring quest is locked and interleaves by time with dated items', () => {
  const timedRecurring = task('rt', { time: '08:00' })
  const datedToday = task('d', { due: iso(0) }) // due today, no explicit time -> end of day
  assert.equal(isLockedQuest(timedRecurring), true)

  const entries = buildOrderEntries([timedRecurring, datedToday], new Map())
  const order = computeOrder(entries, ['d', 'rt'])
  // 08:00 sorts before end-of-day, regardless of the saved (unsorted) order.
  assert.deepEqual(order.map(e => e.key), ['rt', 'd'])
})

// ---- E: Full List free quest between two missions stays there; normal view keeps it relative to quests ----
test('E: free quest between two missions holds in Full List; normal view (missions filtered) keeps relative order', () => {
  const m1 = mission('m1', { daysFromToday: 0, hour: 8 })
  const m2 = mission('m2', { daysFromToday: 0, hour: 20 })
  const dq = task('dq', { due: iso(2) })
  const f1 = task('f1')
  const defMap = new Map()

  const fullEntries = buildOrderEntries([dq, f1], defMap, [m1, m2])
  const savedOrder = ['mission:m1', 'f1', 'mission:m2', 'dq']
  const fullOrder = computeOrder(fullEntries, savedOrder)
  const mi1 = fullOrder.findIndex(e => e.key === 'mission:m1')
  const fi = fullOrder.findIndex(e => e.key === 'f1')
  const mi2 = fullOrder.findIndex(e => e.key === 'mission:m2')
  assert.ok(mi1 < fi && fi < mi2, 'free quest sits between the two missions')

  // Full List off: same saved order, quest-only entries (missions absent).
  const normalEntries = buildOrderEntries([dq, f1], defMap)
  const normalOrder = computeOrder(normalEntries, savedOrder)
  // f1 still comes before dq, same as its relative position in the full list.
  assert.deepEqual(normalOrder.map(e => e.key), ['f1', 'dq'])
})

// ---- F: Auto-sort on, dragged free quest stays put, undragged auto-order around it, locked stay in time order ----
test('F: Auto-sort keeps a dragged free quest fixed and time-sorts locked items', () => {
  const L1 = task('L1', { due: iso(1) })
  const L2 = task('L2', { due: iso(4) })
  const laundry = task('laundry')
  const fA = task('fA')
  const fB = task('fB')
  const entries = buildOrderEntries([L1, L2, laundry, fA, fB], new Map())
  const savedOrder = ['laundry', 'fA', 'L1', 'fB', 'L2'] // laundry dragged to slot 0
  const taskSeenMap = {
    fA: new Date(Date.now() - 2 * 86400000).toLocaleDateString('en-CA'), // 2 days stale
    fB: new Date(Date.now() - 10 * 86400000).toLocaleDateString('en-CA'), // 10 days stale (more urgent)
  }

  const order = computeOrder(entries, savedOrder, { autoSort: true, dragged: ['laundry'], taskSeenMap })
  assert.equal(order[0].key, 'laundry', 'dragged free quest stays at its slot (top)')

  const lockedKeys = order.map(e => e.key).filter(k => k === 'L1' || k === 'L2')
  assert.deepEqual(lockedKeys, ['L1', 'L2'], 'locked items stay in time order under auto-sort')

  const freeOrderAfterLaundry = order.map(e => e.key).filter(k => k === 'fA' || k === 'fB')
  assert.deepEqual(freeOrderAfterLaundry, ['fB', 'fA'], 'undragged free quests auto-order by staleness (most stale first)')
})

// ---- G: old saved order formats keep loading with the same arrangement ----
test('G: legacy bare array and pre-dragged-field payload still load correctly', () => {
  const origGetItem = globalThis.localStorage
  const store = {}
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v },
  }
  try {
    store['qm_task_order'] = JSON.stringify(['a', 'b', 'c'])
    const legacy = loadTaskOrder()
    assert.deepEqual(legacy, { order: ['a', 'b', 'c'], dragged: [], updatedAt: '' })

    store['qm_task_order'] = JSON.stringify({ order: ['x', 'y'], updatedAt: '2026-01-01T00:00:00.000Z' })
    const preDraggedField = loadTaskOrder()
    assert.deepEqual(preDraggedField, { order: ['x', 'y'], dragged: [], updatedAt: '2026-01-01T00:00:00.000Z' })
  } finally {
    globalThis.localStorage = origGetItem
  }

  // A plain task-id array that happens to include today's recurring instance
  // id resolves to the same key a fresh spawn would use.
  const canonical = canonicalizeOrder(['a', 'rt-today', 'b'], new Map([['rt-today', 'def-1']]))
  assert.deepEqual(canonical, ['a', 'def-1', 'b'])
})

// ---- reorderIds / reorderSavedOrder sanity ----
test('reorderIds moves an element without touching others\' relative order', () => {
  assert.deepEqual(reorderIds(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c'])
})

test('reorderSavedOrder preserves a key hidden from the current view', () => {
  const fullOrder = ['hidden1', 'a', 'b', 'hidden2', 'c']
  const displayed = ['a', 'b', 'c'] // hidden1/hidden2 not in this view
  const result = reorderSavedOrder(fullOrder, displayed, 2, 0) // move c to front of display
  assert.equal(result.includes('hidden1'), true)
  assert.equal(result.includes('hidden2'), true)
  assert.deepEqual(result.filter(k => !k.startsWith('hidden')), ['c', 'a', 'b'])
})

console.log(`\n${passed} tests passed`)
