import { useState } from 'react'
import { CLASSES } from '../utils/character'
import { SLOT_TO_CATEGORY } from '../utils/items'
import HelpModal, { HelpButton } from './HelpModal'
import PaperDollPortrait from './PaperDollPortrait'
import { xpForStatLevel } from '../utils/statGlossary'

export default function CharacterView({ character, level, coins, points, bossesDefeated, stats, onChangeClass, onVisitShop, onBossJournal, onSlotTap, onUnequip, onOpenInventory, onAddStat, onEditStat, onViewStat }) {
  const [helpTopic, setHelpTopic] = useState(null)
  const cls = CLASSES[character?.class]

  function handleSlotTap(slotKey, itemSlot) {
    const category = SLOT_TO_CATEGORY[itemSlot] || 'weapon'
    if (onSlotTap) onSlotTap(category)
    else if (onVisitShop) onVisitShop(category)
  }

  return (
    <div className="character-view">
      {helpTopic && <HelpModal topic={helpTopic} onClose={() => setHelpTopic(null)} />}

      <div className="chronicle-section-heading">
        <h3 className="character-section-title">⚒ Equipped Gear</h3>
        <HelpButton topic="character-gear" onHelp={setHelpTopic} />
      </div>
      <PaperDollPortrait
        character={character}
        onSlotTap={handleSlotTap}
        onUnequip={onUnequip}
      />

      <div className="character-perk-row">
        <span className="character-perk-label">Perk</span>
        <span className="character-perk-text">{cls?.perk ?? '—'}</span>
      </div>

      <div className="character-stats">
        <div className="character-stat">
          <span className="character-stat-value">{level}</span>
          <span className="character-stat-label">⚔️ Level</span>
        </div>
        <div className="character-stat">
          <span className="character-stat-value">{points}</span>
          <span className="character-stat-label">✨ XP</span>
        </div>
        <div className="character-stat">
          <span className="character-stat-value">{coins}</span>
          <span className="character-stat-label">🪙 Coins</span>
        </div>
        <div
          className={`character-stat${bossesDefeated > 0 ? ' character-stat--clickable' : ''}`}
          onClick={bossesDefeated > 0 ? onBossJournal : undefined}
          title={bossesDefeated > 0 ? 'View Boss Journal' : undefined}
        >
          <span className="character-stat-value">{bossesDefeated}</span>
          <span className="character-stat-label">💀 Bosses</span>
          {bossesDefeated > 0 && <span className="character-stat-hint">📜</span>}
        </div>
      </div>

      {stats && stats.length > 0 && (
        <>
          <div className="chronicle-section-heading">
            <h3 className="character-section-title">⚡ Attributes</h3>
            <HelpButton topic="character-attributes" onHelp={setHelpTopic} />
          </div>
          <div className="character-attributes">
            {stats.map(stat => {
              const lvlStart = xpForStatLevel(stat.level)
              const lvlEnd = xpForStatLevel(stat.level + 1)
              const into = stat.xp - lvlStart
              const needed = lvlEnd - lvlStart
              const pct = needed > 0 ? Math.min(100, Math.round((into / needed) * 100)) : 100
              return (
                <div
                  key={stat.id}
                  className={`stat-row stat-row--clickable${stat.custom ? ' stat-row--custom' : ''}`}
                  onClick={() => onViewStat?.(stat)}
                  title="Tap to see contributions"
                >
                  <span className="stat-emoji">{stat.emoji}</span>
                  <div className="stat-info">
                    <div className="stat-header">
                      <span className="stat-name">{stat.name}</span>
                      <span className="stat-level">Lv {stat.level}</span>
                    </div>
                    <div className="stat-bar-track">
                      <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="stat-xp-label">{into} / {needed} XP</div>
                  </div>
                  {stat.custom && (
                    <span
                      className="stat-edit-hint"
                      onClick={e => { e.stopPropagation(); onEditStat?.(stat) }}
                      title="Edit attribute"
                    >✏️</span>
                  )}
                </div>
              )
            })}
            <button className="stat-add-btn" onClick={() => onAddStat?.()}>＋ Add Custom Stat</button>
          </div>
        </>
      )}

      <button className="inv-primary-btn" onClick={onOpenInventory}>
        🎒 Inventory
      </button>
      <div className="character-actions">
        <button className="modal-btn modal-btn--cancel" onClick={onChangeClass}>
          Change Class
        </button>
        <button className="modal-btn modal-btn--create" onClick={() => onVisitShop?.()}>
          🛒 Visit Shop
        </button>
      </div>
    </div>
  )
}
