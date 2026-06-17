import { useState } from 'react'

const KEYS = {
  points: 'qm_points',
  streak: 'qm_streak',
  bestStreak: 'qm_best_streak',
  lastCompletedDate: 'qm_last_completed',
  claimedEvents: 'qm_claimed_events',
  history: 'qm_history',
}

const HISTORY_LIMIT = 400 // ~13 months of daily snapshots

// Pure merge: takes two game state objects, returns the merged result.
// Exported so Dashboard can compute the merge before touching Drive or React state.
export function computeGameStateMerge(local, drive) {
  const points = Math.max(local.points || 0, drive.points || 0)
  const bestStreak = Math.max(local.bestStreak || 0, drive.bestStreak || 0)

  const localDate = local.lastCompletedDate || ''
  const driveDate = drive.lastCompletedDate || ''
  const lastCompletedDate = localDate >= driveDate
    ? (local.lastCompletedDate || null)
    : (drive.lastCompletedDate || null)
  const streak = localDate >= driveDate ? (local.streak || 0) : (drive.streak || 0)

  const historyMap = {}
  for (const row of [...(local.history || []), ...(drive.history || [])]) {
    const e = historyMap[row.date]
    historyMap[row.date] = e ? {
      date: row.date,
      xpEarned: Math.max(e.xpEarned || 0, row.xpEarned || 0),
      tasksCompleted: Math.max(e.tasksCompleted || 0, row.tasksCompleted || 0),
      eventsClaimed: Math.max(e.eventsClaimed || 0, row.eventsClaimed || 0),
      xpTotal: Math.max(e.xpTotal || 0, row.xpTotal || 0),
      level: Math.max(e.level || 1, row.level || 1),
      streak: Math.max(e.streak || 0, row.streak || 0),
    } : { ...row }
  }
  const history = Object.values(historyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-HISTORY_LIMIT)

  return { points, streak, bestStreak, lastCompletedDate, history }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function loadClaimedEvents() {
  try {
    const raw = localStorage.getItem(KEYS.claimedEvents)
    if (!raw) return { date: todayStr(), ids: [] }
    const parsed = JSON.parse(raw)
    // Reset daily — event claims don't carry over to the next day
    return parsed.date === todayStr() ? parsed : { date: todayStr(), ids: [] }
  } catch {
    return { date: todayStr(), ids: [] }
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(KEYS.history)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function load() {
  return {
    points: Number(localStorage.getItem(KEYS.points) || 0),
    streak: Number(localStorage.getItem(KEYS.streak) || 0),
    bestStreak: Number(localStorage.getItem(KEYS.bestStreak) || 0),
    lastCompletedDate: localStorage.getItem(KEYS.lastCompletedDate) || null,
    claimedEvents: loadClaimedEvents(),
    history: loadHistory(),
  }
}

// Returns a new history array with today's snapshot updated via `updater`.
// Creates a fresh row if today has no entry yet. Trimmed to HISTORY_LIMIT.
function updateTodaySnapshot(history, updater) {
  const today = todayStr()
  const idx = history.findIndex(h => h.date === today)
  const base = idx >= 0 ? history[idx] : {
    date: today,
    xpEarned: 0,
    tasksCompleted: 0,
    eventsClaimed: 0,
    xpTotal: 0,
    level: 1,
    streak: 0,
  }
  const updated = updater(base)
  const next = idx >= 0
    ? [...history.slice(0, idx), updated, ...history.slice(idx + 1)]
    : [...history, updated]
  return next.slice(-HISTORY_LIMIT)
}

// XP to reach level N: 100 × (N-1)²
// Level 1: 0 XP, Level 2: 100, Level 3: 400, Level 4: 900, Level 5: 1600
function xpForLevel(n) {
  return 100 * (n - 1) * (n - 1)
}

export function getLevel(points) {
  let level = 1
  while (points >= xpForLevel(level + 1)) {
    level++
  }
  return level
}

export function getLevelProgress(points) {
  const level = getLevel(points)
  const xpStart = xpForLevel(level)
  const xpEnd = xpForLevel(level + 1)
  const xpInto = points - xpStart
  const xpNeeded = xpEnd - xpStart
  return { level, xpInto, xpNeeded, pct: xpInto / xpNeeded }
}

export function useGameState() {
  const [state, setState] = useState(load)

  function completeTask(xp = 10) {
    setState(prev => {
      const today = todayStr()
      const yesterday = yesterdayStr()
      let { points, streak, bestStreak, lastCompletedDate } = prev

      points += xp

      if (lastCompletedDate === today) {
        // Already completed a task today — streak unchanged
      } else if (lastCompletedDate === yesterday) {
        streak += 1
      } else {
        streak = 1
      }

      bestStreak = Math.max(bestStreak, streak)
      lastCompletedDate = today

      const history = updateTodaySnapshot(prev.history, s => ({
        ...s,
        xpEarned: s.xpEarned + xp,
        tasksCompleted: s.tasksCompleted + 1,
        xpTotal: points,
        level: getLevel(points),
        streak,
      }))

      const next = { ...prev, points, streak, bestStreak, lastCompletedDate, history }
      localStorage.setItem(KEYS.points, String(points))
      localStorage.setItem(KEYS.streak, String(streak))
      localStorage.setItem(KEYS.bestStreak, String(bestStreak))
      localStorage.setItem(KEYS.lastCompletedDate, lastCompletedDate)
      localStorage.setItem(KEYS.history, JSON.stringify(history))
      return next
    })
  }

  function claimEvent(eventId, xp) {
    setState(prev => {
      const points = prev.points + xp
      const claimedEvents = {
        date: todayStr(),
        ids: [...prev.claimedEvents.ids, eventId],
      }
      const history = updateTodaySnapshot(prev.history, s => ({
        ...s,
        xpEarned: s.xpEarned + xp,
        eventsClaimed: s.eventsClaimed + 1,
        xpTotal: points,
        level: getLevel(points),
        streak: prev.streak,
      }))
      localStorage.setItem(KEYS.points, String(points))
      localStorage.setItem(KEYS.claimedEvents, JSON.stringify(claimedEvents))
      localStorage.setItem(KEYS.history, JSON.stringify(history))
      return { ...prev, points, claimedEvents, history }
    })
  }

  // Applies a pre-computed merged game state to React state and localStorage.
  // Call computeGameStateMerge first, then pass the result here.
  function applyGameState(merged) {
    localStorage.setItem(KEYS.points, String(merged.points))
    localStorage.setItem(KEYS.streak, String(merged.streak))
    localStorage.setItem(KEYS.bestStreak, String(merged.bestStreak))
    if (merged.lastCompletedDate) localStorage.setItem(KEYS.lastCompletedDate, merged.lastCompletedDate)
    localStorage.setItem(KEYS.history, JSON.stringify(merged.history))
    setState(prev => ({ ...prev, ...merged }))
  }

  function resetStats() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k))
    setState({
      points: 0,
      streak: 0,
      bestStreak: 0,
      lastCompletedDate: null,
      claimedEvents: { date: todayStr(), ids: [] },
      history: [],
    })
  }

  const completedToday = state.lastCompletedDate === todayStr()
  const { level, xpInto, xpNeeded, pct } = getLevelProgress(state.points)

  return {
    ...state,
    completedToday,
    level,
    xpInto,
    xpNeeded,
    xpPct: pct,
    completeTask,
    claimEvent,
    resetStats,
    applyGameState,
  }
}
