import { useState } from 'react'
import { ITEMS, CATEGORIES } from '../utils/items'

const TAB_META = {
  weapon:     { emoji: '⚔️', short: 'Arms' },
  armour:     { emoji: '🛡', short: 'Armour' },
  accessory:  { emoji: '💍', short: 'Rings' },
  consumable: { emoji: '🧪', short: 'Potions' },
  magic:      { emoji: '✨', short: 'Magic' },
}

function itemState(item, character, coins) {
  const owned = character.ownedItems?.includes(item.id)
  const count = character.consumables?.[item.id] || 0
  const equipped = item.slot && character.equippedItems?.[item.slot] === item.id
  const canAfford = coins >= item.cost

  if (item.consumable) {
    return count > 0 ? { type: 'use', count } : canAfford ? { type: 'buy' } : { type: 'locked' }
  }
  if (equipped)          return { type: 'equipped' }
  if (owned && item.slot) return { type: 'equip' }
  if (owned)             return { type: 'owned' }
  if (canAfford)         return { type: 'buy' }
  return { type: 'locked' }
}

export default function ShopView({ character, coins, onBuy, onEquip, onUse, onBack }) {
  const [activeCategory, setActiveCategory] = useState('weapon')
  const categoryItems = Object.values(ITEMS).filter(i => i.category === activeCategory)

  return (
    <div className="shop-view">
      <div className="shop-header">
        <button className="shop-back-btn" onClick={onBack}>← Character</button>
        <span className="shop-coin-display">🪙 {coins}</span>
      </div>

      <h2 className="shop-title">⚒ The Merchant's Stall</h2>

      {/* 5-column grid — all tabs always visible, no scroll */}
      <div className="shop-tabs">
        {CATEGORIES.map(cat => {
          const meta = TAB_META[cat.id]
          return (
            <button
              key={cat.id}
              className={`shop-tab${activeCategory === cat.id ? ' shop-tab--active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="shop-tab-emoji">{meta.emoji}</span>
              <span className="shop-tab-label">{meta.short}</span>
            </button>
          )
        })}
      </div>

      {/* Single-column list — scrolls naturally with the page */}
      <div className="shop-item-list">
        {categoryItems.map(item => {
          const state = itemState(item, character, coins)
          return (
            <div
              key={item.id}
              className={`item-row${state.type === 'equipped' ? ' item-row--equipped' : ''}${state.type === 'locked' ? ' item-row--locked' : ''}`}
            >
              <div className="item-row-icon">
                <span className="item-emoji">{item.emoji}</span>
              </div>
              <div className="item-row-body">
                <div className="item-row-name">{item.name}</div>
                <div className="item-row-effect">{item.effect}</div>
              </div>
              <div className="item-row-action">
                <span className="item-row-cost">🪙 {item.cost}</span>
                <ItemAction state={state} item={item} onBuy={onBuy} onEquip={onEquip} onUse={onUse} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ItemAction({ state, item, onBuy, onEquip, onUse }) {
  switch (state.type) {
    case 'equipped':
      return <span className="item-badge item-badge--equipped">✓ Equipped</span>
    case 'equip':
      return <button className="item-btn item-btn--equip" onClick={() => onEquip(item.id)}>Equip</button>
    case 'use':
      return <button className="item-btn item-btn--use" onClick={() => onUse(item.id)}>
        Use{state.count > 1 ? ` ×${state.count}` : ''}
      </button>
    case 'buy':
      return <button className="item-btn item-btn--buy" onClick={() => onBuy(item.id)}>Buy</button>
    case 'owned':
      return <span className="item-badge item-badge--owned">✓ Owned</span>
    case 'locked':
      return <span className="item-badge item-badge--locked">🔒</span>
    default:
      return null
  }
}
