// slot values: 'main-hand' | 'off-hand' | 'head' | 'earrings' | 'body' | 'cloak'
//              'neck' | 'ring' | 'bracers' | 'boots' | null (consumables/magic passives)
// affinity: 'all' = any class | string[] = specific classes only
// ring items auto-fill 'ring-1' then 'ring-2' in equippedItems state

export const ITEMS = {

  // ── Main Hand (Weapons) ────────────────────────────────────────
  'iron-sword': {
    id: 'iron-sword', name: 'Iron Sword', category: 'weapon', slot: 'main-hand',
    affinity: ['warrior'],
    cost: 30, emoji: '⚔️',
    effect: '+1 to all Quest dice rolls',
    diceBonus: 1,
  },
  'steel-sword': {
    id: 'steel-sword', name: 'Steel Sword', category: 'weapon', slot: 'main-hand',
    affinity: ['warrior'],
    cost: 80, emoji: '🗡️',
    effect: '+2 to all Quest dice rolls',
    diceBonus: 2,
  },
  'dragon-blade': {
    id: 'dragon-blade', name: 'Dragon Blade', category: 'weapon', slot: 'main-hand',
    affinity: ['warrior'],
    cost: 200, emoji: '🐲',
    effect: '+3 to all Quest dice rolls',
    diceBonus: 3,
  },
  'arcane-staff': {
    id: 'arcane-staff', name: 'Arcane Staff', category: 'weapon', slot: 'main-hand',
    affinity: ['mage'],
    cost: 60, emoji: '🪄',
    effect: '+2 to all Quest dice rolls',
    diceBonus: 2,
  },
  'shadow-dagger': {
    id: 'shadow-dagger', name: 'Shadow Dagger', category: 'weapon', slot: 'main-hand',
    affinity: ['rogue'],
    cost: 50, emoji: '🔪',
    effect: '+2 to all Quest dice rolls',
    diceBonus: 2,
  },
  'holy-mace': {
    id: 'holy-mace', name: 'Holy Mace', category: 'weapon', slot: 'main-hand',
    affinity: ['cleric'],
    cost: 55, emoji: '🔨',
    effect: '+1 to all Quest dice rolls',
    diceBonus: 1,
  },
  'hunters-bow': {
    id: 'hunters-bow', name: "Hunter's Bow", category: 'weapon', slot: 'main-hand',
    affinity: ['ranger'],
    cost: 65, emoji: '🏹',
    effect: '+2 coins on every calendar Mission',
    missionCoinsBonus: 2,
  },

  // ── Off-Hand ───────────────────────────────────────────────────
  'battle-shield': {
    id: 'battle-shield', name: 'Battle Shield', category: 'weapon', slot: 'off-hand',
    affinity: ['warrior'],
    cost: 60, emoji: '🛡',
    effect: 'Streak shield — absorbs 1 missed day per week',
    streakShield: true,
  },
  'focus-orb': {
    id: 'focus-orb', name: 'Focus Orb', category: 'weapon', slot: 'off-hand',
    affinity: ['mage'],
    cost: 55, emoji: '🔮',
    effect: '+2 XP on every Quest completion',
    xpFlatBonus: 2,
  },
  'holy-tome': {
    id: 'holy-tome', name: 'Holy Tome', category: 'weapon', slot: 'off-hand',
    affinity: ['cleric'],
    cost: 50, emoji: '📖',
    effect: 'Restores 1 boss HP on every Quest completion',
    bossHealPerQuest: 1,
  },
  'quiver': {
    id: 'quiver', name: 'Quiver', category: 'weapon', slot: 'off-hand',
    affinity: ['ranger'],
    cost: 40, emoji: '🪃',
    effect: '+1 coin on every Mission claim',
    missionCoinsBonus: 1,
  },

  // ── Head ──────────────────────────────────────────────────────
  'iron-helm': {
    id: 'iron-helm', name: 'Iron Helm', category: 'armour', slot: 'head',
    affinity: ['warrior'],
    cost: 40, emoji: '⛑️',
    effect: 'Cosmetic — forged in the smiths of the Iron Keep',
    cosmetic: true,
  },
  'mages-hat': {
    id: 'mages-hat', name: "Mage's Hat", category: 'armour', slot: 'head',
    affinity: ['mage'],
    cost: 35, emoji: '🎩',
    effect: 'Cosmetic — impossibly tall, impossibly pointy',
    cosmetic: true,
  },
  'shadow-hood': {
    id: 'shadow-hood', name: 'Shadow Hood', category: 'armour', slot: 'head',
    affinity: ['rogue'],
    cost: 35, emoji: '🥷',
    effect: 'Cosmetic — conceals identity, enhances mystique',
    cosmetic: true,
  },
  'clerics-cowl': {
    id: 'clerics-cowl', name: "Cleric's Cowl", category: 'armour', slot: 'head',
    affinity: ['cleric'],
    cost: 35, emoji: '🕍',
    effect: 'Cosmetic — worn in devotion to the old rites',
    cosmetic: true,
  },
  'rangers-cap': {
    id: 'rangers-cap', name: "Ranger's Cap", category: 'armour', slot: 'head',
    affinity: ['ranger'],
    cost: 35, emoji: '🪖',
    effect: 'Cosmetic — wide-brimmed, weather-beaten, trustworthy',
    cosmetic: true,
  },

  // ── Earrings ──────────────────────────────────────────────────
  'mithril-studs': {
    id: 'mithril-studs', name: 'Mithril Studs', category: 'accessory', slot: 'earrings',
    affinity: 'all',
    cost: 15, emoji: '✨',
    effect: 'Cosmetic — lightweight, timeless, undeniably heroic',
    cosmetic: true,
  },
  'ember-earrings': {
    id: 'ember-earrings', name: 'Ember Earrings', category: 'accessory', slot: 'earrings',
    affinity: ['warrior', 'rogue'],
    cost: 30, emoji: '🔥',
    effect: 'Cosmetic — forged from dragonglass, they always feel warm',
    cosmetic: true,
  },
  'moonstone-drops': {
    id: 'moonstone-drops', name: 'Moonstone Drops', category: 'accessory', slot: 'earrings',
    affinity: ['mage', 'cleric'],
    cost: 30, emoji: '🌙',
    effect: '+1 XP on every Mission claim',
    xpFlatBonus: 1,
  },

  // ── Body (Armour / Robes) ─────────────────────────────────────
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
    cost: 150, emoji: '💜',
    effect: 'Cosmetic — XP bar turns arcane gold',
    cosmetic: true, archmageRobes: true,
  },
  'vestments': {
    id: 'vestments', name: 'Vestments', category: 'armour', slot: 'body',
    affinity: ['cleric'],
    cost: 50, emoji: '👘',
    effect: 'Cosmetic — the sacred garb of a devoted cleric',
    cosmetic: true,
  },
  'leather-doublet': {
    id: 'leather-doublet', name: 'Leather Doublet', category: 'armour', slot: 'body',
    affinity: ['rogue'],
    cost: 45, emoji: '🥋',
    effect: 'Cosmetic — supple and silent',
    cosmetic: true,
  },
  'hunters-jerkin': {
    id: 'hunters-jerkin', name: "Hunter's Jerkin", category: 'armour', slot: 'body',
    affinity: ['ranger'],
    cost: 50, emoji: '🧥',
    effect: 'Cosmetic — pockets for everything, including pine needles',
    cosmetic: true,
  },

  // ── Cloak (Back / Shoulders) ──────────────────────────────────
  'travelers-cloak': {
    id: 'travelers-cloak', name: "Traveller's Cloak", category: 'armour', slot: 'cloak',
    affinity: 'all',
    cost: 25, emoji: '🧣',
    effect: 'Cosmetic — the mark of a seasoned adventurer',
    cosmetic: true,
  },
  'crow-feather-cloak': {
    id: 'crow-feather-cloak', name: 'Crow-Feather Cloak', category: 'armour', slot: 'cloak',
    affinity: ['rogue'],
    cost: 60, emoji: '🪶',
    effect: 'Cosmetic — light as shadow, dark as night',
    cosmetic: true,
  },
  'forest-cloak': {
    id: 'forest-cloak', name: 'Forest Cloak', category: 'armour', slot: 'cloak',
    affinity: ['ranger'],
    cost: 45, emoji: '🌿',
    effect: 'Cosmetic — woven from the canopy of the Thornwood',
    cosmetic: true,
  },
  'war-cloak': {
    id: 'war-cloak', name: 'War Cloak', category: 'armour', slot: 'cloak',
    affinity: ['warrior'],
    cost: 55, emoji: '🚩',
    effect: 'Cosmetic — billows dramatically in any breeze',
    cosmetic: true,
  },
  'void-shroud': {
    id: 'void-shroud', name: 'Void Shroud', category: 'armour', slot: 'cloak',
    affinity: ['mage'],
    cost: 70, emoji: '🌌',
    effect: 'Cosmetic — the stars in it move on their own',
    cosmetic: true,
  },

  // ── Neck (Amulets / Pendants) ─────────────────────────────────
  'fortune-amulet': {
    id: 'fortune-amulet', name: 'Amulet of Fortune', category: 'accessory', slot: 'neck',
    affinity: 'all',
    cost: 60, emoji: '🍀',
    effect: '10% chance to double coins on any completion',
    fortuneChance: 0.1,
  },
  'iron-will-talisman': {
    id: 'iron-will-talisman', name: 'Iron Will Talisman', category: 'accessory', slot: 'neck',
    affinity: ['warrior', 'ranger'],
    cost: 70, emoji: '🪬',
    effect: 'Streak shield — miss 1 day without breaking your streak (once per week)',
    streakShield: true,
  },
  'arcane-pendant': {
    id: 'arcane-pendant', name: 'Arcane Pendant', category: 'accessory', slot: 'neck',
    affinity: ['mage'],
    cost: 45, emoji: '🔷',
    effect: '+5 XP on every Quest completion',
    xpFlatBonus: 5,
  },
  'clerics-amulet': {
    id: 'clerics-amulet', name: "Cleric's Amulet", category: 'accessory', slot: 'neck',
    affinity: ['cleric'],
    cost: 50, emoji: '☯️',
    effect: 'Restores 1 boss HP each time you complete any Quest',
    bossHealPerQuest: 1,
  },
  'rangers-sigil': {
    id: 'rangers-sigil', name: "Ranger's Sigil", category: 'accessory', slot: 'neck',
    affinity: ['ranger'],
    cost: 40, emoji: '🍃',
    effect: '+1 coin on every Mission claim',
    missionCoinsBonus: 1,
  },

  // ── Rings ─────────────────────────────────────────────────────
  // Items with slot:'ring' auto-fill ring-1 then ring-2 in equippedItems state
  'ring-of-focus': {
    id: 'ring-of-focus', name: 'Ring of Focus', category: 'accessory', slot: 'ring',
    affinity: 'all',
    cost: 40, emoji: '💍',
    effect: '+2 coins on all Legendary Quest completions',
    legendaryCoinsBonus: 2,
  },
  'rogues-signet': {
    id: 'rogues-signet', name: "Rogue's Signet", category: 'accessory', slot: 'ring',
    affinity: ['rogue'],
    cost: 55, emoji: '💠',
    effect: '+3 coins on all Normal Quest completions',
    normalCoinsBonus: 3,
  },
  'band-of-valor': {
    id: 'band-of-valor', name: 'Band of Valor', category: 'accessory', slot: 'ring',
    affinity: ['warrior'],
    cost: 45, emoji: '🥇',
    effect: '+1 to all Quest dice rolls',
    diceBonus: 1,
  },
  'scholars-ring': {
    id: 'scholars-ring', name: "Scholar's Ring", category: 'accessory', slot: 'ring',
    affinity: ['mage'],
    cost: 50, emoji: '🔵',
    effect: '+3 XP on every Quest completion',
    xpFlatBonus: 3,
  },
  'nature-band': {
    id: 'nature-band', name: 'Nature Band', category: 'accessory', slot: 'ring',
    affinity: ['ranger', 'cleric'],
    cost: 35, emoji: '🌱',
    effect: 'Cosmetic — carved from living wood, still growing',
    cosmetic: true,
  },

  // ── Bracers (Gloves / Gauntlets / Arm Cuffs) ──────────────────
  'iron-gauntlets': {
    id: 'iron-gauntlets', name: 'Iron Gauntlets', category: 'armour', slot: 'bracers',
    affinity: ['warrior'],
    cost: 45, emoji: '🥊',
    effect: '+1 to all Quest dice rolls',
    diceBonus: 1,
  },
  'enchanted-gloves': {
    id: 'enchanted-gloves', name: 'Enchanted Gloves', category: 'armour', slot: 'bracers',
    affinity: ['mage'],
    cost: 50, emoji: '🧤',
    effect: '+2 XP on every Quest completion',
    xpFlatBonus: 2,
  },
  'lockpick-bracers': {
    id: 'lockpick-bracers', name: 'Lockpick Bracers', category: 'armour', slot: 'bracers',
    affinity: ['rogue'],
    cost: 40, emoji: '🔑',
    effect: '+3 coins on all Normal Quest completions',
    normalCoinsBonus: 3,
  },
  'blessed-wraps': {
    id: 'blessed-wraps', name: 'Blessed Wraps', category: 'armour', slot: 'bracers',
    affinity: ['cleric'],
    cost: 35, emoji: '🩹',
    effect: 'Cosmetic — wrapped in the prayers of a hundred pilgrims',
    cosmetic: true,
  },
  'archers-vambrace': {
    id: 'archers-vambrace', name: "Archer's Vambrace", category: 'armour', slot: 'bracers',
    affinity: ['ranger'],
    cost: 40, emoji: '🎯',
    effect: '+1 coin on every Mission claim',
    missionCoinsBonus: 1,
  },

  // ── Boots ─────────────────────────────────────────────────────
  'iron-greaves': {
    id: 'iron-greaves', name: 'Iron Greaves', category: 'armour', slot: 'boots',
    affinity: ['warrior'],
    cost: 40, emoji: '🦾',
    effect: 'Cosmetic — heavy, reliable, loud on stone floors',
    cosmetic: true,
  },
  'shadow-boots': {
    id: 'shadow-boots', name: 'Shadow Boots', category: 'armour', slot: 'boots',
    affinity: ['rogue'],
    cost: 50, emoji: '👟',
    effect: 'Old tasks (4+ days) still award 50% coins instead of 25%',
    shadowBoots: true,
  },
  'pilgrims-sandals': {
    id: 'pilgrims-sandals', name: "Pilgrim's Sandals", category: 'armour', slot: 'boots',
    affinity: ['cleric'],
    cost: 30, emoji: '🩴',
    effect: 'Cosmetic — worn smooth by ten thousand miles of devotion',
    cosmetic: true,
  },
  'forest-treads': {
    id: 'forest-treads', name: 'Forest Treads', category: 'armour', slot: 'boots',
    affinity: ['ranger'],
    cost: 40, emoji: '🥾',
    effect: '+2 coins on Legendary Quest completions',
    legendaryCoinsBonus: 2,
  },
  'silk-slippers': {
    id: 'silk-slippers', name: 'Silk Slippers', category: 'armour', slot: 'boots',
    affinity: ['mage'],
    cost: 35, emoji: '🩰',
    effect: 'Cosmetic — whisper-quiet, arcane-woven',
    cosmetic: true,
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

  // ── Magic (Passives / Collectibles) ───────────────────────────
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
  { id: 'weapon',     label: '⚔️ Arms' },
  { id: 'armour',     label: '🛡 Armour' },
  { id: 'accessory',  label: '💍 Jewellery' },
  { id: 'consumable', label: '🧪 Potions' },
  { id: 'magic',      label: '✨ Magic' },
]

// Maps item slot → shop category tab
export const SLOT_TO_CATEGORY = {
  'main-hand': 'weapon',
  'off-hand':  'weapon',
  'head':      'armour',
  'body':      'armour',
  'cloak':     'armour',
  'bracers':   'armour',
  'boots':     'armour',
  'earrings':  'accessory',
  'neck':      'accessory',
  'ring':      'accessory',
}

// Human-readable label and emoji for each slot (used by paper doll)
export const SLOT_META = {
  'main-hand': { label: 'Main Hand', emoji: '⚔️' },
  'off-hand':  { label: 'Off Hand',  emoji: '🛡' },
  'head':      { label: 'Head',      emoji: '🪖' },
  'earrings':  { label: 'Earrings',  emoji: '💎' },
  'body':      { label: 'Body',      emoji: '👘' },
  'cloak':     { label: 'Cloak',     emoji: '🧣' },
  'neck':      { label: 'Neck',      emoji: '📿' },
  'ring-1':    { label: 'Ring',      emoji: '💍', itemSlot: 'ring' },
  'ring-2':    { label: 'Ring',      emoji: '💍', itemSlot: 'ring' },
  'bracers':   { label: 'Bracers',   emoji: '🧤' },
  'boots':     { label: 'Boots',     emoji: '👢' },
}

export function isItemForClass(item, playerClass) {
  if (!playerClass) return true
  const affinity = item.affinity || 'all'
  return affinity === 'all' || (Array.isArray(affinity) && affinity.includes(playerClass))
}

// All currently equipped item IDs as a flat array
function equippedIds(character) {
  return Object.values(character?.equippedItems || {}).filter(Boolean)
}

// Sum any numeric bonus property across all equipped items
function sumBonus(character, prop) {
  return equippedIds(character).reduce((sum, id) => sum + (ITEMS[id]?.[prop] || 0), 0)
}

// Check if a specific item is equipped in any slot
export function isEquippedAnywhere(character, itemId) {
  return equippedIds(character).includes(itemId)
}

export function getItemDiceBonus(character) {
  return sumBonus(character, 'diceBonus')
}

export function getItemMissionBonus(character) {
  return sumBonus(character, 'missionCoinsBonus')
}

export function getPhilosopherBonus(character, xpEarned) {
  if (!character?.ownedItems?.includes('philosophers-stone')) return 0
  return Math.floor(xpEarned / 10)
}

export function getTomeBonus(character, baseXP) {
  if (!character?.ownedItems?.includes('tome-of-knowledge')) return 0
  return Math.ceil(baseXP * 0.1)
}

// Migrate old 4-slot equippedItems to new 11-slot shape
export function migrateEquippedItems(old) {
  if (!old) return {}
  const slotMap = {
    weapon:    'main-hand',
    head:      'head',
    body:      'body',
    accessory: null,  // handled case-by-case below
  }
  const result = {}
  // Map weapon → main-hand, head → head, body → body
  if (old.weapon)    result['main-hand'] = old.weapon
  if (old.head)      result['head']      = old.head
  if (old.body) {
    // Body items that are actually cloaks
    const cloakIds = new Set(['travelers-cloak', 'crow-feather-cloak', 'forest-cloak'])
    result[cloakIds.has(old.body) ? 'cloak' : 'body'] = old.body
  }
  // Accessory → ring or neck based on item type
  if (old.accessory) {
    const ringIds = new Set(['ring-of-focus', 'rogues-signet'])
    result[ringIds.has(old.accessory) ? 'ring-1' : 'neck'] = old.accessory
  }
  return result
}
