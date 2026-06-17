function last30Days(history) {
  const today = new Date()
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const entry = history.find(h => h.date === dateStr)
    days.push({ date: dateStr, xpTotal: entry?.xpTotal })
  }
  // Carry-forward fill: days with no entry inherit the prior day's running total
  // (XP doesn't decrease — a missing day just means no quests that day).
  let last = 0
  return days.map(d => {
    if (d.xpTotal == null) return { ...d, xpTotal: last }
    last = d.xpTotal
    return d
  })
}

function shortDate(s) {
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function LevelLineChart({ history = [] }) {
  const days = last30Days(history)
  const maxXp = Math.max(...days.map(d => d.xpTotal), 100)

  if (maxXp === 0) {
    return <p className="empty">Your XP journey will be charted here.</p>
  }

  const W = 280, H = 170
  const pad = { top: 14, right: 10, bottom: 26, left: 36 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom

  const xStep = plotW / Math.max(days.length - 1, 1)
  const points = days.map((d, i) => ({
    x: pad.left + i * xStep,
    y: pad.top + (1 - d.xpTotal / maxXp) * plotH,
    xpTotal: d.xpTotal,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const baselineY = pad.top + plotH
  const areaPath = `${linePath} L ${points.at(-1).x.toFixed(1)} ${baselineY} L ${points[0].x.toFixed(1)} ${baselineY} Z`

  const last = points.at(-1)
  const yTicks = [0, Math.round(maxXp / 2), maxXp]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" className="chronicle-svg">
      <defs>
        <linearGradient id="xpAreaGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-light)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--accent-light)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y-axis tick labels and gridlines */}
      {yTicks.map(t => {
        const y = pad.top + (1 - t / maxXp) * plotH
        return (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y} y2={y}
              stroke="var(--border)" strokeWidth={1} opacity={0.4} strokeDasharray="2 3" />
            <text x={pad.left - 5} y={y + 3} fontSize={9}
              fill="var(--text-muted)" textAnchor="end">{t}</text>
          </g>
        )
      })}

      {/* Area fill + line */}
      <path d={areaPath} fill="url(#xpAreaGradient)" />
      <path d={linePath} fill="none" stroke="var(--accent-light)"
        strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* Today's point marker */}
      <circle cx={last.x} cy={last.y} r={4.5} fill="var(--gold)"
        stroke="var(--bg)" strokeWidth={2} />

      {/* X-axis date labels — just start and end */}
      <text x={pad.left} y={H - 8} fontSize={10}
        fill="var(--text-muted)" textAnchor="start">{shortDate(days[0].date)}</text>
      <text x={W - pad.right} y={H - 8} fontSize={10}
        fill="var(--text-muted)" textAnchor="end">{shortDate(days.at(-1).date)}</text>
    </svg>
  )
}
