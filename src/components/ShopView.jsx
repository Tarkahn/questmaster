import { useState } from 'react'
import { ITEMS, CATEGORIES } from '../utils/items'

function itemState(item, character, coins) {
  const owned = character.ownedItems?.includes(item.id)
  const count = character.consumables?.[item.id] || 0
  const equipped = item.slot && character.equippedItems?.[item.slot] === item.id
  const canAfford = coins >= item.cost

  if (item.consumable) {
    return count > 0 ? { type: 'use', count } : canAfford ? { type: 'buy' } : { type: 'locked' }
  }
  if (equipped)   return { type: 'equipped' }
  if (owned)      return { type: 'equip' }
  if (canAfford)  return { type: 'buy' }
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

      <div className="shop-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`shop-tab${activeCategory === cat.id ? ' shop-tab--active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="shop-grid">
        {categoryItems.map(item => {
          const state = itemState(item, character, coins)
          return (
            <div key={item.id} className={`item-card${state.type === 'equipped' ? ' item-card--equipped' : ''}${state.type === 'locked' ? ' item-card--locked' : ''}`}>
              <div className="item-card-icon">
                <span className="item-emoji">{item.emoji}</span>
              </div>
              <div className="item-card-name">{item.name}</div>
              <div className="item-card-effect">{item.effect}</div>
              <div className="item-card-footer">
                <span className="item-card-cost">🪙 {item.cost}</span>
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
      return <span className="item-badge item-badge--equipped">Equipped ✓</span>
    case 'equip':
      return <button className="item-btn item-btn--equip" onClick={() => onEquip(item.id)}>Equip</button>
    case 'use':
      return <button className="item-btn item-btn--use" onClick={() => onUse(item.id)}>
        Use{state.count > 1 ? ` (×${state.count})` : ''}
      </button>
    case 'buy':
      return <button className="item-btn item-btn--buy" onClick={() => onBuy(item.id)}>Buy</button>
    case 'locked':
      return <span className="item-badge item-badge--locked">Need 🪙{item.cost}</span>
    default:
      return null
  }
}
