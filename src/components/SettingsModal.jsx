import { useState, useRef, useEffect } from 'react'
import { REMINDER_OPTIONS } from '../utils/api'

const REVEAL_OPTIONS = [2, 4, 6, 8, 10] // seconds
const ITEM_H = 44                         // px per drum item

function RevealPicker({ value, onChange, disabled }) {
  const trackRef = useRef(null)
  const debounceRef = useRef(null)
  const suppressRef = useRef(false)

  useEffect(() => {
    if (!trackRef.current) return
    const idx = REVEAL_OPTIONS.indexOf(value)
    if (idx < 0) return
    suppressRef.current = true
    trackRef.current.scrollTop = idx * ITEM_H
    setTimeout(() => { suppressRef.current = false }, 80)
  }, [value])

  function handleScroll(e) {
    if (suppressRef.current) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const idx = Math.round(e.target.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(idx, REVEAL_OPTIONS.length - 1))
      onChange(REVEAL_OPTIONS[clamped])
    }, 80)
  }

  return (
    <div className={`reveal-picker${disabled ? ' reveal-picker--disabled' : ''}`}>
      <div className="reveal-picker-track" ref={trackRef} onScroll={handleScroll}>
        {REVEAL_OPTIONS.map(s => (
          <div key={s} className={`reveal-picker-item${value === s ? ' reveal-picker-item--sel' : ''}`}>
            {s}s
          </div>
        ))}
      </div>
      <div className="reveal-picker-fade reveal-picker-fade--top" />
      <div className="reveal-picker-fade reveal-picker-fade--bot" />
      <div className="reveal-picker-line reveal-picker-line--top" />
      <div className="reveal-picker-line reveal-picker-line--bot" />
    </div>
  )
}

export default function SettingsModal({ settings, onSave, onReThemeAll, onClose }) {
  const [local, setLocal] = useState({ revealMs: 5000, ...settings })
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

        <div className="settings-section-label">Quests</div>

        <div className="settings-row-compact">
          <div className="settings-row-compact-left">
            <span className="settings-label-sm">⚡ Auto-sort by urgency</span>
            <span className="settings-desc-sm">Ranks quests from most overdue to newest — overrides manual order and new-quest position</span>
          </div>
          <input
            type="checkbox"
            className="settings-toggle"
            checked={local.autoSort ?? false}
            onChange={e => update('autoSort', e.target.checked)}
            disabled={saving}
          />
        </div>

        <div className="settings-row-compact">
          <div className="settings-row-compact-left">
            <span className="settings-label-sm" style={local.autoSort ? { opacity: 0.4 } : undefined}>New quest position</span>
            <span className="settings-desc-sm" style={local.autoSort ? { opacity: 0.4 } : undefined}>Where newly created quests appear in the list</span>
          </div>
          <select
            className="settings-select"
            value={local.newQuestPosition ?? 'bottom'}
            onChange={e => update('newQuestPosition', e.target.value)}
            disabled={saving || local.autoSort}
          >
            <option value="bottom">Bottom</option>
            <option value="top">Top</option>
          </select>
        </div>

        <div className="settings-row-compact">
          <div className="settings-row-compact-left">
            <span className="settings-label-sm">🔔 Default reminder lead time</span>
            <span className="settings-desc-sm">How far ahead Google Calendar notifies you for timed quests/missions — can be overridden per item</span>
          </div>
          <select
            className="settings-select"
            value={local.defaultReminderMinutes ?? 30}
            onChange={e => update('defaultReminderMinutes', Number(e.target.value))}
            disabled={saving}
          >
            {REMINDER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-row-compact">
          <div className="settings-row-compact-left">
            <span className="settings-label-sm">Missed quest summary</span>
            <span className="settings-desc-sm">Show a summary toast when recurring quests were missed</span>
          </div>
          <input
            type="checkbox"
            className="settings-toggle"
            checked={local.showMissedQuestSummary ?? true}
            onChange={e => update('showMissedQuestSummary', e.target.checked)}
            disabled={saving}
          />
        </div>

        <div className="settings-row-compact">
          <div className="settings-row-compact-left">
            <span className="settings-label-sm">☠️ Hard mode</span>
            <span className="settings-desc-sm">Heavier penalties — every toll hits 1.5× harder</span>
          </div>
          <input
            type="checkbox"
            className="settings-toggle"
            checked={local.hardMode ?? false}
            onChange={e => update('hardMode', e.target.checked)}
            disabled={saving}
          />
        </div>

        <div className="settings-section-label">Interaction</div>

        <div className="settings-row-compact settings-row-compact--picker">
          <div className="settings-row-compact-left">
            <span className="settings-label-sm">Title reveal timer</span>
            <span className="settings-desc-sm">How long the original title shows after tapping</span>
          </div>
          <RevealPicker
            value={local.revealMs / 1000}
            onChange={s => update('revealMs', s * 1000)}
            disabled={saving}
          />
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
