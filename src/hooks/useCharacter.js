import { useState, useRef } from 'react'
import { DEFAULT_CHARACTER } from '../utils/character'
import { ITEMS, isItemForClass, migrateEquippedItems } from '../utils/items'
import { saveCharacter } from '../utils/driveSync'
import { rollSum } from '../utils/dice'

// D&D-style level-up HP gain: 2d10+10 (range 12-30, average 21) — matches
// the game's earlier +20-per-level example as an average rather than a flat
// amount, same spirit as rolling a class Hit Die on level-up.
function rollLevelUpHp() {
  return rollSum(2, 10) + 10
}

// Owns character state + persistence + the pure character operations.
// Cross-domain actions (buy/sell/use-consumable, which also touch coins, habits,
// and XP-double) stay in Dashboard and call commitCharacter / damagePlayer here.
export function useCharacter(token) {
  const [character, setCharacter] = useState(DEFAULT_CHARACTER)
  // Existing characters saved before 2026-07-05 have no `updatedAt` at all —
  // on the very first merge this session both sides would read as '' and
  // tie, which would wrongly keep the empty DEFAULT_CHARACTER instead of
  // loading the real saved one. Unconditionally accept Drive on that first
  // merge only; every merge after that is properly recency-gated.
  const hasMergedOnceRef = useRef(false)

  // Single persistence primitive: update React state and mirror to Drive.
  // Replaces the repeated `setCharacter(x); await saveCharacter(token, x)` pair.
  // Stamps updatedAt so mergeFromDrive can tell which copy is actually newer
  // (fixed 2026-07-05 — see mergeFromDrive).
  async function commitCharacter(updated) {
    const stamped = { ...updated, updatedAt: new Date().toISOString() }
    setCharacter(stamped)
    await saveCharacter(token, stamped)
    return stamped
  }

  // Reconcile the Drive copy on load: migrate old 4-slot equipment to the
  // 11-slot shape and backfill any DEFAULT_CHARACTER fields (HP, new slots).
  //
  // Recency-gated (fixed 2026-07-05): previously this unconditionally applied
  // whatever Drive returned on every ~15s poll, with no check for which copy
  // was actually newer — a whole-object "Drive always wins" merge, unlike
  // every other synced system in this app (recurring quests, task order),
  // which use updatedAt for last-write-wins specifically to prevent this. A
  // stale device (older cached build, or just not recently used) could
  // silently overwrite a fresher device's HP/gear with old values. Confirmed
  // via a real case: switching class surfaced HP reverting to old numbers —
  // not because switching class itself touches HP (it doesn't), but because
  // it happened to coincide with a poll that let a stale Drive snapshot win.
  function mergeFromDrive(driveCharacter) {
    const migratedEquipped = 'weapon' in (driveCharacter.equippedItems || {})
      ? migrateEquippedItems(driveCharacter.equippedItems)
      : driveCharacter.equippedItems
    const migratedChar = { ...driveCharacter, equippedItems: migratedEquipped }
    setCharacter(prev => {
      const firstMerge = !hasMergedOnceRef.current
      hasMergedOnceRef.current = true
      const driveIsNewer = firstMerge || (migratedChar.updatedAt || '') > (prev.updatedAt || '')
      if (!driveIsNewer) {
        // Local is newer (or equally unstamped) — Drive is stale. commitCharacter
        // already pushes on every local change, but as a safety net (matching
        // the recurring-quest/task-order pattern) re-push in case an earlier
        // save failed silently, so the stale Drive copy doesn't linger.
        if ((prev.updatedAt || '') > (migratedChar.updatedAt || '')) saveCharacter(token, prev)
        return prev
      }
      const next = { ...DEFAULT_CHARACTER, ...prev, ...migratedChar }
      // Keep the same reference when nothing actually changed. This runs on
      // every 15s Drive poll, and Dashboard's loadTasksAndEvents depends on
      // character.equippedItems — a new object every poll (even when
      // unchanged) was re-triggering that effect constantly, which widened
      // the window for the recurring-quest materialization race.
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next
    })
  }

  // Pick a class, auto-unequipping any gear incompatible with it.
  // Returns the list of unequipped item names so the caller can surface a toast.
  async function selectClass(classId) {
    const equippedItems = { ...character.equippedItems }
    const unequipped = []
    Object.entries(equippedItems).forEach(([slot, itemId]) => {
      if (!itemId) return
      if (!isItemForClass(ITEMS[itemId], classId)) {
        unequipped.push(ITEMS[itemId]?.name || itemId)
        equippedItems[slot] = null
      }
    })
    await commitCharacter({ ...character, class: classId, equippedItems })
    return { unequipped }
  }

  // Equip an owned item into its slot (rings fill ring-1 then ring-2).
  // Returns the item so the caller can toast, or null if the action was invalid.
  function equipItem(itemId) {
    const item = ITEMS[itemId]
    if (!item?.slot || !character.ownedItems.includes(itemId)) return null
    let targetSlot = item.slot
    if (item.slot === 'ring') {
      if (!character.equippedItems?.['ring-1']) targetSlot = 'ring-1'
      else if (!character.equippedItems?.['ring-2']) targetSlot = 'ring-2'
      else targetSlot = 'ring-1' // both full — replace ring-1
    }
    commitCharacter({ ...character, equippedItems: { ...character.equippedItems, [targetSlot]: itemId } })
    return item
  }

  function unequipItem(itemId) {
    const item = ITEMS[itemId]
    if (!item?.slot) return null
    const eq = character.equippedItems || {}
    const slot = item.slot === 'ring'
      ? (eq['ring-1'] === itemId ? 'ring-1' : 'ring-2')
      : item.slot
    commitCharacter({ ...character, equippedItems: { ...eq, [slot]: null } })
    return item
  }

  // Deduct HP. At 0 the player is reincarnated: all equipped gear is lost and
  // HP is restored to full. Returns true if the player died.
  async function damagePlayer(amount) {
    const maxHP = character.maxHP ?? 100
    const newHP = Math.max(0, (character.currentHP ?? maxHP) - amount)
    const died = newHP <= 0
    let updated
    if (died) {
      const empty = Object.fromEntries(Object.keys(character.equippedItems || {}).map(k => [k, null]))
      updated = { ...character, currentHP: maxHP, equippedItems: empty }
    } else {
      updated = { ...character, currentHP: newHP }
    }
    await commitCharacter(updated)
    return died
  }

  // Applies any pending level-up HP gains: rolls 2d10+10 per level between
  // character.hpLevel (last level already applied) and `newLevel`, adding it
  // to both maxHP and currentHP (a level-up is a power gain, not just a
  // bigger empty bar to be further from). Idempotent per level via hpLevel —
  // safe to call repeatedly/from an effect, since anything already applied
  // is a no-op. Returns null if there's nothing to apply.
  async function applyLevelUps(newLevel) {
    const fromLevel = character.hpLevel || 1
    if (newLevel <= fromLevel) return null
    const levelsGained = newLevel - fromLevel
    let hpGained = 0
    for (let i = 0; i < levelsGained; i++) hpGained += rollLevelUpHp()
    const maxHP = (character.maxHP ?? 100) + hpGained
    const currentHP = (character.currentHP ?? maxHP) + hpGained
    await commitCharacter({ ...character, maxHP, currentHP, hpLevel: newLevel })
    return { fromLevel, newLevel, levelsGained, hpGained, newMaxHP: maxHP }
  }

  return { character, commitCharacter, mergeFromDrive, selectClass, equipItem, unequipItem, damagePlayer, applyLevelUps }
}
