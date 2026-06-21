import { useState } from 'react'

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

export default function CreateRecurringQuestModal({ onCreate, onClose }) {
  const [title, setTitle]   = useState('')
  const [notes, setNotes]   = useState('')
  const [days, setDays]     = useState([1,2,3,4,5]) // default weekdays
  const [preset, setPreset] = useState('Weekdays')

  function applyPreset(p) {
    setPreset(p.label)
    if (p.days) setDays(p.days)
  }

  function toggleDay(d) {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d]
    setDays(next)
    setPreset(matchPreset(next))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || days.length === 0) return
    onCreate({ title: title.trim(), notes: notes.trim(), days: [...days].sort((a,b) => a-b) })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">🔄 New Recurring Quest</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="modal-label">Quest title</label>
          <input
            className="modal-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Take morning medicine"
            autoFocus
            maxLength={200}
          />

          <label className="modal-label">Notes (optional)</label>
          <input
            className="modal-input"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any extra detail…"
            maxLength={500}
          />

          <label className="modal-label">Repeats</label>
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

          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="modal-btn modal-btn--create"
              disabled={!title.trim() || days.length === 0}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
