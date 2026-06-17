const BASE = 'https://www.googleapis.com'

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

export async function fetchTodaysTasks(token) {
  const res = await fetch(
    `${BASE}/tasks/v1/lists/@default/tasks?showCompleted=false&showHidden=false&maxResults=100`,
    { headers: authHeaders(token) }
  )
  if (!res.ok) throw new Error('Failed to fetch tasks')
  const data = await res.json()
  return (data.items || []).filter(t => !t.parent)
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

// title: string, due?: 'YYYY-MM-DD', notes?: string
export async function createTask(token, { title, due, notes }) {
  const body = { title }
  if (due) body.due = new Date(`${due}T00:00:00Z`).toISOString()
  if (notes) body.notes = notes

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
export async function createEvent(token, { title, date, start, end, allDay, notes }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const body = { summary: title }
  if (notes) body.description = notes

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

export async function updateTask(token, taskId, { title, due, notes }) {
  const body = { title }
  body.due = due ? new Date(`${due}T00:00:00Z`).toISOString() : null
  body.notes = notes || ''

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

export async function deleteEvent(token, eventId) {
  const res = await fetch(
    `${BASE}/calendar/v3/calendars/primary/events/${eventId}`,
    { method: 'DELETE', headers: authHeaders(token) }
  )
  if (!res.ok) throw new Error(`Failed to delete event: ${res.status}`)
}

export async function updateEvent(token, eventId, { title, date, start, end, allDay, notes }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const body = { summary: title, description: notes || '' }

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

export async function fetchTodaysEvents(token) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '20',
  })

  const res = await fetch(
    `${BASE}/calendar/v3/calendars/primary/events?${params}`,
    { headers: authHeaders(token) }
  )
  if (!res.ok) throw new Error('Failed to fetch calendar events')
  const data = await res.json()
  return data.items || []
}
