// ── The penalty engine ───────────────────────────────────────────────────────
// A passive, time-driven "toll" rolled on dice once per calendar day, plus
// one-time hits for missions that pass and for due dates pushed later to cheat.
//
// Why a ledger (and not the boss system's recompute-from-lastCompletedDate)?
// Dice are random, so the sweep is NOT idempotent — re-running it would re-roll
// and double-charge. The ledger's `lastSweepDate` guards the daily portion so it
// fires exactly once per day; mission one-time hits are guarded per-mission by a
// `resolved` flag instead, so they can fire the moment a mission passes.
//
// Offline policy: "charge current day only" — if the user was away for days we
// still roll a single day's toll on return (no backfill), because HP has no
// passive regen and 0 HP wipes equipment.

import { getPenaltyResist } from './items'
import { roll } from './dice'
import { getDifficulty } from './difficulty'

const LEDGER_KEY = 'qm_penalty_ledger'

// All tunable knobs live here.
export const PENALTY_CONFIG = {
  benignHpDie: 2,        // d2 everyday "battle cost" on every open quest/sidequest
  overdueRampMax: 5,     // cap on the days-late multiplier for overdue dated quests
  // Rebalanced 2026-07-05 — the ramp used to reuse missionHpDie/missionXpDie
  // (d6/d10), so a quest overdue just 2 days could out-hurt a genuinely
  // missed calendar mission. Split onto its own, smaller dice so a repeating,
  // escalating toll doesn't casually exceed a real one-time miss.
  overdueRampHpDie: 3,   // d3 HP per day-late (capped at overdueRampMax), before difficulty mult
  overdueRampXpDie: 4,   // d4 XP per day-late (capped at overdueRampMax), before difficulty mult
  // Hard ceiling on the DAILY portion of the sweep (benign cost + overdue
  // ramp + boss toll combined) — added 2026-07-05 because several
  // individually-small costs were stacking uncapped into a much bigger single
  // morning hit than any one of them looked like on its own. Does not cap
  // one-time mission-miss or due-change-cheat hits, which aren't part of the
  // daily-stacking problem.
  maxDailyHpLoss: 25,
  questHpDie: 4,         // used by the due-change cheat + recurring miss penalty
  questXpDie: 6,         // used by the due-change cheat + recurring miss penalty
  bossHpDie: 4,          // d4 per active boss, only on a missed habit-day (was: every day, unconditionally)
  bossXpDie: 6,          // d6 per active boss, per missed habit-day
  missionHpDie: 6,       // mission miss (one-time) ONLY — no longer shared with the overdue ramp
  missionXpDie: 10,      // mission miss (one-time) ONLY — no longer shared with the overdue ramp
  missionHardMult: 1.5,  // hard-mode flat severity multiplier
  dueChangeMult: 2,      // "double damage" for pushing a due date later as a cheat
  maxResist: 0.6,        // mitigation gear can never remove more than 60% of a toll
  // Symmetric to the reward-side difficulty scaling (TIER_INFO's d20Bonus /
  // BASE_COIN_VALUE) — a quest marked Legendary for the bigger payout now
  // also costs more when neglected. Applies to a quest's own benign cost and
  // overdue ramp; bosses/missions have no difficulty tier so are unaffected.
  difficultyPenaltyMult: { normal: 1, hard: 1.5, legendary: 2 },
}

// ── small date helpers (mirrored from habits.js / urgency.js for consistency) ──
export function todayStr() {
  return new Date().toLocaleDateString('en-CA')
}
function todayStartMs() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / 86400000)
}
// Local calendar day (YYYY-MM-DD) for an ISO dateTime or an already-date-only
// string. Used to decide a mission's deadline as end-of-its-day, not its exact
// end time — so a 2pm appointment isn't penalised the moment it passes.
function localDayOf(value) {
  if (!value) return null
  if (value.length === 10 && value[4] === '-') return value // already a local date
  const d = new Date(value)
  if (isNaN(d)) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Days a dated item is past due (0 if not yet due / undated). Matches urgency.js:
// compares the due date's local midnight to today's local midnight.
function daysLate(dueIso, todayMs) {
  if (!dueIso) return 0
  const dueMs = new Date(dueIso).setHours(0, 0, 0, 0)
  const left = Math.round((dueMs - todayMs) / 86400000)
  return left < 0 ? -left : 0
}

// ── mitigation ────────────────────────────────────────────────────────────────
export function computeResist(character) {
  const raw = getPenaltyResist(character)
  return {
    hp: Math.min(PENALTY_CONFIG.maxResist, raw.hp || 0),
    xp: Math.min(PENALTY_CONFIG.maxResist, raw.xp || 0),
  }
}
function applyResist(amount, resist) {
  return Math.max(0, Math.round(amount * (1 - resist)))
}

// ── ledger persistence (localStorage; mirrored to Drive by the caller) ─────────
export function loadLedger() {
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    const l = raw ? JSON.parse(raw) : {}
    return {
      lastSweepDate: l.lastSweepDate || null,
      dueDates: l.dueDates && typeof l.dueDates === 'object' ? l.dueDates : {},
      missions: l.missions && typeof l.missions === 'object' ? l.missions : {},
    }
  } catch {
    return { lastSweepDate: null, dueDates: {}, missions: {} }
  }
}
export function saveLedger(ledger) {
  try { localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger)) } catch {}
}

// Upsert every currently-visible event into the mission ledger. MUST run on every
// load: the Calendar API only returns today→future, so once a mission slides into
// the past it's unreachable unless we logged its end time while it was visible.
export function recordMissions(ledger, events) {
  const missions = { ...ledger.missions }
  for (const ev of events || []) {
    const end = ev.end?.dateTime || ev.end?.date || ev.start?.dateTime || ev.start?.date
    if (!ev.id || !end) continue
    const existing = missions[ev.id]
    // The mission's own calendar day (its start). Penalty fires only once this
    // day is fully over (next launch after midnight), giving until end of day.
    const dayRef = ev.start?.date || ev.start?.dateTime || ev.end?.dateTime || ev.end?.date
    missions[ev.id] = {
      end,
      day: localDayOf(dayRef) || existing?.day || null,
      title: ev.summary || existing?.title || 'Mission',
      resolved: existing?.resolved || false,
    }
  }
  return { ...ledger, missions }
}

// Reconcile two ledgers across devices. lastSweepDate takes the LATEST (so a
// sweep already done elsewhere today is respected and never repeated); missions
// union with `resolved` OR'd; dueDates union with local winning on conflict.
export function mergeLedgers(local, drive) {
  if (!drive) return local
  if (!local) return drive
  const lastSweepDate = [local.lastSweepDate, drive.lastSweepDate].filter(Boolean).sort().pop() || null
  const missions = { ...drive.missions, ...local.missions }
  for (const id of Object.keys(missions)) {
    const a = local.missions?.[id]
    const b = drive.missions?.[id]
    const end = [a?.end, b?.end].filter(Boolean).sort().pop()
    missions[id] = {
      end: end || missions[id].end,
      title: a?.title || b?.title || 'Mission',
      resolved: !!(a?.resolved || b?.resolved),
    }
  }
  return { lastSweepDate, dueDates: { ...drive.dueDates, ...local.dueDates }, missions }
}

// Mark a mission settled so it never incurs a past-due penalty (e.g. on claim).
export function resolveMission(ledger, eventId) {
  if (!ledger.missions?.[eventId]) return ledger
  return {
    ...ledger,
    missions: { ...ledger.missions, [eventId]: { ...ledger.missions[eventId], resolved: true } },
  }
}

// One-time double hit when a due date is pushed later as a stalling tactic.
// Only fires when the edit happens on/after the original due date. Returns
// { hp, xp } or null. Caller applies the damage and refreshes the ledger entry.
export function dueChangePenalty({ oldDue, newDue, hardMode, character }) {
  if (!oldDue || !newDue) return null
  const oldMs = new Date(oldDue).setHours(0, 0, 0, 0)
  const newMs = new Date(newDue).setHours(0, 0, 0, 0)
  if (newMs <= oldMs) return null            // not pushed later
  if (todayStartMs() < oldMs) return null     // changed before the original due — fine
  const resist = computeResist(character)
  const { questHpDie, questXpDie, dueChangeMult } = PENALTY_CONFIG
  const mult = dueChangeMult * (hardMode ? 1.5 : 1)
  return {
    hp: applyResist(roll(questHpDie) * mult, resist.hp),
    xp: applyResist(roll(questXpDie) * mult, resist.xp),
  }
}

// Dice XP penalty for recurring quests that re-materialized uncompleted. Applied
// at materialization time (not in the daily sweep) since the old instance is
// deleted then. One d6 per miss; hard mode doubles. Mitigation resist applies.
export function recurringMissPenalty({ count, hardMode, character }) {
  if (!count) return 0
  const resist = computeResist(character)
  let xp = 0
  for (let i = 0; i < count; i++) {
    xp += applyResist(roll(PENALTY_CONFIG.questXpDie) * (hardMode ? 2 : 1), resist.xp)
  }
  return xp
}

// ── the sweep ─────────────────────────────────────────────────────────────────
// Returns { ledger, hpLost, xpLost, lines, perItem, atZeroXp, ranDaily, died:false }.
// `perItem` is { [taskOrSubtaskId]: {hp, xp} } — the same per-quest numbers
// baked into `lines`, exposed individually so a quest card can show its own toll.
// `died` is filled in by the caller after damagePlayer reports reincarnation.
export function runPenaltyPass({ tasks = [], subtasks = [], habits = [], character, settings = {}, ledger, points = 0, difficultyMemory = {} }) {
  const hardMode = !!settings.hardMode
  const hardMult = hardMode ? PENALTY_CONFIG.missionHardMult : 1
  const resist = computeResist(character)
  const today = todayStr()
  const todayMs = todayStartMs()

  const lines = []
  let hpLost = 0
  let xpLost = 0
  let next = { ...ledger, missions: { ...ledger.missions } }
  // Per-card breakdown — same {hp, xp} numbers as the aggregated `lines`
  // above, just keyed by task/subtask id so each quest card can show its own
  // day's toll instead of only the category total.
  const perItem = {}

  const ranDaily = ledger.lastSweepDate !== today
  if (ranDaily) {
    let dailyHp = 0 // subtotal subject to maxDailyHpLoss below — XP is never capped

    // Every open quest/sidequest pays a light d2 "battle cost", scaled by its
    // own difficulty tier. A DATED quest past its deadline additionally takes
    // a smaller escalating ramp (own dice, not the mission dice — see
    // PENALTY_CONFIG) that grows each day it stays unfinished, also
    // difficulty-scaled — the task persists, so it keeps hurting, unlike a
    // sunk mission.
    const tally = (items, label, icon) => {
      if (!items.length) return
      let hp = 0, xp = 0, lateCount = 0
      for (const it of items) {
        const tier = getDifficulty(it.id, difficultyMemory) || 'normal'
        const diffMult = PENALTY_CONFIG.difficultyPenaltyMult[tier] ?? 1
        let itemHp = applyResist(roll(PENALTY_CONFIG.benignHpDie) * hardMult * diffMult, resist.hp)
        let itemXp = 0
        const dl = daysLate(it.due, todayMs)
        if (it.due && dl >= 1) {
          lateCount++
          const ramp = Math.min(dl, PENALTY_CONFIG.overdueRampMax)
          itemHp += applyResist(roll(PENALTY_CONFIG.overdueRampHpDie) * ramp * hardMult * diffMult, resist.hp)
          itemXp += applyResist(roll(PENALTY_CONFIG.overdueRampXpDie) * ramp * hardMult * diffMult, resist.xp)
        }
        hp += itemHp; xp += itemXp
        perItem[it.id] = { hp: itemHp, xp: itemXp }
      }
      dailyHp += hp; xpLost += xp
      lines.push({ icon, label: `${label} (${items.length}${lateCount ? `, ${lateCount} overdue` : ''})`, hp, xp })
    }
    tally(tasks, 'Quests', '🗡')
    tally(subtasks, 'Side quests', '⚔')

    // Bosses: d4 HP + d6 XP per active boss, but ONLY on a missed habit-day —
    // a boss you kept up with costs nothing (was: d4 HP unconditionally,
    // every day, habit done or not).
    const activeBosses = habits.filter(h => h.status === 'active' && h.boss)
    if (activeBosses.length) {
      let hp = 0, xp = 0, neglected = 0
      for (const h of activeBosses) {
        const missed = h.lastCompletedDate ? Math.max(0, daysBetween(h.lastCompletedDate, today) - 1) : 0
        if (missed >= 1) {
          neglected++
          const mult = hardMode ? missed : 1
          hp += applyResist(roll(PENALTY_CONFIG.bossHpDie) * mult, resist.hp)
          xp += applyResist(roll(PENALTY_CONFIG.bossXpDie) * mult, resist.xp)
        }
      }
      dailyHp += hp; xpLost += xp
      lines.push({ icon: '🐉', label: `Bosses (${activeBosses.length}${neglected ? `, ${neglected} neglected` : ''})`, hp, xp })
    }

    if (dailyHp > PENALTY_CONFIG.maxDailyHpLoss) {
      // Scale every line's hp proportionally so the report still adds up,
      // rather than silently dropping the excess from one arbitrary line.
      const scale = PENALTY_CONFIG.maxDailyHpLoss / dailyHp
      for (const line of lines) line.hp = Math.round(line.hp * scale)
      for (const id of Object.keys(perItem)) perItem[id].hp = Math.round(perItem[id].hp * scale)
      dailyHp = PENALTY_CONFIG.maxDailyHpLoss
    }
    hpLost += dailyHp

    next.lastSweepDate = today
  }

  // Missions: one-time, but only once the mission's whole day is over (delivered
  // next launch after midnight) — not the instant its end time passes. This gives
  // the player all day to mark the appointment done.
  for (const [id, m] of Object.entries(next.missions)) {
    if (m.resolved) continue
    const day = m.day || localDayOf(m.end) // back-compat for ledgers without `day`
    if (!day || day >= today) continue // mission's day hasn't fully ended yet
    const hp = applyResist(roll(PENALTY_CONFIG.missionHpDie) * hardMult, resist.hp)
    const xp = applyResist(roll(PENALTY_CONFIG.missionXpDie) * hardMult, resist.xp)
    hpLost += hp; xpLost += xp
    lines.push({ icon: '📅', label: `Missed mission: ${m.title}`, hp, xp })
    next.missions[id] = { ...m, resolved: true }
  }

  const atZeroXp = xpLost > 0 && (points - xpLost) <= 0
  return { ledger: next, hpLost, xpLost, lines, perItem, atZeroXp, ranDaily, died: false }
}
