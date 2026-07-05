const BASE = 'https://www.googleapis.com'

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

// Reminder lead time is encoded as an optional suffix on the same tag rather
// than a second independent prefix — two separately-anchored `^[...]` regexes
// can't both match at position 0, so stacking tags would break parsing.
const QM_TIME_RE = /^\[qm-time:(\d{2}:\d{2})(?:\|remind:(\d+))?\]\n?/

export function parseQuestTime(notes) {
  const m = (notes || '').match(QM_TIME_RE)
  return m ? m[1] : null
}

export function parseQuestReminder(notes) {
  const m = (notes || '').match(QM_TIME_RE)
  return m && m[2] !== undefined ? parseInt(m[2], 10) : null
}

export function encodeQuestTime(dueTime, notes, reminderMinutes) {
  const cleaned = (notes || '').replace(QM_TIME_RE, '')
  if (!dueTime) return cleaned
  const remindPart = (reminderMinutes || reminderMinutes === 0) ? `|remind:${reminderMinutes}` : ''
  return `[qm-time:${dueTime}${remindPart}]\n${cleaned}`.trimEnd()
}

// Checklist tag — a user-only checkoff list (e.g. grocery items) embedded in
// a quest's notes, same trick as qm-time. It's deliberately separate from the
// user's own notes text and is never sent to the LLM (see stripAuxTags) —
// this is for the user's own tracking, not quest-title theming material.
// Unanchored (unlike QM_TIME_RE) since it isn't always the first tag: it sits
// right after qm-time when both are present.
const QM_CHECKLIST_RE = /\[qm-checklist:([A-Za-z0-9+/=]*)\]\n?/

export function parseChecklist(notes) {
  const m = (notes || '').match(QM_CHECKLIST_RE)
  if (!m || !m[1]) return []
  try {
    return JSON.parse(decodeURIComponent(escape(atob(m[1]))))
  } catch { return [] }
}

// Composes notes with the checklist tag in the correct position (right after
// qm-time, if present) regardless of whether qm-time has already been added —
// safe to call before OR after encodeQuestTime wraps its own tag around it.
export function encodeChecklist(notes, items) {
  const timeMatch = (notes || '').match(QM_TIME_RE)
  const timePrefix = timeMatch ? timeMatch[0] : ''
  const rest = (notes || '').slice(timePrefix.length).replace(QM_CHECKLIST_RE, '')
  if (!items || items.length === 0) return (timePrefix + rest).trimEnd()
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(items))))
  return `${timePrefix}[qm-checklist:${encoded}]\n${rest}`.trimEnd()
}

// Strips every QuestMaster metadata tag from notes, leaving only what the
// user actually typed — used for the Notes textarea and the "send notes to
// the LLM" path so neither ever sees qm-time/qm-checklist bookkeeping.
export function stripAuxTags(notes) {
  return (notes || '').replace(QM_TIME_RE, '').replace(QM_CHECKLIST_RE, '')
}

// Shared presets for the reminder-lead-time selector in every quest/mission
// create & edit modal, and the Settings default.
export const REMINDER_OPTIONS = [
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
]

export function formatQuestTime(hhmm) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

// A task's `due` is always encoded as that calendar date at UTC midnight
// (createTask/updateTask append T00:00:00Z) so Google's own Tasks UI can't
// misread it. Decoding it via `new Date(due).toLocaleDateString()` re-applies
// the LOCAL timezone on top of that UTC instant — in any negative-UTC-offset
// timezone that rolls the date back a day. Slicing the ISO string reads the
// calendar date directly, with no timezone math to get wrong.
export function dueDateOnly(due) {
  return due ? due.slice(0, 10) : null
}

// Builds a LOCAL-midnight Date from a Y/M/D-encoded date string — either a
// Google Tasks `due` UTC-midnight ISO string, or a bare YYYY-MM-DD string
// (e.g. the en-CA-formatted "seen" dates in qm_task_seen). Use this instead of
// `new Date(dateStr).setHours(0,0,0,0)` for day-math (urgency, sort order):
// that pattern re-applies the local timezone on top of an already-UTC
// instant, rolling the date back a day in any negative-UTC-offset zone.
export function localMidnight(dateStr) {
  const iso = dueDateOnly(dateStr)
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Formats `due` for display (e.g. "Jul 3") using the same timezone-safe
// extraction — builds a LOCAL midnight Date from the extracted Y/M/D digits
// so toLocaleDateString has nothing left to shift.
export function formatDueDate(due) {
  const iso = dueDateOnly(due)
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// 30 minutes, not a full hour — this block only exists to trigger a Google
// Calendar reminder notification, so keeping it short means it takes up less
// visual space on the actual calendar grid.
export function buildCompanionEvent(title, due, dueTime, reminderMinutes) {
  const [h, m] = dueTime.split(':').map(Number)
  const totalMinutes = h * 60 + m + 30
  const endTime = `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
  return { title, date: due, start: dueTime, end: endTime, allDay: false, isCompanion: true, reminderMinutes }
}

export async function fetchTodaysTasks(token) {
  const res = await fetch(
    `${BASE}/tasks/v1/lists/@default/tasks?showCompleted=false&showHidden=false&maxResults=100`,
    { headers: authHeaders(token) }
  )
  if (!res.ok) throw new Error('Failed to fetch tasks')
  const data = await res.json()
  const items = data.items || []

  const tasks = items.filter(t => !t.parent)
  const subtasksByParent = {}
  for (const t of items) {
    if (t.parent) {
      (subtasksByParent[t.parent] || (subtasksByParent[t.parent] = [])).push(t)
    }
  }
  // Order subtasks by Google's position field so they keep their list order.
  for (const k of Object.keys(subtasksByParent)) {
    subtasksByParent[k].sort((a, b) => (a.position || '').localeCompare(b.position || ''))
  }

  return { tasks, subtasksByParent }
}

// Creates a subtask nested under parentId. Google Tasks links a subtask via the
// `parent` query param on insert (the body cannot set `parent` directly).
export async function createSubtask(token, parentId, { title, due, dueTime, notes }) {
  const body = { title }
  if (due) body.due = new Date(`${due}T00:00:00Z`).toISOString()
  const encodedNotes = encodeQuestTime(dueTime || null, notes || '')
  if (encodedNotes) body.notes = encodedNotes

  const res = await fetch(
    `${BASE}/tasks/v1/lists/@default/tasks?parent=${encodeURIComponent(parentId)}`,
    {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) throw new Error(`Failed to create subtask: ${res.status}`)
  return res.json()
}

// Moves a subtask to a new position under its parent.
// previousId: the sibling that should be immediately before it, or null for first position.
export async function moveSubtask(token, taskId, { parentId, previousId }) {
  let url = `${BASE}/tasks/v1/lists/@default/tasks/${encodeURIComponent(taskId)}/move?parent=${encodeURIComponent(parentId)}`
  if (previousId) url += `&previous=${encodeURIComponent(previousId)}`
  const res = await fetch(url, { method: 'POST', headers: authHeaders(token) })
  if (!res.ok) throw new Error(`Failed to move subtask: ${res.status}`)
  return res.json()
}

export async function markTaskComplete(token, taskId) {
  const res = await fetch(
    `${BASE}/tasks/v1/lists/@default/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completed: new Date().toISOString() }),
    }
  )
  if (!res.ok) throw new Error('Failed to complete task')
  return res.json()
}

export async function markTaskIncomplete(token, taskId) {
  const res = await fetch(
    `${BASE}/tasks/v1/lists/@default/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'needsAction', completed: null }),
    }
  )
  if (!res.ok) throw new Error('Failed to reopen task')
  return res.json()
}

// title: string, due?: 'YYYY-MM-DD', dueTime?: 'HH:MM', notes?: string, reminderMinutes?: number
export async function createTask(token, { title, due, dueTime, notes, reminderMinutes }) {
  const body = { title }
  if (due) body.due = new Date(`${due}T00:00:00Z`).toISOString()
  const encodedNotes = encodeQuestTime(dueTime || null, notes || '', reminderMinutes)
  if (encodedNotes) body.notes = encodedNotes

  const res = await fetch(
    `${BASE}/tasks/v1/lists/@default/tasks`,
    {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) throw new Error(`Failed to create task: ${res.status}`)
  return res.json()
}

// allDay: { title, date: 'YYYY-MM-DD', allDay: true, notes? }
// timed:  { title, date: 'YYYY-MM-DD', start: 'HH:MM', end: 'HH:MM', notes? }
// reminderMinutes: number (custom lead time, in minutes — 0 means "at the
// event's start time") | 'default' (explicitly defer to the calendar's own
// default reminder rule) | undefined (don't touch reminders at all).
function buildRemindersField(reminderMinutes) {
  if (reminderMinutes === 'default') return { useDefault: true }
  if (reminderMinutes === undefined || reminderMinutes === null) return undefined
  return { useDefault: false, overrides: [{ method: 'popup', minutes: reminderMinutes }] }
}

export async function createEvent(token, { title, date, start, end, allDay, notes, isCompanion, reminderMinutes }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const body = { summary: title }
  if (notes) body.description = notes
  if (isCompanion) body.extendedProperties = { private: { qm_companion: 'true' } }
  const reminders = buildRemindersField(reminderMinutes)
  if (reminders) body.reminders = reminders

  if (allDay) {
    // Calendar all-day end is exclusive — bump by one day.
    const endDate = new Date(`${date}T00:00:00`)
    endDate.setDate(endDate.getDate() + 1)
    body.start = { date }
    body.end = { date: endDate.toISOString().slice(0, 10) }
  } else {
    body.start = { dateTime: `${date}T${start}:00`, timeZone }
    body.end   = { dateTime: `${date}T${end}:00`,   timeZone }
  }

  const res = await fetch(
    `${BASE}/calendar/v3/calendars/primary/events`,
    {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) throw new Error(`Failed to create event: ${res.status}`)
  return res.json()
}

export async function deleteTask(token, taskId) {
  const res = await fetch(
    `${BASE}/tasks/v1/lists/@default/tasks/${taskId}`,
    { method: 'DELETE', headers: authHeaders(token) }
  )
  if (!res.ok) throw new Error(`Failed to delete task: ${res.status}`)
}

// checklist: pass the task's CURRENT checklist (e.g. parseChecklist(task.notes))
// when this save didn't come from the checklist popup — this rebuilds notes
// from scratch, so omitting it would silently wipe an existing checklist.
export async function updateTask(token, taskId, { title, due, dueTime, notes, reminderMinutes, checklist }) {
  const body = { title }
  body.due = due ? new Date(`${due}T00:00:00Z`).toISOString() : null
  body.notes = encodeQuestTime(dueTime || null, encodeChecklist(notes || '', checklist), reminderMinutes)

  const res = await fetch(
    `${BASE}/tasks/v1/lists/@default/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) throw new Error(`Failed to update task: ${res.status}`)
  return res.json()
}

// Narrow PATCH that only ever touches the checklist tag inside notes — used
// by the checklist popup so a checkbox toggle can never clobber the title,
// due date, or reminder (unlike updateTask, which rebuilds the whole task).
export async function updateTaskChecklist(token, taskId, currentNotes, items) {
  const notes = encodeChecklist(currentNotes || '', items)
  const res = await fetch(
    `${BASE}/tasks/v1/lists/@default/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    }
  )
  if (!res.ok) throw new Error(`Failed to update checklist: ${res.status}`)
  return res.json()
}

export async function deleteEvent(token, eventId) {
  const res = await fetch(
    `${BASE}/calendar/v3/calendars/primary/events/${eventId}`,
    { method: 'DELETE', headers: authHeaders(token) }
  )
  if (!res.ok) throw new Error(`Failed to delete event: ${res.status}`)
}

export async function updateEvent(token, eventId, { title, date, start, end, allDay, notes, reminderMinutes }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const body = { summary: title, description: notes || '' }
  const reminders = buildRemindersField(reminderMinutes)
  if (reminders) body.reminders = reminders

  if (allDay) {
    const endDate = new Date(`${date}T00:00:00`)
    endDate.setDate(endDate.getDate() + 1)
    body.start = { date }
    body.end = { date: endDate.toISOString().slice(0, 10) }
  } else {
    body.start = { dateTime: `${date}T${start}:00`, timeZone }
    body.end   = { dateTime: `${date}T${end}:00`,   timeZone }
  }

  const res = await fetch(
    `${BASE}/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) throw new Error(`Failed to update event: ${res.status}`)
  return res.json()
}

// daysAhead: 0 = today only, 3 = today + next 3 days, etc.
export async function fetchUpcomingEvents(token, daysAhead = 0) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  end.setDate(end.getDate() + Math.max(0, daysAhead))

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: daysAhead >= 14 ? '100' : '50',
  })

  const res = await fetch(
    `${BASE}/calendar/v3/calendars/primary/events?${params}`,
    { headers: authHeaders(token) }
  )
  if (!res.ok) throw new Error('Failed to fetch calendar events')
  const data = await res.json()
  // Filter out companion events — calendar blocks created alongside quests that
  // have a specific time. They exist for reminder purposes only; claiming them
  // here would award double XP for the same quest.
  const seen = new Set()
  return (data.items || []).filter(e => {
    if (e.extendedProperties?.private?.qm_companion === 'true') return false
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}
