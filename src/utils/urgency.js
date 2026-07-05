// Returns urgency data for a quest or mission card bar.
// pct: 0-100 fill amount (more = more urgent)
// tier: drives bar color
// label: human-readable tooltip

import { localMidnight } from './api'

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Quest urgency:
// - Has due date → countdown over 14-day window
// - No due date  → staleness over 21-day window
export function questUrgency(task, taskSeenMap) {
  const todayMs = todayStart()

  if (task.due) {
    const dueMs = localMidnight(task.due).getTime()
    const daysLeft = Math.round((dueMs - todayMs) / 86400000)
    if (daysLeft < 0) {
      const n = -daysLeft
      return { pct: 100, tier: 'overdue', label: `Overdue by ${n} day${n !== 1 ? 's' : ''}` }
    }
    if (daysLeft === 0) return { pct: 100, tier: 'critical', label: 'Due today!' }
    const WINDOW = 14
    const pct = Math.max(5, Math.min(95, Math.round(((WINDOW - daysLeft) / WINDOW) * 100)))
    const tier = pct < 30 ? 'fresh' : pct < 55 ? 'aging' : pct < 78 ? 'urgent' : 'critical'
    return { pct, tier, label: `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` }
  }

  // Staleness (no due date)
  const seenDate = taskSeenMap?.[task.id]
  if (!seenDate) return { pct: 5, tier: 'fresh', label: 'New quest' }
  const daysOld = Math.round((todayMs - localMidnight(seenDate).getTime()) / 86400000)
  const STALE = 21
  const pct = Math.max(5, Math.min(100, Math.round((daysOld / STALE) * 100)))
  const tier = pct < 30 ? 'fresh' : pct < 55 ? 'aging' : pct < 78 ? 'urgent' : pct < 100 ? 'critical' : 'overdue'
  const label = daysOld === 0
    ? 'Added today'
    : `${daysOld} day${daysOld !== 1 ? 's' : ''} in queue`
  return { pct, tier, label }
}

// Mission urgency: countdown over 7-day window
export function missionUrgency(event) {
  const todayMs = todayStart()
  const raw = event.start?.dateTime || (event.start?.date ? event.start.date + 'T00:00:00' : null)
  if (!raw) return { pct: 5, tier: 'fresh', label: '' }

  const eventMs = new Date(raw).setHours(0, 0, 0, 0)
  const daysLeft = Math.round((eventMs - todayMs) / 86400000)

  if (daysLeft < 0) return { pct: 100, tier: 'overdue', label: 'Past event' }
  if (daysLeft === 0) return { pct: 100, tier: 'critical', label: 'Today!' }

  const WINDOW = 7
  const pct = Math.max(5, Math.min(95, Math.round(((WINDOW - daysLeft) / WINDOW) * 100)))
  const tier = pct < 30 ? 'fresh' : pct < 55 ? 'aging' : pct < 78 ? 'urgent' : 'critical'
  return { pct, tier, label: `In ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` }
}
