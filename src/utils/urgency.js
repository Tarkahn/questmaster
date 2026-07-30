// Returns urgency data for a quest or mission card bar.
// pct: 0-100 fill amount (more = more urgent)
// tier: drives bar color
// label: human-readable tooltip

import { localMidnight, parseQuestTime } from './api'

const HOUR_MS = 3600000

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Bar granularity is hours, not whole days — two quests both "due in 3 days"
// used to render an identical bar; using actual hours-to-deadline instead
// gives each quest its own fill level, since due times/exact hours rarely
// line up exactly even when the day does. Rebalanced 2026-07-30.
function tierFromPct(pct) {
  return pct < 30 ? 'fresh' : pct < 55 ? 'aging' : pct < 78 ? 'urgent' : 'critical'
}

function pluralize(n, unit) {
  return `${n} ${unit}${n !== 1 ? 's' : ''}`
}

function timeLeftLabel(hoursLeft) {
  if (hoursLeft < 1) return `Due in ${pluralize(Math.max(1, Math.round(hoursLeft * 60)), 'minute')}`
  if (hoursLeft < 24) return `Due in ${pluralize(Math.round(hoursLeft), 'hour')}`
  return `Due in ${pluralize(Math.round(hoursLeft / 24), 'day')}`
}

function overdueLabel(hoursLate) {
  if (hoursLate < 24) return `Overdue by ${pluralize(Math.round(hoursLate), 'hour')}`
  return `Overdue by ${pluralize(Math.round(hoursLate / 24), 'day')}`
}

// A due date alone has no time component — if the quest carries an explicit
// reminder time (qm-time tag) use that, otherwise treat the deadline as the
// end of the due day. Keeps the exact same overdue transition point as
// before (midnight after the due day) while giving same-day quests a real,
// differing hours-remaining figure instead of all reading "due today".
function questDeadlineMs(task) {
  const dayMs = localMidnight(task.due).getTime()
  const t = parseQuestTime(task.notes)
  if (!t) return dayMs + (24 * HOUR_MS - 1) // end of due day
  const [h, m] = t.split(':').map(Number)
  return dayMs + h * HOUR_MS + m * 60000
}

// Quest urgency:
// - Has due date → countdown over a 14-day window, in hours
// - No due date  → staleness over a 21-day window, in hours
export function questUrgency(task, taskSeenMap) {
  const nowMs = Date.now()

  if (task.due) {
    const hoursLeft = (questDeadlineMs(task) - nowMs) / HOUR_MS
    if (hoursLeft < 0) {
      return { pct: 100, tier: 'overdue', label: overdueLabel(-hoursLeft) }
    }
    const WINDOW_HOURS = 14 * 24
    const pct = Math.max(5, Math.min(95, Math.round(((WINDOW_HOURS - hoursLeft) / WINDOW_HOURS) * 100)))
    return { pct, tier: tierFromPct(pct), label: timeLeftLabel(hoursLeft) }
  }

  // Staleness (no due date) — taskSeenMap only stores the day a quest was
  // first seen, not the hour, so "hours old" is measured from that day's
  // local midnight; it still fills smoothly over the course of "today".
  const seenDate = taskSeenMap?.[task.id]
  if (!seenDate) return { pct: 5, tier: 'fresh', label: 'New quest' }
  const hoursOld = (todayStart() - localMidnight(seenDate).getTime()) / HOUR_MS + (nowMs - todayStart()) / HOUR_MS
  const STALE_HOURS = 21 * 24
  const pct = Math.max(5, Math.min(100, Math.round((hoursOld / STALE_HOURS) * 100)))
  const tier = pct < 100 ? tierFromPct(pct) : 'overdue'
  const label = hoursOld < 24 ? 'Added today' : `${pluralize(Math.round(hoursOld / 24), 'day')} in queue`
  return { pct, tier, label }
}

// Mission urgency: countdown over a 7-day window, in hours. Timed events use
// their exact start time; all-day events are treated as ending at midnight.
export function missionUrgency(event) {
  const nowMs = Date.now()
  const hasTime = Boolean(event.start?.dateTime)
  const raw = event.start?.dateTime || (event.start?.date ? event.start.date + 'T00:00:00' : null)
  if (!raw) return { pct: 5, tier: 'fresh', label: '' }

  const eventMs = hasTime ? new Date(raw).getTime() : localMidnight(event.start.date).getTime() + (24 * HOUR_MS - 1)
  const hoursLeft = (eventMs - nowMs) / HOUR_MS

  if (hoursLeft < 0) return { pct: 100, tier: 'overdue', label: 'Past event' }

  const WINDOW_HOURS = 7 * 24
  const pct = Math.max(5, Math.min(95, Math.round(((WINDOW_HOURS - hoursLeft) / WINDOW_HOURS) * 100)))
  return { pct, tier: tierFromPct(pct), label: timeLeftLabel(hoursLeft) }
}
