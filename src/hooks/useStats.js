import { useState, useRef, useEffect } from 'react'
import { DEFAULT_STATS, getStatLevel } from '../utils/statGlossary'
import { saveStats } from '../utils/driveSync'
import { readJson, writeJson } from '../utils/storage'

const STATS_KEY = 'qm_stats'
const HISTORY_KEY = 'qm_stat_history'
const HISTORY_LIMIT = 50

// Build the initial stats array from localStorage, always backfilling the
// named DEFAULT_STATS so no standard attribute can go missing, then appending
// any custom stats the user added.
function initStats() {
  const saved = readJson(STATS_KEY, null)
  if (Array.isArray(saved)) {
    const savedById = Object.fromEntries(saved.filter(s => s?.id).map(s => [s.id, s]))
    const base = DEFAULT_STATS.map(def => {
      const s = savedById[def.id]
      return { ...def, xp: s?.xp || 0, level: s?.level || 1 }
    })
    const defaultIds = new Set(DEFAULT_STATS.map(d => d.id))
    saved.filter(s => s?.id && s?.name && !defaultIds.has(s.id)).forEach(s => base.push(s))
    return base
  }
  return DEFAULT_STATS.map(s => ({ ...s, xp: 0, level: 1 }))
}

export function useStats(token) {
  const [stats, setStats] = useState(initStats)

  // Mirror current stats into a ref so mergeFromDrive can read the latest value
  // when deciding whether to seed Drive from local on first sync.
  const statsRef = useRef(stats)
  useEffect(() => { statsRef.current = stats }, [stats])

  // Distribute earned XP across the stats named in `weights`, recording each
  // contribution in history. Writes both to localStorage and Drive (with history)
  // so this hook is the single writer — there is no separate auto-save effect.
  function earnStatXP(weights, totalXp, taskTitle) {
    if (!weights || Object.keys(weights).length === 0) return
    const today = new Date().toLocaleDateString('en-CA')
    const title = taskTitle || 'Quest'
    setStats(prev => {
      const history = readJson(HISTORY_KEY, {})
      let anyChanged = false
      const next = prev.map(stat => {
        const w = weights[stat.id] || 0
        if (!w) return stat
        const gained = Math.round(totalXp * w)
        if (!gained) return stat
        anyChanged = true
        const sh = history[stat.id] || []
        history[stat.id] = [{ date: today, title, xp: gained }, ...sh].slice(0, HISTORY_LIMIT)
        const newXp = stat.xp + gained
        return { ...stat, xp: newXp, level: getStatLevel(newXp) }
      })
      if (anyChanged) {
        writeJson(STATS_KEY, next)
        writeJson(HISTORY_KEY, history)
        saveStats(token, next, history)
      }
      return next
    })
  }

  // Create or update a (custom) stat. Modal UI state is the caller's concern.
  function saveStat(updatedStat) {
    setStats(prev => {
      const exists = prev.find(s => s.id === updatedStat.id)
      const next = exists
        ? prev.map(s => s.id === updatedStat.id ? updatedStat : s)
        : [...prev, updatedStat]
      writeJson(STATS_KEY, next)
      saveStats(token, next, readJson(HISTORY_KEY, {}))
      return next
    })
  }

  function deleteStat(statId) {
    setStats(prev => {
      const next = prev.filter(s => s.id !== statId)
      writeJson(STATS_KEY, next)
      saveStats(token, next, readJson(HISTORY_KEY, {}))
      return next
    })
  }

  // Reconcile with the Drive copy on app load / poll. XP/level take the max per
  // stat so multi-device use only ever advances; history unions both sides.
  function mergeFromDrive(driveStats, driveStatHistory) {
    if (driveStats) {
      setStats(prev => {
        const driveById = {}
        driveStats.forEach(s => { driveById[s.id] = s })
        const localIds = new Set(prev.map(s => s.id))
        const merged = prev.map(s => {
          const d = driveById[s.id]
          if (!d) return s
          return { ...s, xp: Math.max(s.xp || 0, d.xp || 0), level: Math.max(s.level || 1, d.level || 1) }
        })
        driveStats.filter(d => !localIds.has(d.id) && d?.name).forEach(d => merged.push(d))
        writeJson(STATS_KEY, merged)
        return merged
      })
      if (driveStatHistory) {
        const local = readJson(HISTORY_KEY, {})
        const merged = { ...local }
        Object.entries(driveStatHistory).forEach(([statId, driveEntries]) => {
          const localEntries = local[statId] || []
          const seen = new Set(localEntries.map(e => `${e.date}|${e.title}|${e.xp}`))
          merged[statId] = [
            ...localEntries,
            ...driveEntries.filter(e => !seen.has(`${e.date}|${e.title}|${e.xp}`)),
          ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, HISTORY_LIMIT)
        })
        writeJson(HISTORY_KEY, merged)
      }
    } else {
      // No Drive copy yet — seed it from local if there's anything worth keeping.
      const local = statsRef.current
      if (local.some(s => s.xp > 0) || local.some(s => s.custom)) {
        saveStats(token, local, readJson(HISTORY_KEY, {}))
      }
    }
  }

  return { stats, earnStatXP, saveStat, deleteStat, mergeFromDrive }
}
