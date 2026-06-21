import { useState } from 'react'

const KEYS = {
  points: 'qm_points',
  coins: 'qm_coins',
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
  const today = new Date().toISOString().slice(0, 10)

  const points = Math.max(local.points || 0, drive.points || 0)
  const coins = Math.max(local.coins || 0, drive.coins || 0)
  const bestStreak = Math.max(local.bestStreak || 0, drive.bestStreak || 0)

  const localDate = local.lastCompletedDate || ''
  const driveDate = drive.lastCompletedDate || ''
  const lastCompletedDate = localDate >= driveDate
    ? (local.lastCompletedDate || null)
    : (drive.lastCompletedDate || null)
  const streak = localDate >= driveDate ? (local.streak || 0) : (drive.streak || 0)

  // Union today's claimed event IDs from both devices so a claim on one
  // device immediately prevents a double-claim on the other.
  const localClaimed = local.claimedEvents || { date: today, ids: [], claims: {} }
  const driveClaimed = drive.claimedEvents || { date: today, ids: [], claims: {} }
  const mergedIds = [
    ...(localClaimed.date === today ? localClaimed.ids : []),
    ...(driveClaimed.date === today ? driveClaimed.ids : []),
  ]
  const mergedClaims = {
    ...(driveClaimed.date === today ? (driveClaimed.claims || {}) : {}),
    ...(localClaimed.date === today ? (localClaimed.claims || {}) : {}),
  }
  const claimedEvents = { date: today, ids: [...new Set(mergedIds)], claims: mergedClaims }

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

  return { points, coins, streak, bestStreak, lastCompletedDate, claimedEvents, history }
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
    coins: Number(localStorage.getItem(KEYS.coins) || 0),
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

  function earnCoins(n) {
    setState(prev => {
      const coins = prev.coins + n
      localStorage.setItem(KEYS.coins, String(coins))
      return { ...prev, coins }
    })
  }

  function spendCoins(n) {
    setState(prev => {
      if (prev.coins < n) return prev
      const coins = prev.coins - n
      localStorage.setItem(KEYS.coins, String(coins))
      return { ...prev, coins }
    })
  }

  function claimEvent(eventId, xp, coins = 0) {
    setState(prev => {
      const points = prev.points + xp
      const prevClaims = prev.claimedEvents?.claims || {}
      const claimedEvents = {
        date: todayStr(),
        ids: [...(prev.claimedEvents?.ids || []), eventId],
        claims: { ...prevClaims, [eventId]: { xp, coins } },
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
  // Uses setState(prev=>) so it always compares against live React state,
  // preventing a stale gameStateRef from letting Drive overwrite a completion
  // that happened between the last ref update and the sync running.
  function applyGameState(merged) {
    setState(prev => {
      const localDate = prev.lastCompletedDate || ''
      const mergedDate = merged.lastCompletedDate || ''
      const useLocal = localDate > mergedDate

      const next = {
        ...prev,
        ...merged,
        points: Math.max(prev.points, merged.points),
        coins: Math.max(prev.coins ?? 0, merged.coins ?? 0),
        bestStreak: Math.max(prev.bestStreak, merged.bestStreak),
        lastCompletedDate: useLocal ? prev.lastCompletedDate : merged.lastCompletedDate,
        streak: useLocal ? prev.streak : merged.streak,
      }

      localStorage.setItem(KEYS.points, String(next.points))
      localStorage.setItem(KEYS.coins, String(next.coins))
      localStorage.setItem(KEYS.streak, String(next.streak))
      localStorage.setItem(KEYS.bestStreak, String(next.bestStreak))
      if (next.lastCompletedDate) localStorage.setItem(KEYS.lastCompletedDate, next.lastCompletedDate)
      localStorage.setItem(KEYS.history, JSON.stringify(next.history))
      if (next.claimedEvents) localStorage.setItem(KEYS.claimedEvents, JSON.stringify(next.claimedEvents))

      return next
    })
  }

  function uncompleteTask(xp) {
    setState(prev => {
      const points = Math.max(0, prev.points - xp)
      const history = updateTodaySnapshot(prev.history, s => ({
        ...s,
        xpEarned: Math.max(0, s.xpEarned - xp),
        tasksCompleted: Math.max(0, s.tasksCompleted - 1),
        xpTotal: points,
        level: getLevel(points),
      }))
      localStorage.setItem(KEYS.points, String(points))
      localStorage.setItem(KEYS.history, JSON.stringify(history))
      return { ...prev, points, history }
    })
  }

  function unclaimEvent(eventId) {
    setState(prev => {
      const { xp = 0, coins = 0 } = prev.claimedEvents?.claims?.[eventId] || {}
      const points = Math.max(0, prev.points - xp)
      const coinsNext = Math.max(0, prev.coins - coins)
      const ids = (prev.claimedEvents?.ids || []).filter(id => id !== eventId)
      const claims = { ...(prev.claimedEvents?.claims || {}) }
      delete claims[eventId]
      const claimedEvents = { ...prev.claimedEvents, ids, claims }
      const history = updateTodaySnapshot(prev.history, s => ({
        ...s,
        xpEarned: Math.max(0, s.xpEarned - xp),
        eventsClaimed: Math.max(0, s.eventsClaimed - 1),
        xpTotal: points,
        level: getLevel(points),
      }))
      localStorage.setItem(KEYS.points, String(points))
      localStorage.setItem(KEYS.coins, String(coinsNext))
      localStorage.setItem(KEYS.claimedEvents, JSON.stringify(claimedEvents))
      localStorage.setItem(KEYS.history, JSON.stringify(history))
      return { ...prev, points, coins: coinsNext, claimedEvents, history }
    })
  }

  function removeCoins(n) {
    setState(prev => {
      const coins = Math.max(0, prev.coins - n)
      localStorage.setItem(KEYS.coins, String(coins))
      return { ...prev, coins }
    })
  }

  function resetStats() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k))
    setState({
      points: 0,
      coins: 0,
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
    uncompleteTask,
    earnCoins,
    spendCoins,
    removeCoins,
    claimEvent,
    unclaimEvent,
    resetStats,
    applyGameState,
  }
}
