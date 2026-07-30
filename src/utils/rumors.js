const KEY = 'qm_rumors'

// Rumors are uncommitted brain-dump notes — no due date, no difficulty, no
// LLM theming, no penalties. They sit here until the player converts one into
// a real quest via CreateQuestModal, or deletes it outright.

function todayStr() {
  return new Date().toLocaleDateString('en-CA')
}

export function loadRumors() {
  return loadRumorsMeta().items
}

// Whole-payload read used only by the Drive sync/merge — same last-write-wins
// contract as recurring defs (see recurring.js): compare updatedAt rather than
// merging field by field, so a stale Drive read can't resurrect a just-deleted
// rumor.
export function loadRumorsMeta() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (parsed && Array.isArray(parsed.items)) {
      return { items: parsed.items.filter(r => r.text), updatedAt: parsed.updatedAt || '' }
    }
  } catch {}
  return { items: [], updatedAt: '' }
}

export function saveRumors(items) {
  const payload = { items, updatedAt: new Date().toISOString() }
  try { localStorage.setItem(KEY, JSON.stringify(payload)) } catch {}
  return payload
}

// Writes a payload as-is (preserving its updatedAt) — used when adopting a
// version pulled from Drive so we don't overwrite its timestamp.
export function saveRumorsRaw(payload) {
  try { localStorage.setItem(KEY, JSON.stringify(payload)) } catch {}
  return payload
}

export function createRumor(text) {
  const trimmed = text?.trim()
  if (!trimmed) throw new Error('Rumor requires text')
  return {
    id: `rm_${Date.now()}`,
    text: trimmed,
    createdAt: todayStr(),
  }
}
