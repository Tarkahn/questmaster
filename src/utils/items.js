// affinity: 'all' = any class | string[] = specific classes only
// Consumables are always usable regardless of affinity (you own them, you use them)

export const ITEMS = {

  // ── Weapons ────────────────────────────────────────────────────
  'iron-sword': {
    id: 'iron-sword', name: 'Iron Sword', category: 'weapon', slot: 'weapon',
    affinity: ['warrior'],
    cost: 30, emoji: '⚔️',
    effect: '+1 to all Quest dice rolls',
    diceBonus: 1,
  },
  'steel-sword': {
    id: 'steel-sword', name: 'Steel Sword', category: 'weapon', slot: 'weapon',
    affinity: ['warrior'],
    cost: 80, emoji: '🗡️',
    effect: '+2 to all Quest dice rolls',
    diceBonus: 2,
  },
  'dragon-blade': {
    id: 'dragon-blade', name: 'Dragon Blade', category: 'weapon', slot: 'weapon',
    affinity: ['warrior'],
    cost: 200, emoji: '🐲',
    effect: '+3 to all Quest dice rolls',
    diceBonus: 3,
  },
  'arcane-staff': {
    id: 'arcane-staff', name: 'Arcane Staff', category: 'weapon', slot: 'weapon',
    affinity: ['mage'],
    cost: 60, emoji: '🪄',
    effect: '+2 to all Quest dice rolls',
    diceBonus: 2,
  },
  'shadow-dagger': {
    id: 'shadow-dagger', name: 'Shadow Dagger', category: 'weapon', slot: 'weapon',
    affinity: ['rogue'],
    cost: 50, emoji: '🔪',
    effect: '+2 to all Quest dice rolls',
    diceBonus: 2,
  },
  'holy-mace': {
    id: 'holy-mace', name: 'Holy Mace', category: 'weapon', slot: 'weapon',
    affinity: ['cleric'],
    cost: 55, emoji: '🔨',
    effect: '+1 to all Quest dice rolls',
    diceBonus: 1,
  },
  'hunters-bow': {
    id: 'hunters-bow', name: "Hunter's Bow", category: 'weapon', slot: 'weapon',
    affinity: ['ranger'],
    cost: 65, emoji: '🏹',
    effect: '+2 coins on every calendar Mission claim',
    missionCoinsBonus: 2,
  },

  // ── Armour ─────────────────────────────────────────────────────
  'travelers-cloak': {
    id: 'travelers-cloak', name: "Traveller's Cloak", category: 'armour', slot: 'body',
    affinity: 'all',
    cost: 25, emoji: '🧥',
    effect: 'Cosmetic — the mark of a seasoned adventurer',
    cosmetic: true,
  },
  'knights-plate': {
    id: 'knights-plate', name: "Knight's Plate", category: 'armour', slot: 'body',
    affinity: ['warrior'],
    cost: 75, emoji: '🛡️',
    effect: 'Streak shield — absorbs 1 missed day per week',
    streakShield: true,
  },
  'archmage-robes': {
    id: 'archmage-robes', name: 'Archmage Robes', category: 'armour', slot: 'body',
    affinity: ['mage'],
    cost: 150, emoji: '✨',
    effect: 'Cosmetic — XP bar turns arcane gold',
    cosmetic: true, archmageRobes: true,
  },
  'crow-feather-cloak': {
    id: 'crow-feather-cloak', name: 'Crow-Feather Cloak', category: 'armour', slot: 'body',
    affinity: ['rogue'],
    cost: 60, emoji: '🪶',
    effect: 'Cosmetic — light armour for those who prefer shadows',
    cosmetic: true,
  },
  'vestments': {
    id: 'vestments', name: 'Vestments', category: 'armour', slot: 'body',
    affinity: ['cleric'],
    cost: 50, emoji: '👘',
    effect: 'Cosmetic — the sacred garb of a devoted cleric',
    cosmetic: true,
  },
  'forest-cloak': {
    id: 'forest-cloak', name: 'Forest Cloak', category: 'armour', slot: 'body',
    affinity: ['ranger'],
    cost: 45, emoji: '🌿',
    effect: 'Cosmetic — woven from the canopy of the Thornwood',
    cosmetic: true,
  },

  // ── Accessories ────────────────────────────────────────────────
  'ring-of-focus': {
    id: 'ring-of-focus', name: 'Ring of Focus', category: 'accessory', slot: 'accessory',
    affinity: 'all',
    cost: 40, emoji: '💍',
    effect: '+2 coins on all Legendary Quest completions',
    legendaryCoinsBonus: 2,
  },
  'fortune-amulet': {
    id: 'fortune-amulet', name: 'Amulet of Fortune', category: 'accessory', slot: 'accessory',
    affinity: 'all',
    cost: 60, emoji: '🍀',
    effect: '10% chance to double coins on any completion',
    fortuneChance: 0.1,
  },
  'iron-will-talisman': {
    id: 'iron-will-talisman', name: 'Iron Will Talisman', category: 'accessory', slot: 'accessory',
    affinity: ['warrior', 'ranger'],
    cost: 70, emoji: '🪬',
    effect: 'Streak shield — miss 1 day without breaking your streak (once per week)',
    streakShield: true,
  },
  'arcane-pendant': {
    id: 'arcane-pendant', name: 'Arcane Pendant', category: 'accessory', slot: 'accessory',
    affinity: ['mage'],
    cost: 45, emoji: '🔷',
    effect: '+5 XP on every Quest completion',
    xpFlatBonus: 5,
  },
  'rogues-signet': {
    id: 'rogues-signet', name: "Rogue's Signet", category: 'accessory', slot: 'accessory',
    affinity: ['rogue'],
    cost: 55, emoji: '💠',
    effect: '+3 coins on all Normal Quest completions',
    normalCoinsBonus: 3,
  },
  'clerics-amulet': {
    id: 'clerics-amulet', name: "Cleric's Amulet", category: 'accessory', slot: 'accessory',
    affinity: ['cleric'],
    cost: 50, emoji: '☯️',
    effect: 'Restores 1 boss HP each time you complete any Quest',
    bossHealPerQuest: 1,
  },
  'rangers-sigil': {
    id: 'rangers-sigil', name: "Ranger's Sigil", category: 'accessory', slot: 'accessory',
    affinity: ['ranger'],
    cost: 40, emoji: '🍃',
    effect: '+1 coin on every Mission claim',
    missionCoinsBonus: 1,
  },

  // ── Consumables ────────────────────────────────────────────────
  'health-potion': {
    id: 'health-potion', name: 'Health Potion', category: 'consumable', slot: null,
    affinity: 'all',
    cost: 15, emoji: '🧪',
    effect: 'Restore 3 HP to your most wounded active boss',
    consumable: true, bossHeal: 3,
  },
  'xp-scroll': {
    id: 'xp-scroll', name: 'XP Scroll', category: 'consumable', slot: null,
    affinity: 'all',
    cost: 20, emoji: '📜',
    effect: 'Double XP on your next completed Quest',
    consumable: true, xpDouble: true,
  },
  'ration': {
    id: 'ration', name: "Adventurer's Ration", category: 'consumable', slot: null,
    affinity: 'all',
    cost: 10, emoji: '🍖',
    effect: 'Hearty sustenance for the road ahead',
    consumable: true, flavorOnly: true,
    flavorText: "🍖 You eat the ration. Marginally more heroic.",
  },
  'ritual-candle': {
    id: 'ritual-candle', name: 'Ritual Candle', category: 'consumable', slot: null,
    affinity: ['mage'],
    cost: 18, emoji: '🕯️',
    effect: 'Double XP on your next completed Quest',
    consumable: true, xpDouble: true,
  },
  'healing-herbs': {
    id: 'healing-herbs', name: 'Healing Herbs', category: 'consumable', slot: null,
    affinity: ['cleric'],
    cost: 20, emoji: '🌱',
    effect: 'Restore 5 HP to your most wounded active boss',
    consumable: true, bossHeal: 5,
  },
  'poison-vial': {
    id: 'poison-vial', name: 'Poison Vial', category: 'consumable', slot: null,
    affinity: ['rogue'],
    cost: 20, emoji: '☠️',
    effect: 'Deal 5 damage to an active boss (cannot land the killing blow)',
    consumable: true, bossDamage: 5,
  },
  'smoke-bomb': {
    id: 'smoke-bomb', name: 'Smoke Bomb', category: 'consumable', slot: null,
    affinity: ['rogue'],
    cost: 12, emoji: '💨',
    effect: 'You vanish dramatically. Nothing else happens.',
    consumable: true, flavorOnly: true,
    flavorText: "💨 You vanish. Dramatically. Nothing else happens.",
  },
  'blessed-water': {
    id: 'blessed-water', name: 'Blessed Water', category: 'consumable', slot: null,
    affinity: ['cleric'],
    cost: 8, emoji: '💧',
    effect: 'Sprinkle it. The boss recoils. Or so you imagine.',
    consumable: true, flavorOnly: true,
    flavorText: "💧 The boss recoils slightly. Or so you imagine.",
  },
  'animal-whistle': {
    id: 'animal-whistle', name: 'Animal Whistle', category: 'consumable', slot: null,
    affinity: ['ranger'],
    cost: 12, emoji: '🎵',
    effect: 'Something rustles in the distance. Probably nothing.',
    consumable: true, flavorOnly: true,
    flavorText: "🎵 You blow the whistle. Something rustles in the distance.",
  },

  // ── Magic ──────────────────────────────────────────────────────
  'philosophers-stone': {
    id: 'philosophers-stone', name: "Philosopher's Stone", category: 'magic', slot: null,
    affinity: 'all',
    cost: 500, emoji: '💎',
    effect: 'Passive: every 10 XP earned also grants 1 bonus coin',
    passive: true, xpToCoinRate: 10,
  },
  'tome-of-knowledge': {
    id: 'tome-of-knowledge', name: 'Tome of Knowledge', category: 'magic', slot: null,
    affinity: ['mage'],
    cost: 80, emoji: '📚',
    effect: 'Passive: +10% XP on every Quest completion',
    passive: true, xpBonusPct: 0.1,
  },
  'war-banner': {
    id: 'war-banner', name: 'War Banner', category: 'magic', slot: null,
    affinity: ['warrior'],
    cost: 45, emoji: '🚩',
    effect: 'Cosmetic — plant it and assert dominance over the quest board',
    cosmetic: true,
  },
  'battle-trophy': {
    id: 'battle-trophy', name: 'Battle Trophy', category: 'magic', slot: null,
    affinity: ['warrior'],
    cost: 35, emoji: '🏆',
    effect: 'Cosmetic — proof you were there',
    cosmetic: true,
  },
  'crystal-ball': {
    id: 'crystal-ball', name: 'Crystal Ball', category: 'magic', slot: null,
    affinity: ['mage'],
    cost: 30, emoji: '🔮',
    effect: 'Cosmetic — you see tasks in your future. Ominous.',
    cosmetic: true,
  },
  'enchanted-inkpot': {
    id: 'enchanted-inkpot', name: 'Enchanted Inkpot', category: 'magic', slot: null,
    affinity: ['mage'],
    cost: 10, emoji: '🖋️',
    effect: 'Cosmetic — your handwriting improves marginally',
    cosmetic: true,
  },
  'sacred-bell': {
    id: 'sacred-bell', name: 'Sacred Bell', category: 'magic', slot: null,
    affinity: ['cleric'],
    cost: 25, emoji: '🔔',
    effect: 'Cosmetic — it rings when you complete a quest. In your imagination.',
    cosmetic: true,
  },
  'stolen-fork': {
    id: 'stolen-fork', name: 'Stolen Fork', category: 'magic', slot: null,
    affinity: ['rogue'],
    cost: 5, emoji: '🍴',
    effect: "Cosmetic — you didn't steal this. Probably.",
    cosmetic: true,
  },
  'pinecone': {
    id: 'pinecone', name: 'Pinecone', category: 'magic', slot: null,
    affinity: ['ranger'],
    cost: 5, emoji: '🌲',
    effect: 'Cosmetic — it smells like adventure',
    cosmetic: true,
  },
}

export const CATEGORIES = [
  { id: 'weapon',     label: '⚔️ Weapons',     slot: 'weapon' },
  { id: 'armour',     label: '🛡 Armour',       slot: 'body' },
  { id: 'accessory',  label: '💍 Accessories',  slot: 'accessory' },
  { id: 'consumable', label: '🧪 Consumables',  slot: null },
  { id: 'magic',      label: '✨ Magic',         slot: null },
]

// Returns true if item is available for the given class (or if no class yet)
export function isItemForClass(item, playerClass) {
  if (!playerClass) return true
  const affinity = item.affinity || 'all'
  return affinity === 'all' || (Array.isArray(affinity) && affinity.includes(playerClass))
}

// Dice bonus from equipped weapon
export function getItemDiceBonus(character) {
  const weaponId = character?.equippedItems?.weapon
  return weaponId ? (ITEMS[weaponId]?.diceBonus || 0) : 0
}

// Bonus coins from equipped items on mission claims
export function getItemMissionBonus(character) {
  const weaponId = character?.equippedItems?.weapon
  const accessoryId = character?.equippedItems?.accessory
  return (weaponId ? (ITEMS[weaponId]?.missionCoinsBonus || 0) : 0)
       + (accessoryId ? (ITEMS[accessoryId]?.missionCoinsBonus || 0) : 0)
}

// Philosopher's Stone passive: +1 coin per 10 XP
export function getPhilosopherBonus(character, xpEarned) {
  if (!character?.ownedItems?.includes('philosophers-stone')) return 0
  return Math.floor(xpEarned / 10)
}

// Tome of Knowledge passive: +10% XP (rounds up)
export function getTomeBonus(character, baseXP) {
  if (!character?.ownedItems?.includes('tome-of-knowledge')) return 0
  return Math.ceil(baseXP * 0.1)
}
