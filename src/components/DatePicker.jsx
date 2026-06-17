import { useState } from 'react'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromDateStr(s) {
  return s ? new Date(`${s}T00:00:00`) : null
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export default function DatePicker({ value, onChange, allowClear = false }) {
  const selected = fromDateStr(value)
  const [view, setView] = useState(() => startOfMonth(selected || new Date()))
  const today = toDateStr(new Date())

  const firstDay = view.getDay()
  const totalDays = daysInMonth(view)
  const totalWeeks = Math.ceil((firstDay + totalDays) / 7)

  const prevMonth = addMonths(view, -1)
  const prevDays = daysInMonth(prevMonth)
  const nextMonth = addMonths(view, 1)

  const cells = []
  for (let i = 0; i < firstDay; i++) {
    cells.push({
      date: new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevDays - firstDay + 1 + i),
      muted: true,
    })
  }
  for (let i = 1; i <= totalDays; i++) {
    cells.push({ date: new Date(view.getFullYear(), view.getMonth(), i), muted: false })
  }
  while (cells.length < totalWeeks * 7) {
    const dayNum = cells.length - firstDay - totalDays + 1
    cells.push({
      date: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), dayNum),
      muted: true,
    })
  }

  return (
    <div className="date-picker">
      <div className="date-picker-header">
        <button
          type="button"
          className="date-picker-nav"
          onClick={() => setView(addMonths(view, -1))}
          aria-label="Previous month"
        >‹</button>
        <span className="date-picker-month">{MONTHS[view.getMonth()]} {view.getFullYear()}</span>
        <button
          type="button"
          className="date-picker-nav"
          onClick={() => setView(addMonths(view, 1))}
          aria-label="Next month"
        >›</button>
      </div>
      <div className="date-picker-weekdays">
        {WEEKDAYS.map((w, i) => <div key={i} className="date-picker-weekday">{w}</div>)}
      </div>
      <div className="date-picker-grid">
        {cells.map((cell, i) => {
          const dateStr = toDateStr(cell.date)
          const isSelected = dateStr === value
          const isToday = dateStr === today
          return (
            <button
              key={i}
              type="button"
              className={[
                'date-picker-day',
                cell.muted && 'date-picker-day--muted',
                isSelected && 'date-picker-day--selected',
                isToday && !isSelected && 'date-picker-day--today',
              ].filter(Boolean).join(' ')}
              onClick={() => onChange(dateStr)}
            >
              {cell.date.getDate()}
            </button>
          )
        })}
      </div>
      {allowClear && value && (
        <button type="button" className="date-picker-clear" onClick={() => onChange('')}>
          Clear date
        </button>
      )}
    </div>
  )
}
