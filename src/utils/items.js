export const ITEMS = {
  // ── Weapons ───────────────────────────────────────────────
  'iron-sword': {
    id: 'iron-sword', name: 'Iron Sword', category: 'weapon', slot: 'weapon',
    cost: 30, emoji: '⚔️',
    effect: '+1 to all Quest dice rolls',
    diceBonus: 1,
  },
  'steel-sword': {
    id: 'steel-sword', name: 'Steel Sword', category: 'weapon', slot: 'weapon',
    cost: 80, emoji: '🗡️',
    effect: '+2 to all Quest dice rolls',
    diceBonus: 2,
  },
  'dragon-blade': {
    id: 'dragon-blade', name: 'Dragon Blade', category: 'weapon', slot: 'weapon',
    cost: 200, emoji: '🐲',
    effect: '+3 to all Quest dice rolls',
    diceBonus: 3,
  },

  // ── Armour ────────────────────────────────────────────────
  'travelers-cloak': {
    id: 'travelers-cloak', name: "Traveller's Cloak", category: 'armour', slot: 'body',
    cost: 25, emoji: '🧥',
    effect: 'Cosmetic — the mark of a seasoned adventurer',
    cosmetic: true,
  },
  'knights-plate': {
    id: 'knights-plate', name: "Knight's Plate", category: 'armour', slot: 'body',
    cost: 75, emoji: '🛡️',
    effect: 'Streak shield — absorbs 1 missed day per week',
    streakShield: true,
  },
  'archmage-robes': {
    id: 'archmage-robes', name: 'Archmage Robes', category: 'armour', slot: 'body',
    cost: 150, emoji: '✨',
    effect: 'Cosmetic — XP bar turns arcane gold',
    cosmetic: true, archmageRobes: true,
  },

  // ── Accessories ───────────────────────────────────────────
  'ring-of-focus': {
    id: 'ring-of-focus', name: 'Ring of Focus', category: 'accessory', slot: 'accessory',
    cost: 40, emoji: '💍',
    effect: '+2 coins on all Legendary Quest completions',
    legendaryCoinsBonus: 2,
  },
  'fortune-amulet': {
    id: 'fortune-amulet', name: 'Amulet of Fortune', category: 'accessory', slot: 'accessory',
    cost: 60, emoji: '🍀',
    effect: '10% chance to double coins on any completion',
    fortuneChance: 0.1,
  },

  // ── Consumables ───────────────────────────────────────────
  'health-potion': {
    id: 'health-potion', name: 'Health Potion', category: 'consumable', slot: null,
    cost: 15, emoji: '🧪',
    effect: 'Restore 3 HP to your most wounded active boss',
    consumable: true, bossHeal: 3,
  },
  'xp-scroll': {
    id: 'xp-scroll', name: 'XP Scroll', category: 'consumable', slot: null,
    cost: 20, emoji: '📜',
    effect: 'Double XP on your next completed Quest',
    consumable: true, xpDouble: true,
  },
  'ration': {
    id: 'ration', name: "Adventurer's Ration", category: 'consumable', slot: null,
    cost: 10, emoji: '🍖',
    effect: 'Hearty sustenance for the road ahead',
    consumable: true, flavorOnly: true,
  },

  // ── Magic ─────────────────────────────────────────────────
  'philosophers-stone': {
    id: 'philosophers-stone', name: "Philosopher's Stone", category: 'magic', slot: null,
    cost: 500, emoji: '💎',
    effect: 'Passive: every 10 XP earned also grants 1 bonus coin',
    passive: true, xpToCoinRate: 10,
  },
}

export const CATEGORIES = [
  { id: 'weapon',     label: '⚔️ Weapons',     slot: 'weapon' },
  { id: 'armour',     label: '🛡 Armour',       slot: 'body' },
  { id: 'accessory',  label: '💍 Accessories',  slot: 'accessory' },
  { id: 'consumable', label: '🧪 Consumables',  slot: null },
  { id: 'magic',      label: '✨ Magic',         slot: null },
]

// Returns the dice bonus from the currently equipped weapon (0 if none)
export function getItemDiceBonus(character) {
  const weaponId = character?.equippedItems?.weapon
  return weaponId ? (ITEMS[weaponId]?.diceBonus || 0) : 0
}

// Returns bonus coins from the Philosopher's Stone passive (if owned)
export function getPhilosopherBonus(character, xpEarned) {
  if (!character?.ownedItems?.includes('philosophers-stone')) return 0
  return Math.floor(xpEarned / 10)
}
