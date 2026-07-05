import { ITEMS, SLOT_META, SLOT_TO_CATEGORY } from '../utils/items'
import { CLASSES } from '../utils/character'

// Anatomical positions as percentage of the portrait container.
// Estimates — will need fine-tuning once full-body portraits are in place.
const SLOT_POSITIONS = {
  head:        { top: '5%',  left: '50%',  centered: true },
  earrings:    { top: '12%', right: '12%' },
  neck:        { top: '20%', left: '50%',  centered: true },
  cloak:       { top: '27%', left: '2%' },
  body:        { top: '34%', left: '50%',  centered: true },
  'off-hand':  { top: '43%', left: '2%' },
  'main-hand': { top: '43%', right: '2%' },
  bracers:     { top: '54%', left: '3%' },
  'ring-1':    { top: '62%', left: '4%' },
  'ring-2':    { top: '62%', right: '4%' },
  boots:       { top: '86%', left: '50%',  centered: true },
}

export default function PaperDollPortrait({ character, onSlotTap, onUnequip }) {
  const cls = CLASSES[character?.class]
  const eq = character?.equippedItems || {}

  function handlePipTap(slotKey) {
    const meta = SLOT_META[slotKey]
    if (!meta) return
    const itemSlot = meta.itemSlot || slotKey
    const category = SLOT_TO_CATEGORY[itemSlot] || 'weapon'
    onSlotTap?.(slotKey, itemSlot, category)
  }

  return (
    <div className="paper-doll-portrait">
      <img
        src={`/portraits/${character?.class}_full.jpg`}
        onError={e => { e.currentTarget.src = `/portraits/${character?.class}.jpg` }}
        alt={cls?.name || 'Character'}
        className="paper-doll-img"
      />

      <div className="paper-doll-nameplate">
        <span className="paper-doll-class-name">{cls ? cls.name : '—'}</span>
        {cls && <span className="paper-doll-class-tagline">{cls.tagline}</span>}
      </div>

      {Object.entries(SLOT_POSITIONS).map(([slotKey, pos]) => {
        const meta = SLOT_META[slotKey]
        if (!meta) return null

        const itemSlot = meta.itemSlot || slotKey
        const itemId = eq[slotKey] ?? null
        const item = itemId ? ITEMS[itemId] : null

        const style = {
          top: pos.top,
          ...(pos.left  ? { left: pos.left }   : {}),
          ...(pos.right ? { right: pos.right }  : {}),
          ...(pos.centered ? { transform: 'translateX(-50%)' } : {}),
        }

        return (
          <div
            key={slotKey}
            className={`slot-pip${item ? ' slot-pip--filled' : ' slot-pip--empty'}`}
            style={style}
            onClick={() => handlePipTap(slotKey)}
            title={item ? `${item.name} — tap to visit shop` : `${meta.label} — tap to equip`}
          >
            <span className="slot-pip-emoji">{item ? item.emoji : meta.emoji}</span>
            {item && (
              <button
                className="slot-pip-unequip"
                onClick={e => { e.stopPropagation(); onUnequip?.(itemId) }}
                title="Unequip"
              >✕</button>
            )}
          </div>
        )
      })}
    </div>
  )
}
