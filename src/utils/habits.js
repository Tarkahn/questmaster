const STORAGE_KEY = 'qm_habits'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / 86400000)
}

function applyMissPenalties(habits) {
  const today = todayStr()
  let changed = false

  const updated = habits.map(habit => {
    if (habit.status !== 'active' && habit.status !== 'paused') return habit
    if (habit.status === 'paused') return habit
    if (!habit.lastCompletedDate) return habit

    const missedDays = Math.max(0, daysBetween(habit.lastCompletedDate, today) - 1)
    if (missedDays === 0) return habit

    changed = true
    const penalty = missedDays * 3
    const newHP = Math.min(habit.boss.maxHP, habit.boss.currentHP + penalty)
    return { ...habit, boss: { ...habit.boss, currentHP: newHP } }
  })

  return { habits: updated, changed }
}

export function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const habits = JSON.parse(raw)
    const { habits: updated, changed } = applyMissPenalties(habits)
    if (changed) saveHabits(updated)
    return updated
  } catch {
    return []
  }
}

export function saveHabits(habits) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
  } catch {}
}

export function createHabitObj({ title, themedTitle, bossName, bossDescription }) {
  return {
    id: `habit_${Date.now()}`,
    title,
    themedTitle,
    boss: {
      name: bossName,
      description: bossDescription,
      currentHP: 66,
      maxHP: 66,
    },
    lastNarrative: bossDescription,
    createdAt: todayStr(),
    lastCompletedDate: null,
    totalCompletions: 0,
    status: 'active',
  }
}

export function completeHabitObj(habits, habitId, narrative) {
  return habits.map(h => {
    if (h.id !== habitId) return h
    const newHP = Math.max(0, h.boss.currentHP - 1)
    return {
      ...h,
      boss: { ...h.boss, currentHP: newHP },
      lastNarrative: narrative || h.lastNarrative,
      lastCompletedDate: todayStr(),
      totalCompletions: h.totalCompletions + 1,
      status: newHP === 0 ? 'defeated' : 'active',
    }
  })
}

export function isCompletedToday(habit) {
  return habit.lastCompletedDate === todayStr()
}

export function pauseHabit(habits, habitId) {
  return habits.map(h => h.id === habitId ? { ...h, status: 'paused' } : h)
}

export function resumeHabit(habits, habitId) {
  return habits.map(h =>
    h.id === habitId ? { ...h, status: 'active', lastCompletedDate: todayStr() } : h
  )
}

export function deleteHabit(habits, habitId) {
  return habits.filter(h => h.id !== habitId)
}

export function resetHabit(habits, habitId) {
  return habits.map(h => h.id !== habitId ? h : {
    ...h,
    boss: { ...h.boss, currentHP: h.boss.maxHP },
    totalCompletions: 0,
    lastCompletedDate: null,
    status: 'active',
    lastNarrative: h.boss.description,
  })
}

export function resetAllBossStats(habits) {
  return habits.map(h => ({
    ...h,
    boss: { ...h.boss, currentHP: h.boss.maxHP },
    totalCompletions: 0,
    lastCompletedDate: null,
    status: 'active',
    lastNarrative: h.boss.description,
  }))
}

export function processHabits(habits) {
  const { habits: updated, changed } = applyMissPenalties(habits)
  return { habits: updated, changed }
}
