import { useLayoutEffect, useRef } from 'react'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)        // 1..12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)      // 0,5,...,55
const PERIODS = ['AM', 'PM']

const ITEM_H = 28
const VISIBLE = 3

function parse24(hhmm) {
  const [h = 0, m = 0] = (hhmm || '00:00').split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  // Snap minutes to the nearest 5
  const m5 = Math.round(m / 5) * 5 % 60
  return { h12, m: m5, period }
}

function format24(h12, m, period) {
  let h = h12 % 12
  if (period === 'PM') h += 12
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function Wheel({ items, value, onChange, formatter = String }) {
  const ref = useRef(null)
  const settleTimer = useRef(null)

  useLayoutEffect(() => {
    const idx = items.indexOf(value)
    if (idx >= 0 && ref.current) ref.current.scrollTop = idx * ITEM_H
  }, [value, items])

  function onScroll() {
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      if (!ref.current) return
      const idx = Math.round(ref.current.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(items.length - 1, idx))
      if (items[clamped] !== value) onChange(items[clamped])
    }, 120)
  }

  const padCount = Math.floor(VISIBLE / 2)

  return (
    <div
      className="time-wheel"
      ref={ref}
      onScroll={onScroll}
      style={{ height: VISIBLE * ITEM_H }}
    >
      {Array.from({ length: padCount }).map((_, i) => (
        <div key={`pre${i}`} className="time-wheel-spacer" style={{ height: ITEM_H }} />
      ))}
      {items.map(item => (
        <button
          type="button"
          key={item}
          className={`time-wheel-item${item === value ? ' time-wheel-item--selected' : ''}`}
          style={{ height: ITEM_H }}
          onClick={() => {
            if (ref.current) ref.current.scrollTop = items.indexOf(item) * ITEM_H
            onChange(item)
          }}
          tabIndex={-1}
        >
          {formatter(item)}
        </button>
      ))}
      {Array.from({ length: padCount }).map((_, i) => (
        <div key={`post${i}`} className="time-wheel-spacer" style={{ height: ITEM_H }} />
      ))}
    </div>
  )
}

export default function TimePicker({ value, onChange }) {
  const { h12, m, period } = parse24(value)

  function update(next) {
    const merged = { h12, m, period, ...next }
    onChange(format24(merged.h12, merged.m, merged.period))
  }

  return (
    <div className="time-picker">
      <div className="time-picker-selection-bar" aria-hidden="true" />
      <Wheel items={HOURS}   value={h12}    onChange={v => update({ h12: v })} />
      <span className="time-picker-sep">:</span>
      <Wheel items={MINUTES} value={m}      onChange={v => update({ m: v })}
        formatter={v => String(v).padStart(2, '0')} />
      <Wheel items={PERIODS} value={period} onChange={v => update({ period: v })} />
    </div>
  )
}
