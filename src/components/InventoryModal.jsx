import { ITEMS } from '../utils/items'

const SLOT_LABELS = {
  head: 'Head', earrings: 'Earrings', neck: 'Neck',
  body: 'Body', cloak: 'Cloak', bracers: 'Bracers', boots: 'Boots',
  'main-hand': 'Main Hand', 'off-hand': 'Off-hand',
  'ring-1': 'Ring', 'ring-2': 'Ring',
}

function InvSection({ title, entries, renderRow }) {
  if (entries.length === 0) return null
  return (
    <div className="inv-section">
      <div className="inv-section-title">
        {title}
        <span className="inv-section-count">{entries.length}</span>
      </div>
      <div className="inv-list">
        {entries.map(renderRow)}
      </div>
    </div>
  )
}

export default function InventoryModal({ character, onClose, onEquip, onUnequip, onUse }) {
  const eq = character?.equippedItems || {}
  const owned = character?.ownedItems || []
  const consumablesMap = character?.consumables || {}

  // Build slot lookup: itemId → slot key
  const equippedSlotOf = {}
  for (const [slot, id] of Object.entries(eq)) {
    if (id) equippedSlotOf[id] = slot
  }

  const equipped = []
  const passive = []
  const cosmetic = []
  const active = []

  for (const id of owned) {
    const item = ITEMS[id]
    if (!item) continue
    if (equippedSlotOf[id]) {
      equipped.push({ item, slot: equippedSlotOf[id] })
    } else if (item.cosmetic) {
      cosmetic.push({ item })
    } else {
      passive.push({ item })
    }
  }

  for (const [id, count] of Object.entries(consumablesMap)) {
    if (count < 1) continue
    const item = ITEMS[id]
    if (item) active.push({ item, count })
  }

  const total = equipped.length + passive.length + cosmetic.length + active.length

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card inv-modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">🎒 Inventory</h2>

        {total === 0 ? (
          <p className="inv-global-empty">
            Your bag is empty. Visit the Merchant's Stall to purchase items.
          </p>
        ) : (
          <div className="inv-scroll">
            <InvSection
              title="⚒ Equipped"
              entries={equipped}
              renderRow={({ item, slot }) => (
                <div key={item.id} className="inv-row">
                  <span className="inv-emoji">{item.emoji}</span>
                  <div className="inv-row-body">
                    <span className="inv-row-name">{item.name}</span>
                    <span className="inv-row-effect">{item.effect}</span>
                  </div>
                  <div className="inv-row-right">
                    <span className="inv-slot-badge">{SLOT_LABELS[slot] || slot}</span>
                    {onUnequip && (
                      <button
                        className="inv-action-btn"
                        onClick={() => { onUnequip(item.id); onClose() }}
                      >Unequip</button>
                    )}
                  </div>
                </div>
              )}
            />

            <InvSection
              title="✨ Passive"
              entries={passive}
              renderRow={({ item }) => (
                <div key={item.id} className="inv-row">
                  <span className="inv-emoji">{item.emoji}</span>
                  <div className="inv-row-body">
                    <span className="inv-row-name">{item.name}</span>
                    <span className="inv-row-effect">{item.effect}</span>
                  </div>
                  {onEquip && item.slot && (
                    <div className="inv-row-right">
                      <button
                        className="inv-action-btn inv-action-btn--equip"
                        onClick={() => { onEquip(item.id); onClose() }}
                      >Equip</button>
                    </div>
                  )}
                </div>
              )}
            />

            <InvSection
              title="🧪 Consumables"
              entries={active}
              renderRow={({ item, count }) => (
                <div key={item.id} className="inv-row">
                  <span className="inv-emoji">{item.emoji}</span>
                  <div className="inv-row-body">
                    <span className="inv-row-name">
                      {item.name}
                      <span className="inv-count">×{count}</span>
                    </span>
                    <span className="inv-row-effect">{item.effect}</span>
                  </div>
                  {onUse && (
                    <div className="inv-row-right">
                      <button
                        className="inv-action-btn inv-action-btn--use"
                        onClick={() => onUse(item.id)}
                      >Use</button>
                    </div>
                  )}
                </div>
              )}
            />

            <InvSection
              title="🌟 Cosmetic"
              entries={cosmetic}
              renderRow={({ item }) => (
                <div key={item.id} className="inv-row">
                  <span className="inv-emoji">{item.emoji}</span>
                  <div className="inv-row-body">
                    <span className="inv-row-name">{item.name}</span>
                    <span className="inv-row-effect">{item.effect}</span>
                  </div>
                  {onEquip && item.slot && (
                    <div className="inv-row-right">
                      <button
                        className="inv-action-btn inv-action-btn--equip"
                        onClick={() => { onEquip(item.id); onClose() }}
                      >Equip</button>
                    </div>
                  )}
                </div>
              )}
            />
          </div>
        )}

        <div className="modal-actions">
          <button
            className="modal-btn modal-btn--create"
            style={{ marginLeft: 'auto' }}
            onClick={onClose}
          >Close</button>
        </div>
      </div>
    </div>
  )
}
