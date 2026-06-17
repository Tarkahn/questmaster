function last7Days(history) {
  const today = new Date()
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const entry = history.find(h => h.date === dateStr)
    days.push({
      date: dateStr,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3),
      xpEarned: entry?.xpEarned || 0,
      isToday: i === 0,
    })
  }
  return days
}

export default function XPBarChart({ history = [] }) {
  const days = last7Days(history)
  const totalXp = days.reduce((s, d) => s + d.xpEarned, 0)

  if (totalXp === 0) {
    return <p className="empty">No XP earned in the last 7 days.</p>
  }

  const maxXp = Math.max(...days.map(d => d.xpEarned), 1)

  const W = 280, H = 160
  const pad = { top: 18, right: 8, bottom: 26, left: 8 }
  const plotH = H - pad.top - pad.bottom
  const plotW = W - pad.left - pad.right
  const barW = 26
  const gap = (plotW - barW * 7) / 6

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" className="chronicle-svg">
      {days.map((d, i) => {
        const x = pad.left + i * (barW + gap)
        const barH = d.xpEarned > 0 ? Math.max((d.xpEarned / maxXp) * plotH, 3) : 2
        const y = pad.top + (plotH - barH)
        const fill = d.isToday ? 'var(--gold-light)' : 'var(--gold)'
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill={fill}
              opacity={d.xpEarned === 0 ? 0.18 : 1}
              rx={3}
            />
            {d.xpEarned > 0 && (
              <text
                x={x + barW / 2}
                y={y - 5}
                fontSize={10}
                fontWeight={600}
                fill="var(--text)"
                textAnchor="middle"
              >
                {d.xpEarned}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={H - 8}
              fontSize={11}
              fill={d.isToday ? 'var(--gold-light)' : 'var(--text-muted)'}
              fontWeight={d.isToday ? 700 : 400}
              textAnchor="middle"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
