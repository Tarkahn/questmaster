// Typed localStorage helpers — replace the repeated
// (() => { try { return JSON.parse(...) } catch {} })() idiom scattered around.

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function readNum(key, fallback = 0) {
  const n = Number(localStorage.getItem(key))
  return Number.isFinite(n) ? n : fallback
}
