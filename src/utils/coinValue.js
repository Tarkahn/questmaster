export const BASE_COIN_VALUE = { normal: 8, hard: 15, legendary: 25 }

// Returns multiplier based on how many days ago the task was first seen in the app.
// 0-1 days = full coins; older tasks earn progressively less.
export function decayMultiplier(firstSeenDateStr) {
  if (!firstSeenDateStr) return 1.0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const seen = new Date(firstSeenDateStr + 'T00:00:00')
  const days = Math.floor((today - seen) / 86400000)
  if (days <= 1) return 1.0
  if (days === 2) return 0.75
  if (days === 3) return 0.5
  return 0.25
}

// Coins earned when a task is completed. seenMap = { [taskId]: 'YYYY-MM-DD' }.
// characterClass: Rogue raises the floor multiplier to 0.5 (never drops below 50%).
export function computeCoins(taskId, difficulty, seenMap, characterClass) {
  const base = BASE_COIN_VALUE[difficulty] || BASE_COIN_VALUE.normal
  let mult = decayMultiplier(seenMap?.[taskId])
  if (characterClass === 'rogue' && mult < 0.5) mult = 0.5
  return Math.max(1, Math.floor(base * mult))
}
