import { useState } from 'react'
import { CLASSES, CLASS_ORDER, ClassSVG } from '../utils/character'

export default function CharacterSelectModal({ currentClass, onSelect, onClose }) {
  const [chosen, setChosen] = useState(currentClass || null)
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    if (!chosen || saving) return
    setSaving(true)
    await onSelect(chosen)
  }

  return (
    <div className="modal-backdrop" onClick={currentClass ? onClose : undefined}>
      <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">⚔️ Choose Your Class</h2>
        <p className="modal-subtitle">Your class grants a passive perk that shapes your adventure.</p>

        <div className="class-grid">
          {CLASS_ORDER.map(id => {
            const cls = CLASSES[id]
            const selected = chosen === id
            return (
              <button
                key={id}
                type="button"
                className={`class-card${selected ? ' class-card--selected' : ''}`}
                onClick={() => setChosen(id)}
                disabled={saving}
              >
                <div className="class-card-icon">
                  <ClassSVG classId={id} size={56} />
                </div>
                <div className="class-card-body">
                  <div className="class-card-name">{cls.emoji} {cls.name}</div>
                  <div className="class-card-tagline">{cls.tagline}</div>
                  <div className="class-card-perk">{cls.perk}</div>
                </div>
                {selected && <span className="class-card-check">✓</span>}
              </button>
            )
          })}
        </div>

        <div className="modal-actions">
          {currentClass && (
            <button className="modal-btn modal-btn--cancel" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          )}
          <button
            className="modal-btn modal-btn--create"
            style={{ flex: 1 }}
            onClick={handleConfirm}
            disabled={!chosen || saving}
          >
            {saving ? 'Entering the realm…' : chosen ? `Begin as ${CLASSES[chosen].name}` : 'Choose a class'}
          </button>
        </div>
      </div>
    </div>
  )
}
