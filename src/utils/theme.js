const THEME_PREFIX = 'qm_theme_'
const DIFF_PREFIX = 'qm_diff_'
const STAT_PREFIX = 'qm_stat_'

function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

function itemHash(id, title, notes) {
  return hashStr(id + '|' + title + '|' + (notes || ''))
}

function getThemeCached(id, title, notes) {
  try { return localStorage.getItem(THEME_PREFIX + itemHash(id, title, notes)) } catch { return null }
}
function setThemeCache(id, title, notes, themed) {
  try { localStorage.setItem(THEME_PREFIX + itemHash(id, title, notes), themed) } catch {}
}
function getDiffCached(id, title, notes) {
  try { return localStorage.getItem(DIFF_PREFIX + itemHash(id, title, notes)) } catch { return null }
}
function setDiffCache(id, title, notes, tier) {
  try { localStorage.setItem(DIFF_PREFIX + itemHash(id, title, notes), tier) } catch {}
}
function getStatWeightCached(id, title, notes) {
  try {
    const raw = localStorage.getItem(STAT_PREFIX + itemHash(id, title, notes))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function setStatWeightCache(id, title, notes, weights) {
  try { localStorage.setItem(STAT_PREFIX + itemHash(id, title, notes), JSON.stringify(weights)) } catch {}
}

export function clearThemeCache() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(THEME_PREFIX) || k.startsWith(DIFF_PREFIX) || k.startsWith(STAT_PREFIX))
      .forEach(k => localStorage.removeItem(k))
  } catch {}
}

// Returns all theme/diff/stat cache entries as a flat object for Drive sync.
export function getThemeCacheAll() {
  try {
    const result = {}
    Object.keys(localStorage)
      .filter(k => k.startsWith(THEME_PREFIX) || k.startsWith(DIFF_PREFIX) || k.startsWith(STAT_PREFIX))
      .forEach(k => { result[k] = localStorage.getItem(k) })
    return result
  } catch { return {} }
}

// Applies Drive theme cache to local storage. Drive wins on conflicts so both
// devices converge on the same themed titles — whichever device wrote to Drive
// last becomes the canonical version for all devices.
export function applyThemeCache(driveCache) {
  try {
    Object.entries(driveCache).forEach(([k, v]) => {
      if (k.startsWith(THEME_PREFIX) || k.startsWith(DIFF_PREFIX) || k.startsWith(STAT_PREFIX)) {
        localStorage.setItem(k, v)
      }
    })
  } catch {}
}

// items: [{ id, title, notes?, cacheKey? }]
// cacheKey: an optional stable id to key the theme cache by instead of `id`.
// Recurring quests materialize a brand-new Google Task id each day they
// recur, so caching by `id` alone would re-theme (and re-spend a Haiku call
// on) the exact same title every single day. Callers that know an item's
// "real" identity outlives its underlying record (e.g. the recurring def id)
// should pass that as cacheKey — the API request/response still use the
// real `id` so results land on the right on-screen item.
// statGlossary: [{ id, name, description }] — passed to LLM for stat classification
// Returns { themes, suggestedDifficulties, statWeights: {id: {statId: weight}} }
export async function themeItems(items, glossary, statGlossary) {
  const keyOf = item => item.cacheKey || item.id
  const uncached = items.filter(item => !getThemeCached(keyOf(item), item.title, item.notes))

  if (uncached.length > 0) {
    try {
      const res = await fetch('/api/theme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: uncached.map(i => ({ id: i.id, title: i.title, notes: i.notes || undefined })),
          glossary: glossary || null,
          statGlossary: statGlossary || null,
        }),
      })
      if (res.ok) {
        const { themes, difficulties, statWeights } = await res.json()
        uncached.forEach(item => {
          if (themes[item.id]) setThemeCache(keyOf(item), item.title, item.notes, themes[item.id])
          if (difficulties[item.id]) setDiffCache(keyOf(item), item.title, item.notes, difficulties[item.id])
          if (statWeights?.[item.id]) setStatWeightCache(keyOf(item), item.title, item.notes, statWeights[item.id])
        })
      }
    } catch {
      // fall back to original titles
    }
  }

  const themes = {}
  const suggestedDifficulties = {}
  const statWeights = {}
  items.forEach(item => {
    themes[item.id] = getThemeCached(keyOf(item), item.title, item.notes) || item.title
    const cached = getDiffCached(keyOf(item), item.title, item.notes)
    if (cached) suggestedDifficulties[item.id] = cached
    const sw = getStatWeightCached(keyOf(item), item.title, item.notes)
    if (sw) statWeights[item.id] = sw
  })

  return { themes, suggestedDifficulties, statWeights }
}
