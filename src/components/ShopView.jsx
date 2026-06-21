import { useState } from 'react'
import { ITEMS, CATEGORIES, isItemForClass } from '../utils/items'

const TAB_META = {
  weapon:     { emoji: '⚔️', short: 'Arms' },
  armour:     { emoji: '🛡', short: 'Armour' },
  accessory:  { emoji: '💍', short: 'Rings' },
  consumable: { emoji: '🧪', short: 'Potions' },
  magic:      { emoji: '✨', short: 'Magic' },
}

function getState(item, character, coins) {
  const owned    = character.ownedItems?.includes(item.id)
  const count    = character.consumables?.[item.id] || 0
  const hasAny   = owned || count > 0
  const equipped = item.slot && character.equippedItems?.[item.slot] === item.id
  const canAfford = coins >= item.cost
  const forClass  = isItemForClass(item, character.class)
  const sellPrice = Math.floor(item.cost / 2)

  // Owned cross-class: can only sell
  if (hasAny && !forClass) return { type: 'cross-class', sellPrice }

  if (item.consumable) {
    if (count > 0) return { type: 'use', count, sellPrice }
    return canAfford ? { type: 'buy' } : { type: 'locked' }
  }
  if (equipped)            return { type: 'equipped', sellPrice }
  if (owned && item.slot)  return { type: 'equip', sellPrice }
  if (owned)               return { type: 'owned', sellPrice }
  if (canAfford)           return { type: 'buy' }
  return { type: 'locked' }
}

export default function ShopView({ character, coins, onBuy, onEquip, onUse, onSell, onBack }) {
  const [activeCategory, setActiveCategory] = useState('weapon')
  const [showAll, setShowAll] = useState(false)

  const allInCategory = Object.values(ITEMS).filter(i => i.category === activeCategory)

  const visibleItems = allInCategory.filter(item => {
    const owned  = character.ownedItems?.includes(item.id)
    const hasAny = owned || (character.consumables?.[item.id] || 0) > 0
    if (hasAny) return true          // always show owned (so player can sell)
    if (showAll) return true
    return isItemForClass(item, character.class)
  })

  return (
    <div className="shop-view">
      <div className="shop-header">
        <button className="shop-back-btn" onClick={onBack}>← Character</button>
        <span className="shop-coin-display">🪙 {coins}</span>
      </div>

      <div className="shop-title-row">
        <h2 className="shop-title">⚒ The Merchant's Stall</h2>
        <button
          className={`shop-filter-btn${showAll ? ' shop-filter-btn--active' : ''}`}
          onClick={() => setShowAll(v => !v)}
          title={showAll ? 'Showing all items' : 'Showing items for your class'}
        >
          {showAll ? '⭐ My Class' : '🌐 Show All'}
        </button>
      </div>

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

      <div className="shop-item-list">
        {visibleItems.length === 0 && (
          <p className="shop-empty">No items available for your class here yet.</p>
        )}
        {visibleItems.map(item => {
          const state = getState(item, character, coins)
          return (
            <div
              key={item.id}
              className={[
                'item-row',
                state.type === 'equipped'     ? 'item-row--equipped'    : '',
                state.type === 'locked'       ? 'item-row--locked'      : '',
                state.type === 'cross-class'  ? 'item-row--cross-class' : '',
              ].filter(Boolean).join(' ')}
            >
              <div className="item-row-icon">
                <span className="item-emoji">{item.emoji}</span>
              </div>
              <div className="item-row-body">
                <div className="item-row-name">{item.name}</div>
                <div className="item-row-effect">{item.effect}</div>
                {state.type === 'cross-class' && (
                  <div className="item-row-cross-note">🔒 Not equippable as {character.class}</div>
                )}
              </div>
              <div className="item-row-action">
                {(state.type === 'buy' || state.type === 'locked') && (
                  <span className="item-row-cost">🪙 {item.cost}</span>
                )}
                <PrimaryAction state={state} item={item} onBuy={onBuy} onEquip={onEquip} onUse={onUse} />
                {'sellPrice' in state && (
                  <button className="item-btn item-btn--sell" onClick={() => onSell(item.id)}>
                    Sell {state.sellPrice}🪙
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PrimaryAction({ state, item, onBuy, onEquip, onUse }) {
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
    case 'cross-class':
      return null
    case 'locked':
      return <span className="item-badge item-badge--locked">🔒</span>
    default:
      return null
  }
}
