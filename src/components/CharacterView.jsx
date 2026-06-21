import { CLASSES } from '../utils/character'
import { ITEMS } from '../utils/items'

const SLOT_LABELS = {
  weapon: '⚔️ Weapon',
  head: '🪖 Head',
  body: '🛡 Body',
  accessory: '💍 Accessory',
}

export default function CharacterView({ character, level, coins, points, bossesDefeated, onChangeClass, onVisitShop }) {
  const cls = CLASSES[character?.class]

  return (
    <div className="character-view">
      <div className="character-portrait">
        <div className="character-silhouette">
          {character?.class && (
            <img src={`/portraits/${character.class}.jpg`} alt={cls?.name} className="character-portrait-img" />
          )}
        </div>
        <div className="character-class-name">
          {cls ? `${cls.emoji} ${cls.name}` : '—'}
        </div>
        {cls && <div className="character-class-tagline">{cls.tagline}</div>}
      </div>

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
        <div className="character-stat">
          <span className="character-stat-value">{bossesDefeated}</span>
          <span className="character-stat-label">💀 Bosses</span>
        </div>
      </div>

      <h3 className="character-section-title">Equipment</h3>
      <div className="equipment-grid">
        {Object.entries(SLOT_LABELS).map(([slot, label]) => {
          const equipped = character?.equippedItems?.[slot]
          return (
            <div key={slot} className={`equipment-slot${equipped ? ' equipment-slot--filled' : ''}`}>
              <span className="equipment-slot-label">{label}</span>
              <span className="equipment-slot-item">
                {equipped ? `${ITEMS[equipped]?.emoji || ''} ${ITEMS[equipped]?.name || equipped}` : 'Empty'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="character-actions">
        <button className="modal-btn modal-btn--cancel" onClick={onChangeClass}>
          Change Class
        </button>
        <button className="modal-btn modal-btn--create" onClick={onVisitShop}>
          🛒 Visit Shop
        </button>
      </div>
    </div>
  )
}
