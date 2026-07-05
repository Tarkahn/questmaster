function last30Days(recurring) {
  const today = new Date()
  const missByDate = {}
  recurring.forEach(def => {
    ;(def.missedHistory || []).forEach(m => {
      missByDate[m.date] = (missByDate[m.date] || 0) + 1
    })
  })

  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toLocaleDateString('en-CA')
    days.push({
      date: dateStr,
      label: d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      shortLabel: i % 5 === 0 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      count: missByDate[dateStr] || 0,
      isToday: i === 0,
    })
  }
  return days
}

export default function MissedQuestsChart({ recurring = [] }) {
  const days = last30Days(recurring)
  const totalMisses = days.reduce((s, d) => s + d.count, 0)

  if (totalMisses === 0) {
    return <p className="empty">No missed recurring quests in the last 30 days.</p>
  }

  const maxCount = Math.max(...days.map(d => d.count), 1)

  const W = 320, H = 140
  const pad = { top: 18, right: 4, bottom: 30, left: 4 }
  const plotH = H - pad.top - pad.bottom
  const plotW = W - pad.left - pad.right
  const n = days.length
  const barW = Math.floor((plotW - (n - 1) * 2) / n)
  const gap = 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" className="chronicle-svg">
      {days.map((d, i) => {
        const x = pad.left + i * (barW + gap)
        const barH = d.count > 0 ? Math.max((d.count / maxCount) * plotH, 4) : 2
        const y = pad.top + (plotH - barH)
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill={d.count > 0 ? 'var(--fire)' : 'var(--text-muted)'}
              opacity={d.count === 0 ? 0.12 : d.isToday ? 1 : 0.8}
              rx={2}
            />
            {d.count > 0 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                fontSize={9}
                fontWeight={600}
                fill="var(--text)"
                textAnchor="middle"
              >
                {d.count}
              </text>
            )}
            {d.shortLabel && (
              <text
                x={x + barW / 2}
                y={H - 8}
                fontSize={9}
                fill={d.isToday ? 'var(--accent-light)' : 'var(--text-muted)'}
                fontWeight={d.isToday ? 700 : 400}
                textAnchor="middle"
              >
                {d.shortLabel}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
