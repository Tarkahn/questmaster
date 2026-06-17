import { useState } from 'react'
import DatePicker from './DatePicker'
import TimePicker from './TimePicker'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Current time, rounded to the nearest 5 minutes
function defaultStart() {
  const d = new Date()
  const m = Math.round(d.getMinutes() / 5) * 5
  d.setMinutes(m, 0, 0)
  if (m === 60) d.setHours(d.getHours() + 1, 0, 0, 0)
  return d.toTimeString().slice(0, 5)
}

function addHour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h + 1, m, 0, 0)
  return d.toTimeString().slice(0, 5)
}

export default function CreateMissionModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayStr())
  const [start, setStart] = useState(defaultStart())
  const [end, setEnd] = useState(addHour(defaultStart()))
  const [allDay, setAllDay] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function handleStartChange(v) {
    setStart(v)
    // Auto-bump end if it falls behind start
    if (v >= end) setEnd(addHour(v))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !date || saving) return
    if (!allDay && (!start || !end || end <= start)) {
      setError('End time must be after start time.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onCreate({
        title: title.trim(),
        date,
        start: allDay ? undefined : start,
        end: allDay ? undefined : end,
        allDay,
        notes: notes.trim() || undefined,
      })
    } catch (err) {
      setError(err.message || 'Could not save mission.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">📅 New Mission</h2>
        <p className="modal-subtitle">Adds a calendar event. The scribe will theme it next.</p>

        <form onSubmit={handleSubmit} className="quest-form">
          <label className="form-label">
            Title
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Doctor appointment"
              autoFocus
              required
            />
          </label>

          <div className="form-label">
            Date
            <DatePicker value={date} onChange={setDate} />
          </div>

          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={allDay}
              onChange={e => setAllDay(e.target.checked)}
            />
            All day
          </label>

          {!allDay && (
            <>
              <div className="form-label">
                Start
                <TimePicker value={start} onChange={handleStartChange} />
              </div>
              <div className="form-label">
                End
                <TimePicker value={end} onChange={setEnd} />
              </div>
            </>
          )}

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
              {saving ? 'Inscribing...' : 'Inscribe Mission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
