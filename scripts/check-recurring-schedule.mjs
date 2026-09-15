#!/usr/bin/env node
// Plain-node check for src/utils/recurring.js's schedule/occurrence math and
// catch-up logic (docs/plans/longer-repeat-periods.md). No dependencies, no
// test runner — this project has none, and date math is exactly what a
// manual click-through won't cover.
//
// recurring.js imports under node as-is: its only browser dependency is
// `localStorage`, referenced solely inside loadRecurringMeta/saveRecurring*
// (which this script never calls), each already wrapped in try/catch. Node's
// global `localStorage` exists but throws when unconfigured, which those
// try/catch blocks swallow harmlessly.

import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const { isDueToday, getDueToday, scheduleLabel, createRecurringDef } =
  await import('../src/utils/recurring.js')

let pass = 0
let fail = 0

function check(name, cond, detail) {
  if (cond) {
    pass++
    console.log(`PASS  ${name}`)
  } else {
    fail++
    console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`)
  }
}

function eq(name, actual, expected) {
  check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function baseDef(overrides) {
  return {
    id: 'rq_test',
    title: 'Test quest',
    notes: '',
    days: [],
    dueTime: null,
    reminderMinutes: null,
    active: true,
    createdAt: '2020-01-01',
    lastMaterializedDate: null,
    lastTaskId: null,
    lastCompletedDate: null,
    streak: 0,
    bestStreak: 0,
    missedCount: 0,
    missedHistory: [],
    ...overrides,
  }
}

// --- month-end clamping: 31st through Feb (leap and non-leap), back to 31st ---
{
  const def = baseDef({ schedule: { unit: 'month', every: 1, start: '2026-01-31' } })
  // 2026 is not a leap year (2024 and 2028 are), so Feb has 28 days.
  eq('monthly 31st -> Jan (on the day)', isDueToday(def, '2026-01-31'), true)
  eq('monthly 31st -> Feb clamps to 28th (non-leap)', isDueToday({ ...def, lastMaterializedDate: '2026-01-31' }, '2026-02-28'), true)
  eq('monthly 31st -> Feb 28 not due a day early', isDueToday({ ...def, lastMaterializedDate: '2026-01-31' }, '2026-02-27'), false)
  eq('monthly 31st -> Mar back to 31st (non-leap)', isDueToday({ ...def, lastMaterializedDate: '2026-02-28' }, '2026-03-31'), true)

  const leapDef = baseDef({ schedule: { unit: 'month', every: 1, start: '2024-01-31' } })
  eq('monthly 31st -> Feb clamps to 29th (leap year)', isDueToday({ ...leapDef, lastMaterializedDate: '2024-01-31' }, '2024-02-29'), true)
  eq('monthly 31st -> Feb 29 not due on the 28th (leap year)', isDueToday({ ...leapDef, lastMaterializedDate: '2024-01-31' }, '2024-02-28'), false)
}

// --- Feb 29 yearly ---
{
  const def = baseDef({ schedule: { unit: 'year', every: 1, start: '2024-02-29' } })
  eq('yearly Feb29 -> Feb 28 in a non-leap year', isDueToday({ ...def, lastMaterializedDate: '2024-02-29' }, '2025-02-28'), true)
  eq('yearly Feb29 -> not due Feb 27 in a non-leap year', isDueToday({ ...def, lastMaterializedDate: '2024-02-29' }, '2025-02-27'), false)
  eq('yearly Feb29 -> back to Feb 29 on the next leap year', isDueToday({ ...def, lastMaterializedDate: '2025-02-28' }, '2028-02-29'), true)
}

// --- every-2-weeks anchoring (on-week and off-week) ---
{
  // 2026-01-05 is a Monday.
  const def = baseDef({ schedule: { unit: 'week', every: 2, start: '2026-01-05' } })
  eq('every-2-weeks due on the start date', isDueToday(def, '2026-01-05'), true)
  const materialized = { ...def, lastMaterializedDate: '2026-01-05' }
  eq('every-2-weeks NOT due on the off-week Monday (+7d)', isDueToday(materialized, '2026-01-12'), false)
  eq('every-2-weeks due on the on-week Monday (+14d)', isDueToday(materialized, '2026-01-19'), true)
}

// --- quarterly from a non-January start ---
{
  const def = baseDef({ schedule: { unit: 'month', every: 3, start: '2026-02-10' } })
  eq('quarterly from Feb: due May 10', isDueToday({ ...def, lastMaterializedDate: '2026-02-10' }, '2026-05-10'), true)
  eq('quarterly from Feb: not due May 9', isDueToday({ ...def, lastMaterializedDate: '2026-02-10' }, '2026-05-09'), false)
  eq('quarterly from Feb: not due again on Jun 1 (still mid-cycle)', isDueToday({ ...def, lastMaterializedDate: '2026-05-10' }, '2026-06-01'), false)
  eq('quarterly from Feb: due Aug 10', isDueToday({ ...def, lastMaterializedDate: '2026-05-10' }, '2026-08-10'), true)
}

// --- catch-up picks the most recent occurrence only ---
{
  // Monthly on the 1st, never opened since March 1; today is June 15 — should
  // catch up to June 1 only (one due def), not one per skipped month.
  const def = baseDef({ schedule: { unit: 'month', every: 1, start: '2026-01-01' }, lastMaterializedDate: '2026-03-01' })
  const due = getDueToday([def], '2026-06-15')
  eq('catch-up: exactly one def returned', due.length, 1)
  eq('catch-up: still due (most recent occurrence Jun 1 > last materialized Mar 1)', isDueToday(def, '2026-06-15'), true)
}

// --- createdAt floor ---
{
  // Weekday def (Mondays only) created on a Wednesday: the Monday of that
  // same week predates createdAt, so it must wait for the *next* Monday.
  const def = baseDef({ days: [1], createdAt: '2026-03-04' /* Wed */, lastMaterializedDate: null })
  eq('weekday def created mid-week: not due same week (Fri)', isDueToday(def, '2026-03-06'), false)
  eq('weekday def created mid-week: due on its next Monday', isDueToday(def, '2026-03-09'), true)

  // Schedule def whose start is in the future: never due before start.
  const futureDef = baseDef({ schedule: { unit: 'month', every: 1, start: '2026-09-01' }, createdAt: '2026-08-01' })
  eq('schedule def with future start: not due before start', isDueToday(futureDef, '2026-08-31'), false)
  eq('schedule def with future start: due on start', isDueToday(futureDef, '2026-09-01'), true)
}

// --- weekday catch-up (Weekdays def last made Wed, today Sat -> due) ---
{
  const def = baseDef({ days: [1, 2, 3, 4, 5], createdAt: '2020-01-01', lastMaterializedDate: '2026-03-04' /* Wed */ })
  eq('Weekdays last made Wed, today Sat: due (catches up to Fri)', isDueToday(def, '2026-03-07' /* Sat */), true)
}

// --- not due twice the same day ---
{
  const def = baseDef({ days: [0, 1, 2, 3, 4, 5, 6], createdAt: '2020-01-01', lastMaterializedDate: '2026-03-07' })
  eq('Daily def already materialized today: not due again', isDueToday(def, '2026-03-07'), false)
}

// --- inactive never due ---
{
  const def = baseDef({ days: [0, 1, 2, 3, 4, 5, 6], active: false })
  eq('inactive def: never due', isDueToday(def, '2026-03-07'), false)
}

// --- scheduleLabel sanity (used by the UI toast/list — not exhaustive) ---
{
  eq('label: every 2 weeks', scheduleLabel({ schedule: { unit: 'week', every: 2, start: '2026-01-06' /* Tue */ } }), 'Every 2 weeks (Tue)')
  eq('label: monthly', scheduleLabel({ schedule: { unit: 'month', every: 1, start: '2026-01-15' } }), 'Monthly on the 15th')
  eq('label: quarterly', scheduleLabel({ schedule: { unit: 'month', every: 3, start: '2026-01-15' } }), 'Quarterly on the 15th')
  eq('label: yearly', scheduleLabel({ schedule: { unit: 'year', every: 1, start: '2026-03-03' } }), 'Yearly on Mar 3')
  eq('label: unchanged for Daily', scheduleLabel({ days: [0,1,2,3,4,5,6] }), 'Daily')
  eq('label: unchanged for Never', scheduleLabel({ days: [] }), 'Never')
}

// --- createRecurringDef shape: days:[] + schedule for new defs, unchanged for weekday defs ---
{
  const weekdayDef = createRecurringDef({ title: 'X', days: [1,2,3,4,5] })
  check('createRecurringDef: weekday def has no schedule key after round-trip', !('schedule' in JSON.parse(JSON.stringify(weekdayDef))))
  eq('createRecurringDef: weekday def keeps its days', JSON.stringify(weekdayDef.days), JSON.stringify([1,2,3,4,5]))

  const scheduleDef = createRecurringDef({ title: 'Y', days: [1,2,3,4,5], schedule: { unit: 'month', every: 1, start: '2026-01-15' } })
  eq('createRecurringDef: schedule def forces days to []', JSON.stringify(scheduleDef.days), '[]')
  eq('createRecurringDef: schedule def keeps its schedule', JSON.stringify(scheduleDef.schedule), JSON.stringify({ unit: 'month', every: 1, start: '2026-01-15' }))
}

// --- old-build safety ---
// A new-style def (schedule + days: []) must not crash the pre-change build,
// and must be treated as inert ("Never" / not due) rather than materializing
// something wrong or throwing and taking the whole quest list down with it.
{
  const baseSha = '5dd4d2ea98654f3e8906f5bea0cdbbe2a0442246' // HEAD before this slice's changes
  let oldSrc
  try {
    oldSrc = execFileSync('git', ['show', `${baseSha}:src/utils/recurring.js`], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' })
  } catch (e) {
    console.log(`FAIL  old-build safety — could not read ${baseSha}:src/utils/recurring.js (${e.message})`)
    fail++
    oldSrc = null
  }
  if (oldSrc) {
    const dir = mkdtempSync(join(tmpdir(), 'qm-old-recurring-'))
    const oldPath = join(dir, 'recurring-old.mjs')
    writeFileSync(oldPath, oldSrc)
    const old = await import(pathToFileURL(oldPath).href)
    const newStyleDef = baseDef({ days: [], schedule: { unit: 'month', every: 1, start: '2026-01-15' }, active: true })
    let threw = false
    let dueResult
    try {
      dueResult = old.getDueToday([newStyleDef])
    } catch {
      threw = true
    }
    check('old build: getDueToday does not throw on a new-style def', !threw)
    if (!threw) eq('old build: getDueToday treats a new-style def as not due', dueResult.length, 0)

    let labelThrew = false
    let label
    try {
      label = old.scheduleLabel(newStyleDef.days)
    } catch {
      labelThrew = true
    }
    check('old build: scheduleLabel(def.days) does not throw on a new-style def', !labelThrew)
    if (!labelThrew) eq('old build: scheduleLabel(def.days) returns "Never" for a new-style def', label, 'Never')
  }
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
