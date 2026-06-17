import { useState } from 'react'

export default function SettingsModal({ settings, onSave, onReThemeAll, onClose }) {
  const [local, setLocal] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [retheming, setRetheming] = useState(false)

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

  async function handleReTheme() {
    setRetheming(true)
    try {
      await onReThemeAll()
    } finally {
      setRetheming(false)
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

        <label className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">Re-enchant all titles</div>
            <div className="settings-row-desc">
              Clears the D&amp;D theme cache on all devices and regenerates fresh titles
              from the Scribe. Use when titles feel stale or devices are showing different names.
            </div>
          </div>
          <button
            className="settings-retheme-btn"
            onClick={handleReTheme}
            disabled={retheming || saving}
          >
            {retheming ? '✨ Working…' : '✨ Re-theme'}
          </button>
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
