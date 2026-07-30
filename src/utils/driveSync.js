const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const BOUNDARY = 'qm_drive_boundary'

// One config object per appDataFolder file. `name` is the Drive filename;
// `idKey` is the localStorage key the resolved file id is cached under.
const HABITS      = { name: 'questmaster-habits.json',          idKey: 'qm_drive_file_id' }
const GLOSSARY    = { name: 'questmaster-glossary.txt',         idKey: 'qm_drive_glossary_id', contentType: 'text/plain' }
const DIFFICULTIES= { name: 'questmaster-difficulties.json',    idKey: 'qm_drive_diff_id' }
const SETTINGS    = { name: 'questmaster-settings.json',        idKey: 'qm_drive_settings_id' }
const GAME_STATE  = { name: 'questmaster-gamestate.json',       idKey: 'qm_drive_gamestate_id' }
const THEME_CACHE = { name: 'questmaster-themes.json',          idKey: 'qm_drive_themes_id' }
const CHARACTER   = { name: 'questmaster-character.json',       idKey: 'qm_drive_character_id' }
const RECURRING   = { name: 'questmaster-recurring.json',       idKey: 'qm_drive_recurring_id' }
const TASKORDER   = { name: 'questmaster-taskorder.json',       idKey: 'qm_drive_taskorder_id' }
const STATS       = { name: 'questmaster-character-stats.json', idKey: 'qm_drive_stats_id' }
const LOCATIONS   = { name: 'questmaster-locations.json',       idKey: 'qm_drive_locations_id' }
const PENALTY_LEDGER = { name: 'questmaster-penalty-ledger.json', idKey: 'qm_drive_penalty_ledger_id' }
const RUMORS        = { name: 'questmaster-rumors.json',         idKey: 'qm_drive_rumors_id' }

function auth(token) {
  return { Authorization: `Bearer ${token}` }
}

// ── Core plumbing ────────────────────────────────────────────────────────────

// Always resolve by name (oldest match) so every device converges on the SAME
// file, even if duplicates exist in appDataFolder from earlier sessions. A stale
// per-device cached id is exactly what once split devices onto separate files.
async function resolveFileId({ name, idKey }, token) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${name}'`,
    fields: 'files(id)',
    orderBy: 'createdTime',
  })
  const res = await fetch(`${DRIVE}/files?${params}`, { headers: auth(token) })
  if (!res.ok) throw Object.assign(new Error(`Drive list failed: ${res.status}`), { status: res.status })
  const data = await res.json()
  const id = data.files?.[0]?.id || null
  if (id) localStorage.setItem(idKey, id)
  else localStorage.removeItem(idKey)
  return id
}

// Read a file's body. Returns { raw, missing }: raw is the parsed JSON (or text
// when config.asText), missing is true when no file exists yet (or 404'd).
async function readFile(config, token) {
  const fileId = await resolveFileId(config, token)
  if (!fileId) return { raw: null, missing: true }
  const res = await fetch(`${DRIVE}/files/${fileId}?alt=media`, { headers: auth(token) })
  if (res.status === 404) { localStorage.removeItem(config.idKey); return { raw: null, missing: true } }
  if (!res.ok) throw Object.assign(new Error(`Drive read failed: ${res.status}`), { status: res.status })
  const raw = config.asText ? await res.text() : await res.json()
  return { raw, missing: false }
}

// PATCH the existing file, or create it via multipart upload if absent.
// Self-heals a stale id (404 on PATCH) by clearing the cache and retrying.
// Returns { ok, status }.
async function writeFile(config, body, token) {
  const contentType = config.contentType || 'application/json'
  const fileId = await resolveFileId(config, token)
  if (fileId) {
    const res = await fetch(`${UPLOAD}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': contentType },
      body,
    })
    if (res.status === 404) { localStorage.removeItem(config.idKey); return writeFile(config, body, token) }
    return { ok: res.ok, status: res.status }
  }
  const metadata = JSON.stringify({ name: config.name, parents: ['appDataFolder'] })
  const multipart = [
    `--${BOUNDARY}`, 'Content-Type: application/json; charset=UTF-8', '', metadata,
    `--${BOUNDARY}`, `Content-Type: ${contentType}`, '', body, `--${BOUNDARY}--`,
  ].join('\r\n')
  const res = await fetch(`${UPLOAD}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
    body: multipart,
  })
  if (res.ok) { const data = await res.json(); if (data.id) localStorage.setItem(config.idKey, data.id) }
  return { ok: res.ok, status: res.status }
}

// Wrap a read with the standard error → 'scope' | 'network' handling. `map`
// shapes the parsed body into the function's return object; it is called with
// null on a missing file or any error, so it must yield nulls for that case.
async function loadWith(config, token, map) {
  try {
    const { raw, missing } = await readFile(config, token)
    return { ...map(missing ? null : raw), error: null }
  } catch (e) {
    const scope = e.status === 401 || e.status === 403
    return { ...map(null), error: scope ? 'scope' : 'network' }
  }
}

// Wrap a write so a thrown list/parse error degrades to { ok: false }.
// localStorage remains the source of truth, so a failed sync is non-fatal.
async function saveWith(config, token, value, serialize = JSON.stringify) {
  try {
    return await writeFile(config, serialize(value), token)
  } catch (e) {
    return { ok: false, status: e?.status }
  }
}

// ── Habits (+ difficulties legacy bundle) ────────────────────────────────────
// File format: {habits: [...], difficulties: {...}} or a legacy plain array.
export async function loadFromDrive(token) {
  return loadWith(HABITS, token, raw => {
    if (Array.isArray(raw)) return { habits: raw, difficulties: null }
    return {
      habits: Array.isArray(raw?.habits) ? raw.habits : null,
      difficulties: raw?.difficulties && typeof raw.difficulties === 'object' ? raw.difficulties : null,
    }
  })
}

export async function saveToDrive(token, habits) {
  return saveWith(HABITS, token, habits)
}

// ── Glossary (plain text) ────────────────────────────────────────────────────
export async function loadGlossary(token) {
  return loadWith({ ...GLOSSARY, asText: true }, token, raw => ({ text: raw ?? null }))
}

export async function saveGlossary(token, text) {
  return saveWith(GLOSSARY, token, text, v => v)
}

// ── Difficulties ─────────────────────────────────────────────────────────────
export async function loadDifficulties(token) {
  return loadWith(DIFFICULTIES, token, raw => ({ memory: raw && typeof raw === 'object' ? raw : null }))
}

export async function saveDifficulties(token, memory) {
  return saveWith(DIFFICULTIES, token, memory)
}

// ── Settings ─────────────────────────────────────────────────────────────────
export async function loadSettingsFromDrive(token) {
  return loadWith(SETTINGS, token, raw => ({ settings: raw && typeof raw === 'object' ? raw : null }))
}

export async function saveSettingsToDrive(token, settings) {
  return saveWith(SETTINGS, token, settings)
}

// ── Game state ───────────────────────────────────────────────────────────────
export async function loadGameState(token) {
  return loadWith(GAME_STATE, token, raw => ({ state: raw && typeof raw === 'object' ? raw : null }))
}

export async function saveGameStateToDrive(token, gameState) {
  return saveWith(GAME_STATE, token, gameState)
}

// ── Theme cache ──────────────────────────────────────────────────────────────
export async function loadThemeCache(token) {
  return loadWith(THEME_CACHE, token, raw => ({ cache: raw && typeof raw === 'object' ? raw : null }))
}

export async function saveThemeCache(token, cache) {
  return saveWith(THEME_CACHE, token, cache)
}

// ── Character ────────────────────────────────────────────────────────────────
export async function loadCharacter(token) {
  return loadWith(CHARACTER, token, raw => ({ character: raw && typeof raw === 'object' ? raw : null }))
}

export async function saveCharacter(token, character) {
  return saveWith(CHARACTER, token, character)
}

// ── Recurring quest defs ─────────────────────────────────────────────────────
// Payload shape: { defs: [...], updatedAt }. Legacy Drive files may still be a
// bare array (written before updatedAt existed) — normalize those to
// updatedAt: '' so any local write with a real timestamp always wins the
// last-write-wins comparison in Dashboard.jsx (whole-array replace, no
// per-field merging — that's what let a stale Drive read resurrect deletes
// and clobber lastTaskId/lastCompletedDate with old values).
export async function loadRecurringFromDrive(token) {
  return loadWith(RECURRING, token, raw => {
    if (Array.isArray(raw)) return { payload: { defs: raw, updatedAt: '' } }
    if (raw && Array.isArray(raw.defs)) return { payload: raw }
    return { payload: null }
  })
}

export async function saveRecurringToDrive(token, payload) {
  return saveWith(RECURRING, token, payload)
}

// ── Task display order ───────────────────────────────────────────────────────
// Payload shape: { order: [...], updatedAt }.
export async function loadTaskOrderFromDrive(token) {
  return loadWith(TASKORDER, token, raw => ({ payload: raw && Array.isArray(raw.order) ? raw : null }))
}

export async function saveTaskOrderToDrive(token, payload) {
  return saveWith(TASKORDER, token, payload)
}

// ── Character stats (+ contribution history) ─────────────────────────────────
// File format: { stats: [...], history: {...} } or a legacy bare stats array.
export async function loadStats(token) {
  return loadWith(STATS, token, raw => {
    if (Array.isArray(raw)) return { stats: raw, history: null }
    return {
      stats: Array.isArray(raw?.stats) ? raw.stats : null,
      history: raw?.history && typeof raw.history === 'object' ? raw.history : null,
    }
  })
}

export async function saveStats(token, stats, history) {
  return saveWith(STATS, token, history ? { stats, history } : stats)
}

// ── Quest pin locations ──────────────────────────────────────────────────────
// File format: { [taskOrEventId]: { lat, lng, title, type: 'task'|'event' } }
export async function loadLocations(token) {
  return loadWith(LOCATIONS, token, raw => ({
    locations: raw && typeof raw === 'object' ? raw : null,
  }))
}

export async function saveLocations(token, locations) {
  return saveWith(LOCATIONS, token, locations)
}

// ── Penalty ledger ───────────────────────────────────────────────────────────
// File format: { lastSweepDate, dueDates: {...}, missions: {...} }
export async function loadPenaltyLedger(token) {
  return loadWith(PENALTY_LEDGER, token, raw => ({ ledger: raw && typeof raw === 'object' ? raw : null }))
}

export async function savePenaltyLedger(token, ledger) {
  return saveWith(PENALTY_LEDGER, token, ledger)
}

// ── Rumors (uncommitted brain-dump notes) ───────────────────────────────────
// File format: { items: [...], updatedAt } — same whole-payload merge contract
// as recurring defs.
export async function loadRumorsFromDrive(token) {
  return loadWith(RUMORS, token, raw => {
    if (Array.isArray(raw)) return { payload: { items: raw, updatedAt: '' } }
    if (raw && Array.isArray(raw.items)) return { payload: raw }
    return { payload: null }
  })
}

export async function saveRumorsToDrive(token, payload) {
  return saveWith(RUMORS, token, payload)
}
