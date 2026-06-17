import { useState } from 'react'
import { DEFAULT_GLOSSARY } from '../utils/defaultGlossary'

export default function GlossaryModal({ glossary, onSave, onClose }) {
  const [text, setText] = useState(glossary ?? DEFAULT_GLOSSARY)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(text)
    setSaving(false)
    onClose()
  }

  function handleReset() {
    setText(DEFAULT_GLOSSARY)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">📜 Vocabulary Glossary</h2>
        <p className="modal-subtitle">
          Edit D&D translations below. New items use the updated glossary immediately.
          Previously themed items won't change until you clear the theme cache.
        </p>
        <textarea
          className="glossary-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          spellCheck={false}
        />
        <div className="modal-actions">
          <button className="modal-btn modal-btn--cancel" onClick={handleReset}>
            Reset to Default
          </button>
          <div className="modal-actions-right">
            <button className="modal-btn modal-btn--cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="modal-btn modal-btn--create" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save to Drive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
