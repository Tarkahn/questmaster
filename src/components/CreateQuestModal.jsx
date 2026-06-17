import { useState } from 'react'
import DatePicker from './DatePicker'

export default function CreateQuestModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await onCreate({ title: title.trim(), due: due || undefined, notes: notes.trim() || undefined })
    } catch (err) {
      setError(err.message || 'Could not save quest.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">⚔️ New Quest</h2>
        <p className="modal-subtitle">Adds a task to Google Tasks. The scribe will theme it next.</p>

        <form onSubmit={handleSubmit} className="quest-form">
          <label className="form-label">
            Title
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Pick up medication"
              autoFocus
              required
            />
          </label>

          <div className="form-label">
            Due date <span className="form-optional">(optional)</span>
            <DatePicker value={due} onChange={setDue} allowClear />
          </div>

          <label className="form-label">
            Notes <span className="form-optional">(optional)</span>
            <textarea
              className="form-input form-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </label>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="modal-btn modal-btn--create" disabled={!title.trim() || saving}>
              {saving ? 'Summoning...' : 'Summon Quest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
