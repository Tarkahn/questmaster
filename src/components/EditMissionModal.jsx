import { useState } from 'react'
import DatePicker from './DatePicker'
import TimePicker from './TimePicker'

function addHour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h + 1, m, 0, 0)
  return d.toTimeString().slice(0, 5)
}

function localDate(dt) {
  const d = new Date(dt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localTime(dt) {
  const d = new Date(dt)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function EditMissionModal({ event, onClose, onSave, onDelete }) {
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime)

  const [title, setTitle] = useState(event.summary || '')
  const [date, setDate] = useState(
    isAllDay ? event.start.date : localDate(event.start?.dateTime)
  )
  const [start, setStart] = useState(isAllDay ? '09:00' : localTime(event.start?.dateTime))
  const [end, setEnd] = useState(isAllDay ? '10:00' : localTime(event.end?.dateTime))
  const [allDay, setAllDay] = useState(isAllDay)
  const [notes, setNotes] = useState(event.description || '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  function handleStartChange(v) {
    setStart(v)
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
      await onSave(event.id, {
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

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await onDelete(event.id)
    } catch (err) {
      setError(err.message || 'Could not delete mission.')
      setDeleting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">✏️ Edit Mission</h2>

        <form onSubmit={handleSubmit} className="quest-form">
          <label className="form-label">
            Title
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
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
            <button
              type="button"
              className={`modal-btn modal-btn--delete${confirmDelete ? ' modal-btn--confirm' : ''}`}
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? 'Deleting…' : confirmDelete ? 'Confirm?' : '🗑 Delete'}
            </button>
            <div className="modal-actions-right">
              <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose} disabled={saving || deleting}>
                Cancel
              </button>
              <button type="submit" className="modal-btn modal-btn--create" disabled={!title.trim() || saving || deleting}>
                {saving ? 'Saving…' : 'Save Mission'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
