// RFC 5545 RRULE construction for recurring missions. Missions are Google
// Calendar events, so recurrence rides on the event's `recurrence` field and
// Google does all the instance expansion server-side (fetchUpcomingEvents
// already requests singleEvents=true).

export const BYDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth']

// Parses 'YYYY-MM-DD' to a local-midnight Date without timezone surprises.
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// For a 'YYYY-MM-DD' date: which weekday it is, which occurrence of that
// weekday within its month (1-based), and whether it's the last one.
// Drives the "Monthly on the third Thursday" / "…last Thursday" options.
export function monthlyWeekdayInfo(dateStr) {
  const d = parseLocalDate(dateStr)
  const nth = Math.ceil(d.getDate() / 7)
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const isLast = d.getDate() + 7 > daysInMonth
  return {
    weekday: d.getDay(),
    weekdayName: WEEKDAY_NAMES[d.getDay()],
    nth,
    nthName: ORDINALS[nth - 1] || `${nth}th`,
    isLast,
  }
}

export function weekdayName(dateStr) {
  return WEEKDAY_NAMES[parseLocalDate(dateStr).getDay()]
}

export function weekdayIndex(dateStr) {
  return parseLocalDate(dateStr).getDay()
}

export function monthDayLabel(dateStr) {
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

// UNTIL must match DTSTART's value type (RFC 5545): a bare DATE for all-day
// events, a UTC datetime for timed ones. The timed form uses the LOCAL end of
// the chosen day converted to UTC so the final day's occurrence is included.
function formatUntil(untilDate, allDay) {
  if (allDay) return untilDate.replaceAll('-', '')
  const [y, m, d] = untilDate.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

// Builds the RRULE string for an event.
//   freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
//   interval: every N freq-units (omitted from the rule when 1)
//   byDays: weekday numbers 0(Sun)–6(Sat) — WEEKLY only
//   monthlyByDay: { nth, weekday } | null — MONTHLY "nth weekday" mode
//                 (nth may be -1 for "last <weekday>"); when null, MONTHLY
//                 uses monthDay (day-of-month)
//   monthDay: 1–31 — MONTHLY day-of-month mode
//   endMode: 'never' | 'until' | 'count'
//   untilDate: 'YYYY-MM-DD' (endMode 'until')
//   count: number of occurrences (endMode 'count')
//   allDay: affects UNTIL encoding only
export function buildRRule({ freq, interval = 1, byDays = [], monthlyByDay = null, monthDay = null, endMode = 'never', untilDate = null, count = null, allDay = false }) {
  const parts = [`FREQ=${freq}`]
  if (interval > 1) parts.push(`INTERVAL=${interval}`)

  if (freq === 'WEEKLY' && byDays.length > 0) {
    const codes = [...byDays].sort((a, b) => a - b).map(d => BYDAY_CODES[d])
    parts.push(`BYDAY=${codes.join(',')}`)
  }
  if (freq === 'MONTHLY') {
    if (monthlyByDay) parts.push(`BYDAY=${monthlyByDay.nth}${BYDAY_CODES[monthlyByDay.weekday]}`)
    else if (monthDay) parts.push(`BYMONTHDAY=${monthDay}`)
  }

  if (endMode === 'until' && untilDate) parts.push(`UNTIL=${formatUntil(untilDate, allDay)}`)
  else if (endMode === 'count' && count > 0) parts.push(`COUNT=${count}`)

  return `RRULE:${parts.join(';')}`
}
