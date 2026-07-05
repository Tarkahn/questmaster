// Stat leveling — single source of truth, imported by useStats and the
// CharacterView / StatDetailModal display components.
export function xpForStatLevel(n) {
  return 50 * (n - 1) * (n - 1)
}

export function getStatLevel(xp) {
  let level = 1
  while (xp >= xpForStatLevel(level + 1)) level++
  return level
}

export const DEFAULT_STATS = [
  {
    id: 'STR',
    name: 'Strength',
    emoji: '💪',
    description: 'Physical power — gym, lifting, physical labor, sports requiring power, manual work',
    custom: false,
  },
  {
    id: 'DEX',
    name: 'Dexterity',
    emoji: '🎯',
    description: 'Coordination and precision — basketball, handball, crafting, hands-on technical work, instrument practice',
    custom: false,
  },
  {
    id: 'CON',
    name: 'Constitution',
    emoji: '🏃',
    description: 'Endurance and stamina — running, cycling, walking, swimming, sustained physical effort, nutrition and health habits',
    custom: false,
  },
  {
    id: 'INT',
    name: 'Intelligence',
    emoji: '🧠',
    description: 'Intellectual effort — reading, studying, research, problem solving, programming, learning new skills, analysis',
    custom: false,
  },
  {
    id: 'WIS',
    name: 'Wisdom',
    emoji: '🔮',
    description: 'Reflection and judgment — journaling, planning, meditation, therapy, strategic thinking, reviewing progress',
    custom: false,
  },
  {
    id: 'CHA',
    name: 'Charisma',
    emoji: '🗣️',
    description: 'Social influence — networking, presenting, public speaking, sales, client meetings, writing for an audience',
    custom: false,
  },
]
