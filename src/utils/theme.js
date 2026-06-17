const THEME_PREFIX = 'qm_theme_'
const DIFF_PREFIX = 'qm_diff_'

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

export function clearThemeCache() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(THEME_PREFIX) || k.startsWith(DIFF_PREFIX))
      .forEach(k => localStorage.removeItem(k))
  } catch {}
}

// Returns all theme/diff cache entries as a flat object for Drive sync.
export function getThemeCacheAll() {
  try {
    const result = {}
    Object.keys(localStorage)
      .filter(k => k.startsWith(THEME_PREFIX) || k.startsWith(DIFF_PREFIX))
      .forEach(k => { result[k] = localStorage.getItem(k) })
    return result
  } catch { return {} }
}

// Merges Drive theme cache into local: Drive fills missing keys, local wins conflicts.
// This ensures both devices converge on the same themed titles without overwriting
// titles the user has already seen on this device.
export function applyThemeCache(driveCache) {
  try {
    Object.entries(driveCache).forEach(([k, v]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, v)
    })
  } catch {}
}

// items: [{ id, title, notes? }]
// Returns { themes: {id: string}, suggestedDifficulties: {id: tier} }
export async function themeItems(items, glossary) {
  const uncached = items.filter(item => !getThemeCached(item.id, item.title, item.notes))

  if (uncached.length > 0) {
    try {
      const res = await fetch('/api/theme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: uncached.map(i => ({ id: i.id, title: i.title, notes: i.notes || undefined })),
          glossary: glossary || null,
        }),
      })
      if (res.ok) {
        const { themes, difficulties } = await res.json()
        uncached.forEach(item => {
          if (themes[item.id]) setThemeCache(item.id, item.title, item.notes, themes[item.id])
          if (difficulties[item.id]) setDiffCache(item.id, item.title, item.notes, difficulties[item.id])
        })
      }
    } catch {
      // fall back to original titles
    }
  }

  const themes = {}
  const suggestedDifficulties = {}
  items.forEach(item => {
    themes[item.id] = getThemeCached(item.id, item.title, item.notes) || item.title
    const cached = getDiffCached(item.id, item.title, item.notes)
    if (cached) suggestedDifficulties[item.id] = cached
  })

  return { themes, suggestedDifficulties }
}
