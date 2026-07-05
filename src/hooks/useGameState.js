import { useState } from 'react'

const KEYS = {
  points: 'qm_points',
  lifetimeXp: 'qm_lifetime_xp',
  coins: 'qm_coins',           // legacy balance key — kept for migration reads only
  coinsEarned: 'qm_coins_earned',
  coinsSpent:  'qm_coins_spent',
  streak: 'qm_streak',
  bestStreak: 'qm_best_streak',
  lastCompletedDate: 'qm_last_completed',
  claimedEvents: 'qm_claimed_events',
  history: 'qm_history',
}

const HISTORY_LIMIT = 400 // ~13 months of daily snapshots

// ── Coin helpers ────────────────────────────────────────────────────────────
// Coins use a double-ledger so Math.max merge works for both earning AND spending.
// coinsEarned and coinsSpent are monotonically increasing; coins = earned - spent.

function readCoinLedger() {
  const earned = Number(localStorage.getItem(KEYS.coinsEarned) || 0)
  const spent  = Number(localStorage.getItem(KEYS.coinsSpent)  || 0)
  if (earned === 0 && spent === 0) {
    // Backward-compat: migrate from old single-balance key
    const legacy = Number(localStorage.getItem(KEYS.coins) || 0)
    if (legacy > 0) {
      localStorage.setItem(KEYS.coinsEarned, String(legacy))
      return { coinsEarned: legacy, coinsSpent: 0, coins: legacy }
    }
  }
  return { coinsEarned: earned, coinsSpent: spent, coins: Math.max(0, earned - spent) }
}

function mergeCoinLedger(local, drive) {
  // Backward-compat: old Drive files only have `coins`, no coinsEarned/coinsSpent
  const driveHasLedger = drive.coinsEarned != null || drive.coinsSpent != null
  const driveEarned = driveHasLedger
    ? (drive.coinsEarned || 0)
    : (drive.coins || 0)
  const driveSpent = drive.coinsSpent || 0

  const coinsEarned = Math.max(local.coinsEarned || 0, driveEarned)
  const coinsSpent  = Math.max(local.coinsSpent  || 0, driveSpent)
  const coins       = Math.max(0, coinsEarned - coinsSpent)
  return { coinsEarned, coinsSpent, coins }
}

// ── Pure merge ───────────────────────────────────────────────────────────────
// Takes two game state objects, returns the merged result.
// Exported so Dashboard can compute the merge before touching Drive or React state.
export function computeGameStateMerge(local, drive) {
  const today = new Date().toLocaleDateString('en-CA')

  const points     = Math.max(local.points || 0, drive.points || 0)
  // lifetimeXp only ever goes up (see readLifetimeXp) — level and max-HP
  // growth are derived from this, NOT from spendable `points`, so a penalty
  // deduction can never delevel a player or shrink their max HP.
  const lifetimeXp = Math.max(local.lifetimeXp || 0, drive.lifetimeXp || 0)
  const bestStreak = Math.max(local.bestStreak || 0, drive.bestStreak || 0)

  const { coinsEarned, coinsSpent, coins } = mergeCoinLedger(local, drive)

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

  return { points, lifetimeXp, coins, coinsEarned, coinsSpent, streak, bestStreak, lastCompletedDate, claimedEvents, history }
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA')
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA')
}

function loadClaimedEvents() {
  try {
    const raw = localStorage.getItem(KEYS.claimedEvents)
    if (!raw) return { date: todayStr(), ids: [] }
    const parsed = JSON.parse(raw)
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

// lifetimeXp only ever increases (level/max-HP growth key off it, never
// points). Existing players have no history for it — bootstrap it from
// their current points balance the first time this loads post-rollout, so
// nobody is retroactively "delevel"'d by penalties they already took.
function readLifetimeXp(points) {
  const raw = localStorage.getItem(KEYS.lifetimeXp)
  if (raw !== null) return Number(raw)
  localStorage.setItem(KEYS.lifetimeXp, String(points))
  return points
}

function load() {
  const { coinsEarned, coinsSpent, coins } = readCoinLedger()
  const points = Number(localStorage.getItem(KEYS.points) || 0)
  return {
    points,
    lifetimeXp: readLifetimeXp(points),
    coins,
    coinsEarned,
    coinsSpent,
    streak: Number(localStorage.getItem(KEYS.streak) || 0),
    bestStreak: Number(localStorage.getItem(KEYS.bestStreak) || 0),
    lastCompletedDate: localStorage.getItem(KEYS.lastCompletedDate) || null,
    claimedEvents: loadClaimedEvents(),
    history: loadHistory(),
  }
}

function saveCoinLedger(coinsEarned, coinsSpent) {
  localStorage.setItem(KEYS.coinsEarned, String(coinsEarned))
  localStorage.setItem(KEYS.coinsSpent,  String(coinsSpent))
}

// Returns a new history array with today's snapshot updated via `updater`.
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
function xpForLevel(n) {
  return 100 * (n - 1) * (n - 1)
}

export function getLevel(points) {
  let level = 1
  while (points >= xpForLevel(level + 1)) level++
  return level
}

export function getLevelProgress(points) {
  const level = getLevel(points)
  const xpStart = xpForLevel(level)
  const xpEnd   = xpForLevel(level + 1)
  const xpInto  = points - xpStart
  const xpNeeded = xpEnd - xpStart
  return { level, xpInto, xpNeeded, pct: xpInto / xpNeeded }
}

export function useGameState() {
  const [state, setState] = useState(load)

  function completeTask(xp = 10) {
    setState(prev => {
      const today     = todayStr()
      const yesterday = yesterdayStr()
      let { points, lifetimeXp, streak, bestStreak, lastCompletedDate } = prev

      points += xp
      lifetimeXp += xp

      if (lastCompletedDate === today) {
        // streak unchanged
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
        level: getLevel(lifetimeXp),
        streak,
      }))

      const next = { ...prev, points, lifetimeXp, streak, bestStreak, lastCompletedDate, history }
      localStorage.setItem(KEYS.points, String(points))
      localStorage.setItem(KEYS.lifetimeXp, String(lifetimeXp))
      localStorage.setItem(KEYS.streak, String(streak))
      localStorage.setItem(KEYS.bestStreak, String(bestStreak))
      localStorage.setItem(KEYS.lastCompletedDate, lastCompletedDate)
      localStorage.setItem(KEYS.history, JSON.stringify(history))
      return next
    })
  }

  function earnCoins(n) {
    setState(prev => {
      const coinsEarned = (prev.coinsEarned || 0) + n
      const coins = Math.max(0, coinsEarned - (prev.coinsSpent || 0))
      saveCoinLedger(coinsEarned, prev.coinsSpent || 0)
      return { ...prev, coinsEarned, coins }
    })
  }

  function spendCoins(n) {
    setState(prev => {
      if ((prev.coins || 0) < n) return prev
      const coinsSpent = (prev.coinsSpent || 0) + n
      const coins = Math.max(0, (prev.coinsEarned || 0) - coinsSpent)
      saveCoinLedger(prev.coinsEarned || 0, coinsSpent)
      return { ...prev, coinsSpent, coins }
    })
  }

  function removeCoins(n) {
    setState(prev => {
      const coinsSpent = (prev.coinsSpent || 0) + n
      const coins = Math.max(0, (prev.coinsEarned || 0) - coinsSpent)
      saveCoinLedger(prev.coinsEarned || 0, coinsSpent)
      return { ...prev, coinsSpent, coins }
    })
  }

  function claimEvent(eventId, xp, coins = 0) {
    setState(prev => {
      const points = prev.points + xp
      const lifetimeXp = (prev.lifetimeXp || 0) + xp
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
        level: getLevel(lifetimeXp),
        streak: prev.streak,
      }))
      localStorage.setItem(KEYS.points, String(points))
      localStorage.setItem(KEYS.lifetimeXp, String(lifetimeXp))
      localStorage.setItem(KEYS.claimedEvents, JSON.stringify(claimedEvents))
      localStorage.setItem(KEYS.history, JSON.stringify(history))
      return { ...prev, points, lifetimeXp, claimedEvents, history }
    })
  }

  // Applies a pre-computed merged game state to React state and localStorage.
  function applyGameState(merged) {
    setState(prev => {
      const localDate  = prev.lastCompletedDate || ''
      const mergedDate = merged.lastCompletedDate || ''
      const useLocal   = localDate > mergedDate

      const { coinsEarned, coinsSpent, coins } = mergeCoinLedger(prev, merged)

      const next = {
        ...prev,
        ...merged,
        points:             Math.max(prev.points, merged.points),
        lifetimeXp:         Math.max(prev.lifetimeXp || 0, merged.lifetimeXp || 0),
        coins,
        coinsEarned,
        coinsSpent,
        bestStreak:         Math.max(prev.bestStreak, merged.bestStreak),
        lastCompletedDate:  useLocal ? prev.lastCompletedDate : merged.lastCompletedDate,
        streak:             useLocal ? prev.streak : merged.streak,
      }

      localStorage.setItem(KEYS.points, String(next.points))
      localStorage.setItem(KEYS.lifetimeXp, String(next.lifetimeXp))
      saveCoinLedger(next.coinsEarned, next.coinsSpent)
      localStorage.setItem(KEYS.streak, String(next.streak))
      localStorage.setItem(KEYS.bestStreak, String(next.bestStreak))
      if (next.lastCompletedDate) localStorage.setItem(KEYS.lastCompletedDate, next.lastCompletedDate)
      localStorage.setItem(KEYS.history, JSON.stringify(next.history))
      if (next.claimedEvents) localStorage.setItem(KEYS.claimedEvents, JSON.stringify(next.claimedEvents))

      return next
    })
  }

  // Undoing an accidental completion reverses lifetimeXp too — this is
  // correcting a mistake ("that was never really earned"), not a penalty,
  // so it's the one case besides earning where lifetimeXp moves at all.
  function uncompleteTask(xp) {
    setState(prev => {
      const points = Math.max(0, prev.points - xp)
      const lifetimeXp = Math.max(0, (prev.lifetimeXp || 0) - xp)
      const history = updateTodaySnapshot(prev.history, s => ({
        ...s,
        xpEarned: Math.max(0, s.xpEarned - xp),
        tasksCompleted: Math.max(0, s.tasksCompleted - 1),
        xpTotal: points,
        level: getLevel(lifetimeXp),
      }))
      localStorage.setItem(KEYS.points, String(points))
      localStorage.setItem(KEYS.lifetimeXp, String(lifetimeXp))
      localStorage.setItem(KEYS.history, JSON.stringify(history))
      return { ...prev, points, lifetimeXp, history }
    })
  }

  // Penalty toll — deducts spendable points only. lifetimeXp (and therefore
  // level and max HP) is untouched, by design: a bad night should never
  // delevel a player or shrink their max HP on top of the HP/XP toll itself.
  function deductXP(n) {
    setState(prev => {
      const points = Math.max(0, prev.points - n)
      const history = updateTodaySnapshot(prev.history, s => ({
        ...s,
        xpTotal: points,
        level: getLevel(prev.lifetimeXp || 0),
      }))
      localStorage.setItem(KEYS.points, String(points))
      localStorage.setItem(KEYS.history, JSON.stringify(history))
      return { ...prev, points, history }
    })
  }

  function unclaimEvent(eventId) {
    setState(prev => {
      const { xp = 0, coins: claimedCoins = 0 } = prev.claimedEvents?.claims?.[eventId] || {}
      const points = Math.max(0, prev.points - xp)
      const lifetimeXp = Math.max(0, (prev.lifetimeXp || 0) - xp)
      // Model the reversal as spending so coinsSpent stays monotonically increasing
      const coinsSpent  = (prev.coinsSpent || 0) + claimedCoins
      const coins       = Math.max(0, (prev.coinsEarned || 0) - coinsSpent)
      const ids = (prev.claimedEvents?.ids || []).filter(id => id !== eventId)
      const claims = { ...(prev.claimedEvents?.claims || {}) }
      delete claims[eventId]
      const claimedEvents = { ...prev.claimedEvents, ids, claims }
      const history = updateTodaySnapshot(prev.history, s => ({
        ...s,
        xpEarned: Math.max(0, s.xpEarned - xp),
        eventsClaimed: Math.max(0, s.eventsClaimed - 1),
        xpTotal: points,
        level: getLevel(lifetimeXp),
      }))
      localStorage.setItem(KEYS.points, String(points))
      localStorage.setItem(KEYS.lifetimeXp, String(lifetimeXp))
      saveCoinLedger(prev.coinsEarned || 0, coinsSpent)
      localStorage.setItem(KEYS.claimedEvents, JSON.stringify(claimedEvents))
      localStorage.setItem(KEYS.history, JSON.stringify(history))
      return { ...prev, points, lifetimeXp, coins, coinsSpent, claimedEvents, history }
    })
  }

  function resetStats() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k))
    setState({
      points: 0,
      lifetimeXp: 0,
      coins: 0,
      coinsEarned: 0,
      coinsSpent: 0,
      streak: 0,
      bestStreak: 0,
      lastCompletedDate: null,
      claimedEvents: { date: todayStr(), ids: [] },
      history: [],
    })
  }

  const completedToday = state.lastCompletedDate === todayStr()
  // Level (and therefore max-HP growth) is derived from lifetimeXp, not the
  // spendable points balance — see readLifetimeXp / deductXP.
  const { level, xpInto, xpNeeded, pct } = getLevelProgress(state.lifetimeXp || 0)

  return {
    ...state,
    completedToday,
    level,
    xpInto,
    xpNeeded,
    xpPct: pct,
    completeTask,
    uncompleteTask,
    deductXP,
    earnCoins,
    spendCoins,
    removeCoins,
    claimEvent,
    unclaimEvent,
    resetStats,
    applyGameState,
  }
}
