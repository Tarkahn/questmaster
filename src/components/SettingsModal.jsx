import { useState } from 'react'

export default function SettingsModal({ settings, onSave, onClose }) {
  const [local, setLocal] = useState(settings)
  const [saving, setSaving] = useState(false)

  function update(field, value) {
    setLocal(s => ({ ...s, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(local)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">⚙️ Settings</h2>
        <p className="modal-sub">Synced across your devices.</p>

        <label className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">Send notes to the scribe</div>
            <div className="settings-row-desc">
              Include task and event notes when theming. Produces more accurate D&amp;D conversions,
              but the LLM sees more of your personal text.
            </div>
          </div>
          <input
            type="checkbox"
            className="settings-toggle"
            checked={local.sendNotesToLlm}
            onChange={e => update('sendNotesToLlm', e.target.checked)}
            disabled={saving}
          />
        </label>

        <div className="modal-actions">
          <button className="modal-btn modal-btn--cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="modal-btn modal-btn--create" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
