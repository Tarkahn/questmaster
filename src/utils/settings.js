const KEY = 'qm_settings'

export const DEFAULT_SETTINGS = {
  sendNotesToLlm: true,
  sfxVolume: 0.7,
  musicVolume: 0.3,
  missionLookAhead: 0, // days of future missions to show: 0 (today), 3, 7, 30
  revealMs: 5000,      // ms to show original title before re-hiding (2000–10000)
  newQuestPosition: 'bottom', // 'bottom' | 'top'
  autoSort: false,             // when true, sort by urgency instead of manual order
  showMissedQuestSummary: true,
  hardMode: false,            // escalate XP+HP penalties by how many days late
  defaultReminderMinutes: 30, // default Google Calendar reminder lead time for timed quests/missions
  combinedView: false,        // when true, merge quests + missions into one urgency-sorted list
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
