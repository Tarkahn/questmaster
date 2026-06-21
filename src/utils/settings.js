const KEY = 'qm_settings'

export const DEFAULT_SETTINGS = {
  sendNotesToLlm: true,
  sfxVolume: 0.7,
  musicVolume: 0.3,
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch {}
}
