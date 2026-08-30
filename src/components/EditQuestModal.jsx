import { useState } from 'react'
import DatePicker from './DatePicker'
import TimePicker from './TimePicker'
import { parseQuestTime, parseQuestReminder, REMINDER_OPTIONS, stripAuxTags, dueDateOnly } from '../utils/api'

function parseDueDate(due) {
  return dueDateOnly(due) || ''
}

// `recurringDef` is the recurring definition that materialized this quest, or
// null for a one-off. Google Tasks has no native recurrence, so a repeating
// quest is a fresh task generated each due day from a def held in Drive —
// which is why deleting the task alone leaves the def to generate another one
// tomorrow, and why the delete offers a this-one/all-repeats choice the way
// Google's own recurring items do.
export default function EditQuestModal({ task, onClose, onSave, onDelete, defaultReminderMinutes = 30, recurringDef = null }) {
  const isRecurring = Boolean(recurringDef)
  const [title, setTitle] = useState(task.title || '')
  const [due, setDue] = useState(parseDueDate(task.due))
  const existingTime = parseQuestTime(task.notes)
  const [dueTime, setDueTime] = useState(existingTime || '09:00')
  const [showTime, setShowTime] = useState(Boolean(existingTime))
  const [reminderMinutes, setReminderMinutes] = useState(parseQuestReminder(task.notes) ?? defaultReminderMinutes)
  const [notes, setNotes] = useState(stripAuxTags(task.notes))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave(task.id, {
        title: title.trim(),
        due: due || undefined,
        dueTime: (due && showTime) ? dueTime : undefined,
        reminderMinutes: (due && showTime) ? reminderMinutes : undefined,
        notes: notes.trim() || undefined,
      })
    } catch (err) {
      setError(err.message || 'Could not save quest.')
      setSaving(false)
    }
  }

  async function handleDelete(scope) {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await onDelete(task.id, { series: scope === 'series' })
    } catch (err) {
      setError(err.message || 'Could not delete quest.')
      setDeleting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">✏️ Edit Quest</h2>
        {isRecurring && (
          <p className="modal-subtitle">🔁 Repeating quest — edits apply only to today's copy.</p>
        )}

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
            Due date <span className="form-optional">(optional)</span>
            <DatePicker value={due} onChange={val => { setDue(val); if (!val) setShowTime(false) }} allowClear />
          </div>

          {due && (
            <div className="form-label">
              <label className="quest-time-toggle">
                <input
                  type="checkbox"
                  checked={showTime}
                  onChange={e => setShowTime(e.target.checked)}
                />
                <span>⏰ Set a time <span className="form-optional">(adds Google Calendar reminder)</span></span>
              </label>
              {showTime && (
                <div className="quest-time-picker">
                  <TimePicker value={dueTime} onChange={setDueTime} />
                  <select
                    className="form-input quest-reminder-select"
                    value={reminderMinutes}
                    onChange={e => setReminderMinutes(Number(e.target.value))}
                  >
                    {REMINDER_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>🔔 {o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
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
            {isRecurring && confirmDelete && !deleting ? (
              <div className="recur-delete-choice">
                <button
                  type="button"
                  className="modal-btn modal-btn--delete modal-btn--confirm"
                  onClick={() => handleDelete('single')}
                  disabled={saving}
                >
                  This one
                </button>
                <button
                  type="button"
                  className="modal-btn modal-btn--delete modal-btn--confirm"
                  onClick={() => handleDelete('series')}
                  disabled={saving}
                >
                  All repeats
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`modal-btn modal-btn--delete${confirmDelete ? ' modal-btn--confirm' : ''}`}
                onClick={() => handleDelete('single')}
                disabled={saving || deleting}
              >
                {deleting ? 'Deleting…' : confirmDelete ? 'Confirm?' : '🗑 Delete'}
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose} disabled={saving || deleting}>
                Cancel
              </button>
              <button type="submit" className="modal-btn modal-btn--create" disabled={!title.trim() || saving || deleting}>
                {saving ? 'Saving…' : 'Save Quest'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
