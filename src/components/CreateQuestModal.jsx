import { useState } from 'react'
import DatePicker from './DatePicker'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_FULL   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const PRESETS = [
  { label: 'Daily',    days: [0,1,2,3,4,5,6] },
  { label: 'Weekdays', days: [1,2,3,4,5] },
  { label: 'Weekends', days: [0,6] },
  { label: 'Custom',   days: null },
]

function matchPreset(days) {
  const key = [...days].sort((a,b) => a-b).join()
  if (key === '0,1,2,3,4,5,6') return 'Daily'
  if (key === '1,2,3,4,5')     return 'Weekdays'
  if (key === '0,6')           return 'Weekends'
  return 'Custom'
}

export default function CreateQuestModal({ onClose, onCreate, onCreateRecurring }) {
  const [title, setTitle]       = useState('')
  const [due, setDue]           = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [repeats, setRepeats]   = useState(false)
  const [days, setDays]         = useState([1,2,3,4,5])
  const [preset, setPreset]     = useState('Weekdays')

  function applyPreset(p) {
    setPreset(p.label)
    if (p.days) setDays(p.days)
  }

  function toggleDay(d) {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d]
    setDays(next)
    setPreset(matchPreset(next))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || saving) return
    if (repeats && days.length === 0) return
    setSaving(true)
    setError(null)
    try {
      if (repeats) {
        await onCreateRecurring({
          title: title.trim(),
          notes: notes.trim() || undefined,
          days: [...days].sort((a,b) => a-b),
        })
      } else {
        await onCreate({ title: title.trim(), due: due || undefined, notes: notes.trim() || undefined })
      }
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

          {!repeats && (
            <div className="form-label">
              Due date <span className="form-optional">(optional)</span>
              <DatePicker value={due} onChange={setDue} allowClear />
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

          <label className="recurring-toggle-row">
            <input
              type="checkbox"
              className="recurring-toggle-check"
              checked={repeats}
              onChange={e => setRepeats(e.target.checked)}
            />
            <span className="recurring-toggle-label">🔄 Repeating quest</span>
          </label>

          {repeats && (
            <div className="recurring-picker">
              <div className="recurring-presets">
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    className={`recurring-preset-btn${preset === p.label ? ' recurring-preset-btn--active' : ''}`}
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="recurring-days">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`recurring-day-btn${days.includes(i) ? ' recurring-day-btn--on' : ''}`}
                    onClick={() => toggleDay(i)}
                    aria-label={DAY_FULL[i]}
                    aria-pressed={days.includes(i)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {days.length === 0 && (
                <p className="recurring-day-warn">Select at least one day.</p>
              )}
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="modal-btn modal-btn--create"
              disabled={!title.trim() || saving || (repeats && days.length === 0)}
            >
              {saving ? 'Summoning...' : repeats ? 'Create Recurring' : 'Summon Quest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
