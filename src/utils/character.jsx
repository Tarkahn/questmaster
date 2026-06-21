export const CLASSES = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    emoji: '⚔️',
    tagline: 'Master of arms',
    perk: '+1 to all Quest dice rolls',
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    emoji: '🔮',
    tagline: 'Scholar of the arcane',
    perk: 'Legendary Quests award +50% XP',
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    emoji: '🗡️',
    tagline: 'Opportunist and trickster',
    perk: 'Old tasks (4+ days) still earn 50% coins',
  },
  cleric: {
    id: 'cleric',
    name: 'Cleric',
    emoji: '✨',
    tagline: 'Guardian of the light',
    perk: 'Every other missed streak day is forgiven',
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    emoji: '🏹',
    tagline: 'Wanderer of realms',
    perk: 'Calendar Missions award +2 bonus coins',
  },
}

export const CLASS_ORDER = ['warrior', 'mage', 'rogue', 'cleric', 'ranger']

export const DEFAULT_CHARACTER = {
  class: null,
  ownedItems: [],
  equippedItems: {
    'main-hand': null,
    'off-hand':  null,
    'head':      null,
    'earrings':  null,
    'body':      null,
    'cloak':     null,
    'neck':      null,
    'ring-1':    null,
    'ring-2':    null,
    'bracers':   null,
    'boots':     null,
  },
  consumables: {},
  unlockedMilestones: [],
}

// SVG silhouettes — each returns a JSX-ready string rendered as dangerouslySetInnerHTML
// or export as components below.

export function ClassSVG({ classId, size = 80 }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 60 80',
    fill: 'currentColor',
    stroke: 'none',
    'aria-hidden': true,
  }

  if (classId === 'warrior') {
    return (
      <svg {...props}>
        {/* Blade */}
        <polygon points="30,4 34,46 26,46" opacity="0.9" />
        {/* Crossguard */}
        <rect x="14" y="46" width="32" height="7" rx="2" />
        {/* Handle */}
        <rect x="27" y="53" width="6" height="18" rx="2" />
        {/* Pommel */}
        <ellipse cx="30" cy="75" rx="7" ry="5" />
      </svg>
    )
  }

  if (classId === 'mage') {
    return (
      <svg {...props}>
        {/* Orb */}
        <circle cx="30" cy="16" r="13" opacity="0.9" />
        {/* Inner orb shine */}
        <circle cx="25" cy="11" r="4" opacity="0.35" fill="white" />
        {/* Staff */}
        <rect x="27" y="29" width="6" height="48" rx="3" />
      </svg>
    )
  }

  if (classId === 'rogue') {
    return (
      <svg {...props} viewBox="0 0 60 80" fill="none" stroke="currentColor">
        {/* Left dagger */}
        <line x1="8" y1="8" x2="42" y2="56" strokeWidth="5" strokeLinecap="round" />
        <polygon points="40,52 48,44 52,60" fill="currentColor" stroke="none" />
        <rect x="4" y="18" width="16" height="5" rx="2" fill="currentColor" stroke="none"
          transform="rotate(55 12 20.5)" />
        {/* Right dagger */}
        <line x1="52" y1="8" x2="18" y2="56" strokeWidth="5" strokeLinecap="round" />
        <polygon points="20,52 12,44 8,60" fill="currentColor" stroke="none" />
        <rect x="40" y="18" width="16" height="5" rx="2" fill="currentColor" stroke="none"
          transform="rotate(-55 48 20.5)" />
      </svg>
    )
  }

  if (classId === 'cleric') {
    return (
      <svg {...props}>
        {/* Vertical beam */}
        <rect x="26" y="6" width="8" height="68" rx="3" />
        {/* Horizontal beam */}
        <rect x="10" y="24" width="40" height="8" rx="3" />
        {/* Radiant top */}
        <circle cx="30" cy="10" r="6" opacity="0.7" />
      </svg>
    )
  }

  if (classId === 'ranger') {
    return (
      <svg {...props} fill="none" stroke="currentColor">
        {/* Bow curve */}
        <path d="M 20 6 C 50 6 56 40 50 74" strokeWidth="6" strokeLinecap="round" />
        {/* Bowstring */}
        <line x1="20" y1="6" x2="50" y2="74" strokeWidth="2.5" strokeDasharray="none" />
        {/* Arrow shaft */}
        <line x1="10" y1="40" x2="48" y2="40" strokeWidth="4" strokeLinecap="round"
          fill="none" />
        {/* Arrowhead */}
        <polygon points="46,35 58,40 46,45" fill="currentColor" stroke="none" />
        {/* Fletching */}
        <polygon points="10,36 2,30 10,40" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  return null
}

// Returns the effective d20 class bonus for a character class
export function classDiceBonus(characterClass) {
  return characterClass === 'warrior' ? 1 : 0
}

// Returns modified XP accounting for Mage legendary bonus
export function applyXpPerk(xp, characterClass, difficulty) {
  if (characterClass === 'mage' && difficulty === 'legendary') {
    return Math.floor(xp * 1.5)
  }
  return xp
}

// Returns modified coin decay floor for Rogue
export function applyRogueCoinFloor(multiplier, characterClass) {
  if (characterClass === 'rogue' && multiplier < 0.5) return 0.5
  return multiplier
}

// Returns bonus coins for Ranger on missions
export function applyRangerMissionBonus(coins, characterClass) {
  return characterClass === 'ranger' ? coins + 2 : coins
}
