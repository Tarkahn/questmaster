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
    try { await onSave(local) } catch { setSaving(false) }
  }

  async function handleReTheme() {
    setRetheming(true)
    try { await onReThemeAll() } finally { setRetheming(false) }
  }

  const sfxPct = Math.round((local.sfxVolume ?? 0.7) * 100)
  const musicPct = Math.round((local.musicVolume ?? 0.3) * 100)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">⚙️ Settings</h2>

        <div className="settings-section-label">Scribe</div>

        <div className="settings-row-compact">
          <div className="settings-row-compact-left">
            <span className="settings-label-sm">Send notes to scribe</span>
            <span className="settings-desc-sm">Include task notes when generating D&amp;D titles</span>
          </div>
          <input
            type="checkbox"
            className="settings-toggle"
            checked={local.sendNotesToLlm}
            onChange={e => update('sendNotesToLlm', e.target.checked)}
            disabled={saving}
          />
        </div>

        <div className="settings-row-compact">
          <div className="settings-row-compact-left">
            <span className="settings-label-sm">Re-enchant all titles</span>
            <span className="settings-desc-sm">Clears theme cache and regenerates on all devices</span>
          </div>
          <button
            className="settings-retheme-btn"
            onClick={handleReTheme}
            disabled={retheming || saving}
          >
            {retheming ? '✨…' : '✨ Re-theme'}
          </button>
        </div>

        <div className="settings-section-label">Sound</div>

        <div className="settings-row-compact settings-row-compact--slider">
          <span className="settings-label-sm">🎵 Music</span>
          <input
            type="range"
            min="0" max="1" step="0.05"
            value={local.musicVolume ?? 0.3}
            onChange={e => update('musicVolume', Number(e.target.value))}
            className="settings-slider"
            disabled={saving}
          />
          <span className="settings-slider-value">{musicPct}%</span>
        </div>

        <div className="settings-row-compact settings-row-compact--slider">
          <span className="settings-label-sm">🔊 SFX</span>
          <input
            type="range"
            min="0" max="1" step="0.05"
            value={local.sfxVolume ?? 0.7}
            onChange={e => update('sfxVolume', Number(e.target.value))}
            className="settings-slider"
            disabled={saving}
          />
          <span className="settings-slider-value">{sfxPct}%</span>
        </div>

        <div className="modal-actions">
          <button className="modal-btn modal-btn--cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="modal-btn modal-btn--create" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
