export const TIERS = ['normal', 'hard', 'legendary']

export const TIER_INFO = {
  normal:    { emoji: '⚔️', label: 'Normal',    d20Bonus: 0,  d10Bonus: 0 },
  hard:      { emoji: '🔥', label: 'Hard',      d20Bonus: 5,  d10Bonus: 3 },
  legendary: { emoji: '💀', label: 'Legendary', d20Bonus: 10, d10Bonus: 7 },
}

const MEMORY_KEY = 'qm_difficulty_memory'

export function loadDifficultyMemory() {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveDifficultyMemory(memory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory))
  } catch {}
}

export function getDifficulty(id, memory) {
  return memory[id] || null
}

export function setDifficultyInMemory(id, tier, memory) {
  return { ...memory, [id]: tier }
}

export function cycleTier(current) {
  const idx = TIERS.indexOf(current)
  return TIERS[(idx + 1) % TIERS.length]
}
