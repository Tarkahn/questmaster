import { useState } from 'react'
import DatePicker from './DatePicker'
import TimePicker from './TimePicker'
import { REMINDER_OPTIONS } from '../utils/api'
import { buildRRule, monthlyWeekdayInfo, weekdayName, monthDayLabel } from '../utils/rrule'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_FULL   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function todayStr() {
  return new Date().toLocaleDateString('en-CA')
}

// Default "ends on" date: three months after the mission's start date.
function defaultUntil(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m + 2, d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
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

export default function CreateMissionModal({ onClose, onCreate, defaultReminderMinutes = 30 }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayStr())
  const [start, setStart] = useState(defaultStart())
  const [end, setEnd] = useState(addHour(defaultStart()))
  const [allDay, setAllDay] = useState(false)
  const [reminderMinutes, setReminderMinutes] = useState(defaultReminderMinutes)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Recurrence — mirrors Google Calendar's repeat options. The quick options'
  // labels are derived from the currently selected date; "Custom…" opens
  // interval / weekday / monthly-mode controls. An "Ends" section (never /
  // on a date / after N times) shows for any repeating mission.
  const [repeat, setRepeat] = useState('none')
  const [customInterval, setCustomInterval] = useState(1)
  const [customUnit, setCustomUnit] = useState('week')
  const [customDays, setCustomDays] = useState(() => [new Date(`${todayStr()}T00:00:00`).getDay()])
  const [customMonthlyMode, setCustomMonthlyMode] = useState('date')
  const [endMode, setEndMode] = useState('never')
  const [untilDate, setUntilDate] = useState(() => defaultUntil(todayStr()))
  const [count, setCount] = useState(10)

  function toggleCustomDay(d) {
    setCustomDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  // The "last <weekday>" options only exist while the chosen date IS the last
  // such weekday of its month — moving the date would otherwise leave the
  // select bound to an option that no longer renders.
  function handleDateChange(v) {
    setDate(v)
    if (!monthlyWeekdayInfo(v).isLast) {
      if (repeat === 'monthlyLastWeekday') setRepeat('monthlyWeekday')
      if (customMonthlyMode === 'lastWeekday') setCustomMonthlyMode('weekday')
    }
  }

  // Builds the event's `recurrence` field from the current form state, or
  // undefined for a one-off mission.
  function buildRecurrence() {
    if (repeat === 'none') return undefined
    const info = monthlyWeekdayInfo(date)
    const dayOfMonth = Number(date.split('-')[2])
    const common = {
      endMode,
      untilDate,
      count: Math.max(1, Number(count) || 1),
      allDay,
    }
    switch (repeat) {
      case 'daily':
        return [buildRRule({ freq: 'DAILY', ...common })]
      case 'weekly':
        return [buildRRule({ freq: 'WEEKLY', byDays: [info.weekday], ...common })]
      case 'weekdays':
        return [buildRRule({ freq: 'WEEKLY', byDays: [1, 2, 3, 4, 5], ...common })]
      case 'monthlyDate':
        return [buildRRule({ freq: 'MONTHLY', monthDay: dayOfMonth, ...common })]
      case 'monthlyWeekday':
        return [buildRRule({ freq: 'MONTHLY', monthlyByDay: { nth: info.nth, weekday: info.weekday }, ...common })]
      case 'monthlyLastWeekday':
        return [buildRRule({ freq: 'MONTHLY', monthlyByDay: { nth: -1, weekday: info.weekday }, ...common })]
      case 'yearly':
        return [buildRRule({ freq: 'YEARLY', ...common })]
      case 'custom': {
        const freq = { day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' }[customUnit]
        return [buildRRule({
          freq,
          interval: Math.max(1, Number(customInterval) || 1),
          byDays: customUnit === 'week' ? (customDays.length > 0 ? customDays : [info.weekday]) : [],
          monthDay: customUnit === 'month' && customMonthlyMode === 'date' ? dayOfMonth : null,
          monthlyByDay: customUnit === 'month' && customMonthlyMode !== 'date'
            ? { nth: customMonthlyMode === 'lastWeekday' ? -1 : info.nth, weekday: info.weekday }
            : null,
          ...common,
        })]
      }
      default:
        return undefined
    }
  }

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
    if (repeat !== 'none' && endMode === 'until' && untilDate < date) {
      setError('The last repeat date must be on or after the start date.')
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
        reminderMinutes: allDay ? undefined : reminderMinutes,
        notes: notes.trim() || undefined,
        recurrence: buildRecurrence(),
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
            <DatePicker value={date} onChange={handleDateChange} />
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
              <label className="form-label">
                🔔 Reminder
                <select
                  className="form-input"
                  value={reminderMinutes}
                  onChange={e => setReminderMinutes(Number(e.target.value))}
                >
                  {REMINDER_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="form-label">
            🔁 Repeat
            <select
              className="form-input"
              value={repeat}
              onChange={e => setRepeat(e.target.value)}
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly on {weekdayName(date)}</option>
              <option value="monthlyDate">Monthly on day {Number(date.split('-')[2])}</option>
              <option value="monthlyWeekday">
                Monthly on the {monthlyWeekdayInfo(date).nthName} {weekdayName(date)}
              </option>
              {monthlyWeekdayInfo(date).isLast && (
                <option value="monthlyLastWeekday">Monthly on the last {weekdayName(date)}</option>
              )}
              <option value="yearly">Annually on {monthDayLabel(date)}</option>
              <option value="weekdays">Every weekday (Mon–Fri)</option>
              <option value="custom">Custom…</option>
            </select>
          </label>

          {repeat === 'custom' && (
            <>
              <div className="form-label">
                Repeat every
                <div className="recur-inline">
                  <input
                    type="number"
                    className="form-input recur-num"
                    min={1}
                    max={99}
                    value={customInterval}
                    onChange={e => setCustomInterval(e.target.value)}
                  />
                  <select
                    className="form-input"
                    value={customUnit}
                    onChange={e => setCustomUnit(e.target.value)}
                  >
                    <option value="day">day{Number(customInterval) > 1 ? 's' : ''}</option>
                    <option value="week">week{Number(customInterval) > 1 ? 's' : ''}</option>
                    <option value="month">month{Number(customInterval) > 1 ? 's' : ''}</option>
                    <option value="year">year{Number(customInterval) > 1 ? 's' : ''}</option>
                  </select>
                </div>
              </div>

              {customUnit === 'week' && (
                <div className="form-label">
                  Repeat on
                  <div className="recurring-days">
                    {DAY_LABELS.map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`recurring-day-btn${customDays.includes(i) ? ' recurring-day-btn--on' : ''}`}
                        onClick={() => toggleCustomDay(i)}
                        aria-label={DAY_FULL[i]}
                        aria-pressed={customDays.includes(i)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {customUnit === 'month' && (
                <label className="form-label">
                  Repeat by
                  <select
                    className="form-input"
                    value={customMonthlyMode}
                    onChange={e => setCustomMonthlyMode(e.target.value)}
                  >
                    <option value="date">On day {Number(date.split('-')[2])}</option>
                    <option value="weekday">
                      On the {monthlyWeekdayInfo(date).nthName} {weekdayName(date)}
                    </option>
                    {monthlyWeekdayInfo(date).isLast && (
                      <option value="lastWeekday">On the last {weekdayName(date)}</option>
                    )}
                  </select>
                </label>
              )}
            </>
          )}

          {repeat !== 'none' && (
            <div className="form-label">
              Ends
              <div className="recur-ends">
                <label className="form-checkbox">
                  <input
                    type="radio"
                    name="recur-end"
                    checked={endMode === 'never'}
                    onChange={() => setEndMode('never')}
                  />
                  Never
                </label>
                <label className="form-checkbox">
                  <input
                    type="radio"
                    name="recur-end"
                    checked={endMode === 'until'}
                    onChange={() => setEndMode('until')}
                  />
                  On
                </label>
                {endMode === 'until' && (
                  <div className="recur-ends-detail">
                    <DatePicker value={untilDate} onChange={setUntilDate} />
                  </div>
                )}
                <label className="form-checkbox">
                  <input
                    type="radio"
                    name="recur-end"
                    checked={endMode === 'count'}
                    onChange={() => setEndMode('count')}
                  />
                  After
                  {endMode === 'count' && (
                    <>
                      <input
                        type="number"
                        className="form-input recur-num"
                        min={1}
                        max={999}
                        value={count}
                        onChange={e => setCount(e.target.value)}
                        onClick={e => e.preventDefault()}
                      />
                      occurrences
                    </>
                  )}
                </label>
              </div>
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
