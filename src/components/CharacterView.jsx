import { CLASSES } from '../utils/character'
import { ITEMS, SLOT_META, SLOT_TO_CATEGORY } from '../utils/items'

// Paper doll layout: rows of slot keys (null = spacer)
const DOLL_ROWS = [
  ['head'],
  ['earrings'],
  ['neck'],
  ['off-hand', 'body', 'main-hand'],
  ['cloak'],
  ['ring-1', 'ring-2'],
  ['bracers'],
  ['boots'],
]

function SlotBadge({ slotKey, character, onSlotTap }) {
  const meta = SLOT_META[slotKey]
  if (!meta) return null
  const itemId = character?.equippedItems?.[slotKey]
  const item = itemId ? ITEMS[itemId] : null
  return (
    <div
      className={`doll-slot${item ? ' doll-slot--filled' : ' doll-slot--empty'}`}
      onClick={() => onSlotTap(slotKey, meta.itemSlot || slotKey)}
      title={item ? `${item.name} — tap to visit shop` : `${meta.label} — tap to equip`}
    >
      <span className="doll-slot-icon">{item ? item.emoji : meta.emoji}</span>
      <span className="doll-slot-name">{meta.label}</span>
      <span className="doll-slot-label">{item ? item.name : '＋ Tap to equip'}</span>
    </div>
  )
}

export default function CharacterView({ character, level, coins, points, bossesDefeated, onChangeClass, onVisitShop, onBossJournal, onSlotTap }) {
  const cls = CLASSES[character?.class]

  function handleSlotTap(slotKey, itemSlot) {
    const category = SLOT_TO_CATEGORY[itemSlot] || 'weapon'
    if (onSlotTap) onSlotTap(category)
    else if (onVisitShop) onVisitShop(category)
  }

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

      <h3 className="character-section-title">⚒ Equipped Gear</h3>
      <div className="paper-doll">
        {DOLL_ROWS.map((row, ri) => (
          <div key={ri} className={`doll-row doll-row--${row.length === 1 ? 'single' : 'trio'}`}>
            {row.map(slotKey => (
              <SlotBadge
                key={slotKey}
                slotKey={slotKey}
                character={character}
                onSlotTap={handleSlotTap}
              />
            ))}
          </div>
        ))}
      </div>

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
