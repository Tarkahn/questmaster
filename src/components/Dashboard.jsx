import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchTodaysTasks, fetchUpcomingEvents, markTaskComplete, markTaskIncomplete, createTask, createSubtask, createEvent, deleteTask, updateTask, updateTaskChecklist, deleteEvent, updateEvent, buildCompanionEvent, formatQuestTime, moveSubtask, parseQuestTime, parseQuestReminder, parseChecklist, stripAuxTags, dueDateOnly, localMidnight } from '../utils/api'
import { computeCoins, BASE_COIN_VALUE } from '../utils/coinValue'
import { themeItems, clearThemeCache, getThemeCacheAll, applyThemeCache } from '../utils/theme'
import { loadDifficultyMemory, saveDifficultyMemory, getDifficulty, setDifficultyInMemory } from '../utils/difficulty'
import { loadHabits, saveHabits, createHabitObj, completeHabitObj, processHabits, pauseHabit, resumeHabit, deleteHabit, resetHabit, resetAllBossStats } from '../utils/habits'
import { loadFromDrive, saveToDrive, loadGlossary, saveGlossary, loadDifficulties, saveDifficulties, loadSettingsFromDrive, saveSettingsToDrive, loadGameState, saveGameStateToDrive, loadThemeCache, saveThemeCache, loadCharacter, loadRecurringFromDrive, saveRecurringToDrive, loadTaskOrderFromDrive, saveTaskOrderToDrive, loadStats, loadLocations, loadPenaltyLedger, savePenaltyLedger, loadRumorsFromDrive, saveRumorsToDrive } from '../utils/driveSync'
import { loadLedger, saveLedger, recordMissions, resolveMission, runPenaltyPass, dueChangePenalty, mergeLedgers, recurringMissPenalty, todayStr } from '../utils/penalties'
import { loadRecurring, loadRecurringMeta, saveRecurring, saveRecurringRaw, createRecurringDef, getDueToday, markMaterialized, scheduleLabel, setLastTaskId, recordCompletion, recordMiss } from '../utils/recurring'
import { loadRumors, loadRumorsMeta, saveRumors, saveRumorsRaw, createRumor } from '../utils/rumors'
import { loadTaskOrder, saveTaskOrder, saveTaskOrderRaw, computeDisplayOrder, computeAutoSortOrder, computeCombinedOrder, reorderIds } from '../utils/taskOrder'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../utils/settings'
import { DEFAULT_GLOSSARY } from '../utils/defaultGlossary'
import { useGameState, computeGameStateMerge } from '../hooks/useGameState'
import { useStats } from '../hooks/useStats'
import { useCharacter } from '../hooks/useCharacter'
import { useLocations } from '../hooks/useLocations'
import { readJson, writeJson, readNum } from '../utils/storage'
import TaskItem from './TaskItem'
import EventItem from './EventItem'
import BossCard from './BossCard'
import CreateHabitModal from './CreateHabitModal'
import CreateQuestModal from './CreateQuestModal'
import CreateMissionModal from './CreateMissionModal'
import SideQuestModal from './SideQuestModal'
import EditQuestModal from './EditQuestModal'
import ChecklistModal from './ChecklistModal'
import EditMissionModal from './EditMissionModal'
import GlossaryModal from './GlossaryModal'
import SettingsModal from './SettingsModal'
import StatEditorModal from './StatEditorModal'
import StatDetailModal from './StatDetailModal'
import InventoryModal from './InventoryModal'
import HelpModal, { HelpButton } from './HelpModal'
import Chronicle from './Chronicle'
import CharacterSelectModal from './CharacterSelectModal'
import CharacterView from './CharacterView'
import BossJournalModal from './BossJournalModal'
import ShopView from './ShopView'
import WorldMap from './WorldMap'
import SplashScreen from './SplashScreen'
import PenaltyReportModal from './PenaltyReportModal'
import Toast from './Toast'
import { CLASSES, classDiceBonus, applyXpPerk, applyRangerMissionBonus } from '../utils/character'
import { ITEMS, getItemDiceBonus, getPhilosopherBonus, getTomeBonus, getItemMissionBonus } from '../utils/items'
import { setSfxVolume, playLevelUp, playBossStrike, playBossDefeat } from '../utils/audio'

const BGM_SRC = '/audio/Medieval%20Vol.%202%206.mp3'

const LOOKAHEAD_OPTIONS = [
  { days: 0,  label: 'Today' },
  { days: 3,  label: '3 days' },
  { days: 7,  label: '7 days' },
  { days: 30, label: '1 month' },
]

// Returns a Date at local midnight for an event's start (handles all-day + timed).
function eventStartDate(event) {
  if (event.start?.date) {
    const [y, m, d] = event.start.date.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  if (event.start?.dateTime) {
    const dt = new Date(event.start.dateTime)
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  }
  return null
}

function dayHeaderLabel(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((date - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

// Groups events (already sorted by start time) into consecutive same-day buckets.
function groupEventsByDay(events) {
  const groups = []
  let cur = null
  for (const ev of events) {
    const d = eventStartDate(ev)
    const key = d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : 'unknown'
    if (!cur || cur.key !== key) {
      cur = { key, label: d ? dayHeaderLabel(d) : 'Scheduled', events: [] }
      groups.push(cur)
    }
    cur.events.push(ev)
  }
  return groups
}

// The day a combined-view row belongs under. Missions carry a timestamp;
// quests carry Google Tasks' UTC-midnight `due`, which has to go through
// localMidnight — `new Date(due)` rolls back a day west of Greenwich.
// Undated quests return null and collect under their own heading.
function combinedEntryDate(entry) {
  return entry.type === 'mission'
    ? eventStartDate(entry.item)
    : localMidnight(entry.item.due)
}

// Same day-bucketing as groupEventsByDay, over the merged quest+mission list.
// Mission cards show only a time of day and quest cards only a bare month/day,
// so without these headers the combined list gives no way to tell which day an
// item falls on — the reason the 3-day / week / month windows were hard to read.
// computeCombinedOrder already sorts by deadline and pins undated quests last,
// so consecutive runs share a day and the undated ones form one trailing group.
// Each row keeps its position in the flat list as `index`, which drives the
// staggered card animation.
function groupCombinedByDay(entries) {
  const groups = []
  let cur = null
  entries.forEach((entry, index) => {
    const d = combinedEntryDate(entry)
    const key = d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : 'undated'
    if (!cur || cur.key !== key) {
      cur = { key, label: d ? dayHeaderLabel(d) : 'No date', entries: [] }
      groups.push(cur)
    }
    cur.entries.push({ ...entry, index })
  })
  return groups
}

export default function Dashboard({ token, onSignOut }) {
  const [tasks, setTasks] = useState([])
  const [taskOrder, setTaskOrder] = useState(() => loadTaskOrder()) // { order: [ids], updatedAt }
  const [subtasksByParent, setSubtasksByParent] = useState({})
  const [sideQuestParent, setSideQuestParent] = useState(null) // parent task obj for the Side Quest modal
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [themedTitles, setThemedTitles] = useState({})
  const [theming, setTheming] = useState(false)
  const [habits, setHabits] = useState(() => loadHabits())
  const [showCreateHabit, setShowCreateHabit] = useState(false)
  const [showCreateQuest, setShowCreateQuest] = useState(false)
  const [createQuestInitialData, setCreateQuestInitialData] = useState(null)
  const [convertingRumorId, setConvertingRumorId] = useState(null)
  const [showCreateMission, setShowCreateMission] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [checklistTask, setChecklistTask] = useState(null)
  const [editingSubtask, setEditingSubtask] = useState(null) // { sub, parentId }
  const [editingEvent, setEditingEvent] = useState(null)
  const [taskSeenMap, setTaskSeenMap] = useState(() => readJson('qm_task_seen', {}))
  const [penaltyReport, setPenaltyReport] = useState(null)
  // Per-card toll indicators — same numbers as penaltyReport's `lines`, just
  // keyed by task/subtask/mission id so each card can show its own day's cost.
  // Lives on the penalty ledger's `dailyPerItem` (synced to Drive, see
  // penalties.js/mergeLedgers) rather than a device-local cache — a badge used
  // to only appear on whichever device happened to run that day's sweep.
  // Only ever meaningful for "today" so a stale date is discarded on load.
  const [penaltyByItem, setPenaltyByItem] = useState(() => {
    const dpi = loadLedger().dailyPerItem
    return dpi?.date === todayStr() ? dpi.perItem : {}
  })
  const penaltyLedgerRef = useRef(loadLedger())
  const penaltyRunningRef = useRef(false)
  const levelUpRunningRef = useRef(false)
  // True once syncFromDrive has completed successfully at least once this
  // session. Recurring-quest materialization gates on this — see the bug fix
  // note at its usage below: loadTasksAndEvents reads recurring defs from
  // local storage synchronously on mount, which can race ahead of the Drive
  // fetch that would have carried a completion made on another device,
  // causing an already-completed recurring quest to be wrongly flagged
  // missed (deleted + penalized) before the real data arrives.
  const driveSyncedRef = useRef(false)
  const creatingMissionRef = useRef(false)
  const creatingQuestRef = useRef(false)
  const materializingRecurringRef = useRef(false)
  const { character, commitCharacter, mergeFromDrive: mergeCharacter,
          selectClass, equipItem, unequipItem, damagePlayer, applyLevelUps } = useCharacter(token)
  const [showCharacterSelect, setShowCharacterSelect] = useState(false)
  const [showBossJournal, setShowBossJournal] = useState(false)
  const [recurring, setRecurring] = useState(() => loadRecurring())
  const [showRecurringList, setShowRecurringList] = useState(false)
  const [rumors, setRumors] = useState(() => loadRumors())
  const [rumorDraft, setRumorDraft] = useState('')
  const rumorInputRef = useRef(null)
  const [showCompletedList, setShowCompletedList] = useState(false)
  const [showGlossary, setShowGlossary] = useState(false)
  const [glossary, setGlossary] = useState(DEFAULT_GLOSSARY)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(() => loadSettings())
  const [difficultyMemory, setDifficultyMemory] = useState(() => loadDifficultyMemory())
  const [suggestedDifficulties, setSuggestedDifficulties] = useState({})
  const [syncStatus, setSyncStatus] = useState('checking') // checking | ok | scope | network
  const [view, setView] = useState('quests') // quests | chronicle | character | shop | map
  const [showMenu, setShowMenu] = useState(false)
  const [shopStartCategory, setShopStartCategory] = useState('weapon')
  const [showSplash, setShowSplash] = useState(true)
  const { stats, earnStatXP, saveStat, deleteStat, mergeFromDrive: mergeStats } = useStats(token)
  const { locations, addPin, removePin, mergeFromDrive: mergeLocations } = useLocations(token)
  const [statWeightsMap, setStatWeightsMap] = useState({})
  const [showStatEditor, setShowStatEditor] = useState(false)
  const [editingStat, setEditingStat] = useState(null)
  const [showStatDetail, setShowStatDetail] = useState(false)
  const [detailStat, setDetailStat] = useState(null)
  const [showInventory, setShowInventory] = useState(false)
  const [helpTopic, setHelpTopic] = useState(null)

  const {
    points, lifetimeXp, coins, coinsEarned, coinsSpent, streak, bestStreak, lastCompletedDate, completedToday,
    level, xpInto, xpNeeded, xpPct,
    claimedEvents, completeTask, uncompleteTask, deductXP, earnCoins, spendCoins,
    removeCoins, claimEvent, unclaimEvent,
    history, resetStats, applyGameState,
  } = useGameState()
  const [xpDoubleActive, setXpDoubleActive] = useState(false)
  const [completedTasks, setCompletedTasks] = useState(() => {
    const parsed = readJson('qm_completed_today', null)
    if (!parsed) return []
    const today = new Date().toLocaleDateString('en-CA')
    return parsed.date === today ? (parsed.entries || []) : []
  })
  const menuRef = useRef(null)
  const headerRef = useRef(null)
  const bgmRef = useRef(null)
  const bgmCtxRef = useRef(null)   // AudioContext for iOS-compatible volume
  const bgmGainRef = useRef(null)  // GainNode — audio.volume is read-only on iOS
  const bgmVolumeRef = useRef(settings.musicVolume ?? 0.3)
  const bgmUnlockedRef = useRef(false) // first tap makes it audible — see unlock()
  const prevLevelRef = useRef(null)
  // lifetimeXp MUST be in this payload: the level/XP-bar display derives from
  // lifetimeXp (not spendable points), and computeGameStateMerge Math.max-es
  // it — omitting it here meant Drive never carried it, so each device only
  // counted XP earned locally and their XP bars permanently diverged.
  const gameStateRef = useRef({ points, lifetimeXp, coins, coinsEarned, coinsSpent, streak, bestStreak, lastCompletedDate, claimedEvents, history })
  useEffect(() => {
    gameStateRef.current = { points, lifetimeXp, coins, coinsEarned, coinsSpent, streak, bestStreak, lastCompletedDate, claimedEvents, history }
  })
  const handleSignOut = useCallback(onSignOut, [onSignOut])

  // Measure the sticky header's real height and expose it as a CSS variable so
  // the map (and any full-height view) can subtract the EXACT header height
  // rather than a hardcoded guess. Handles Dynamic Island insets, HP bars and
  // the streak banner appearing/disappearing across devices.
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const setVar = () =>
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`)
    setVar()
    const ro = new ResizeObserver(setVar)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Sound cue only — the toast text (now including the HP gain) is owned by
  // the durable, hpLevel-gated effect near runPenaltySweep below, so a level-
  // up produces exactly one toast, not two racing to set the same state.
  useEffect(() => {
    if (prevLevelRef.current !== null && level > prevLevelRef.current) {
      playLevelUp()
    }
    prevLevelRef.current = level
  }, [level])

  useEffect(() => { setSfxVolume(settings.sfxVolume ?? 0.7) }, [settings.sfxVolume])

  // BGM with iOS-compatible volume via Web Audio GainNode.
  // iOS makes audio.volume read-only — changes are silently ignored.
  // Routing through a GainNode processes the signal before it reaches
  // the hardware, which iOS cannot intercept.
  useEffect(() => {
    const audio = bgmRef.current
    if (!audio) return

    function initWebAudio() {
      if (bgmCtxRef.current) return
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)()
        const src = ac.createMediaElementSource(audio)
        const gain = ac.createGain()
        gain.gain.value = bgmVolumeRef.current
        src.connect(gain)
        gain.connect(ac.destination)
        bgmCtxRef.current = ac
        bgmGainRef.current = gain
        ac.resume().catch(() => {})
      } catch {}
    }

    // Resume-only on visibility (reverted 2026-07-05 from a destructive
    // close-and-rebuild attempt — that version tried to call
    // createMediaElementSource() again on the SAME <audio> element, which the
    // Web Audio spec only ever allows ONCE per element, for its whole
    // lifetime. That threw (caught silently), left bgmGainRef null forever
    // after the first backgrounding, permanently muting the element (its only
    // path to the speakers was the now-closed graph) and breaking the volume
    // slider — matching reports of needing to log out/in to restore sound,
    // and the volume control working only "occasionally." A suspended
    // context, by contrast, is always safe to resume without touching the
    // element/graph at all, so that's the one thing done here.
    // Backgrounding pauses the <audio> element on iOS, and resuming the
    // AudioContext alone does NOT unpause it — the element needs its own
    // play() call. This went unnoticed while hourly logouts forced full
    // reloads (each sign-in remounted everything and restarted the music);
    // once sessions became long-lived, the first backgrounding killed BGM
    // for good, while synthesized SFX kept working. So: retry play() on
    // wake, and keep the gesture listeners installed permanently as the
    // fallback for when iOS insists the play() come from a tap.
    // The context can be non-running in two states: 'suspended' (created
    // outside a gesture — iOS starts it that way) and iOS's non-standard
    // 'interrupted' (after a phone call / Siri / backgrounding). Either way
    // the element keeps "playing" into a dead graph: readyState 4, paused
    // false, total silence — confirmed live via the Settings readout. Resume
    // must therefore never be gated on the element being paused.
    function resumeCtx() {
      const c = bgmCtxRef.current
      if (c && c.state !== 'running') c.resume().catch(() => {})
    }

    function onVisible() {
      if (document.visibilityState !== 'visible') return
      resumeCtx()
      if (audio.paused) audio.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)

    // Start immediately, muted — every browser's autoplay policy (iOS
    // included) always allows muted playback with no gesture. This just gets
    // the element decoding/running in the background: the AudioContext it
    // feeds (below) starts 'suspended' on iOS and STAYS that way — silently
    // eating the signal — until resumed inside a real gesture, which is a
    // hard WebKit rule with no client-side workaround (confirmed: waiting
    // before tapping shows the track already partway through, i.e. it really
    // was playing, just gated shut). unlock() is what actually makes it
    // audible, and rewinds to 0 so the song starts from the top instead of
    // wherever it silently drifted to while waiting for the tap.
    initWebAudio()
    audio.muted = true
    audio.play().catch(() => {})

    // iOS: capture-phase ensures we're in the synchronous gesture context iOS
    // requires for audio.play() and AudioContext.resume(). Deliberately never
    // removed. The resume comes BEFORE the paused check: the playing-but-
    // silent state (element playing, context suspended) was exactly the case
    // an early "already playing" return used to skip past.
    function unlock() {
      initWebAudio()
      resumeCtx()
      if (!bgmUnlockedRef.current) {
        bgmUnlockedRef.current = true
        audio.currentTime = 0
      }
      audio.muted = false
      if (audio.paused) audio.play().catch(() => {})
    }
    document.addEventListener('touchstart', unlock, true)
    document.addEventListener('touchend',   unlock, true)
    document.addEventListener('click',      unlock, true)
    return () => {
      document.removeEventListener('touchstart', unlock, true)
      document.removeEventListener('touchend',   unlock, true)
      document.removeEventListener('click',      unlock, true)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Volume sync: update GainNode (works on iOS); audio.volume is a no-op there
  useEffect(() => {
    const v = settings.musicVolume ?? 0.3
    bgmVolumeRef.current = v
    if (bgmGainRef.current) bgmGainRef.current.gain.value = v
  }, [settings.musicVolume])

  // One-line snapshot of the BGM pipeline, surfaced in Settings. Exists
  // because iOS gives no console: readyState 0-4 (4 = fully loaded), network
  // 0-3 (3 = no usable source), err codes 1 abort / 2 network / 3 decode /
  // 4 format unsupported, plus the AudioContext state ('interrupted' is an
  // iOS-only state that a 'suspended'-only check would miss) and gain value.
  function describeBgmState() {
    const a = bgmRef.current
    if (!a) return 'no player element'
    const parts = [
      a.paused ? 'paused' : 'playing',
      `ready ${a.readyState}`,
      `net ${a.networkState}`,
      a.error ? `err ${a.error.code}` : 'no err',
      `ctx ${bgmCtxRef.current?.state ?? 'none'}`,
      `gain ${bgmGainRef.current ? bgmGainRef.current.gain.value.toFixed(2) : 'none'}`,
    ]
    return parts.join(' · ')
  }

  // One-time theme cache sync on mount: merge Drive cache into local so both
  // devices show the same D&D themed titles. Local wins on conflicts so the
  // user never sees a title change mid-session.
  useEffect(() => {
    async function syncThemes() {
      try {
        const { cache: driveCache } = await loadThemeCache(token)
        const localCache = getThemeCacheAll()
        if (driveCache) {
          // Merge: Drive fills keys missing locally, local keeps its own
          const merged = { ...driveCache, ...localCache }
          applyThemeCache(driveCache)
          await saveThemeCache(token, merged)
        } else if (Object.keys(localCache).length > 0) {
          await saveThemeCache(token, localCache)
        }
      } catch {}
    }
    syncThemes()
  }, [token])

  // Sync habits + difficulties + glossary from Drive — on mount, every 15s,
  // and whenever this device regains focus/visibility.
  useEffect(() => {
    async function syncFromDrive() {
      const local = loadHabits()
      const [
        { habits: driveHabits, error },
        { text: driveGlossary },
        { memory: driveDifficulties },
        { settings: driveSettings },
        { state: driveGameState },
        { character: driveCharacter },
        { payload: driveRecurring },
        { payload: driveTaskOrder },
        { stats: driveStats, history: driveStatHistory },
        { locations: driveLocations },
        { ledger: driveLedger },
        { payload: driveRumors },
      ] = await Promise.all([
        loadFromDrive(token),
        loadGlossary(token),
        loadDifficulties(token),
        loadSettingsFromDrive(token),
        loadGameState(token),
        loadCharacter(token),
        loadRecurringFromDrive(token),
        loadTaskOrderFromDrive(token),
        loadStats(token),
        loadLocations(token),
        loadPenaltyLedger(token),
        loadRumorsFromDrive(token),
      ])

      if (error === 'scope') {
        setSyncStatus('scope')
        setToast('⚠️ Session expired — signing you out. Sign back in to sync.')
        setTimeout(onSignOut, 2000)
        return
      }
      if (error) {
        setSyncStatus(error)
        return
      }

      setSyncStatus('ok')

      if (driveHabits !== null) {
        const { habits: processed } = processHabits(driveHabits)
        setHabits(processed)
        saveHabits(processed)
      } else {
        if (local.length > 0) saveToDrive(token, local)
      }

      if (driveDifficulties !== null) {
        setDifficultyMemory(driveDifficulties)
        saveDifficultyMemory(driveDifficulties)
      }

      if (driveGlossary) {
        setGlossary(driveGlossary)
      }

      if (driveSettings) {
        const merged = { ...DEFAULT_SETTINGS, ...driveSettings }
        setSettings(merged)
        saveSettings(merged)
      }

      if (driveGameState) {
        // Compute merge outside React state so we can write it to Drive
        // synchronously before applying to state — no side effects in setState.
        const merged = computeGameStateMerge(gameStateRef.current, driveGameState)
        await saveGameStateToDrive(token, merged)
        applyGameState(merged)
      } else {
        // No Drive file yet — bootstrap from local state so the other device
        // can read it on its next poll.
        await saveGameStateToDrive(token, gameStateRef.current)
      }

      if (driveCharacter) {
        mergeCharacter(driveCharacter)
        if (!driveCharacter.class) setShowCharacterSelect(true)
      } else {
        // First launch — show class selection
        setShowCharacterSelect(true)
      }

      // Whole-array last-write-wins by updatedAt — NOT a per-field merge. A
      // per-field merge (old approach) took Drive's copy of every field except
      // lastMaterializedDate, so a stale Drive read could resurrect a def the
      // user just deleted, or clobber a fresh lastTaskId/lastCompletedDate with
      // an older Drive value (breaking completion tracking and causing
      // already-completed quests to get flagged missed / re-materialized).
      const localRecurring = loadRecurringMeta()
      if (driveRecurring !== null && (driveRecurring.updatedAt || '') > (localRecurring.updatedAt || '')) {
        setRecurring(driveRecurring.defs)
        saveRecurringRaw(driveRecurring)
      } else if ((localRecurring.updatedAt || '') > (driveRecurring?.updatedAt || '')) {
        saveRecurringToDrive(token, localRecurring)
      } else if (driveRecurring === null && localRecurring.defs.length > 0) {
        // No Drive file yet — upload what we have locally.
        saveRecurringToDrive(token, localRecurring)
      }

      // Rumors — same whole-payload last-write-wins contract as recurring defs.
      const localRumors = loadRumorsMeta()
      if (driveRumors !== null && (driveRumors.updatedAt || '') > (localRumors.updatedAt || '')) {
        setRumors(driveRumors.items)
        saveRumorsRaw(driveRumors)
      } else if ((localRumors.updatedAt || '') > (driveRumors?.updatedAt || '')) {
        saveRumorsToDrive(token, localRumors)
      } else if (driveRumors === null && localRumors.items.length > 0) {
        saveRumorsToDrive(token, localRumors)
      }

      // One-time migration: fold notes from the retired "Quest Notes" feature
      // (qm_quest_notes, local-only, never Drive-synced) into Rumors. Runs
      // after the LWW reconciliation above so it merges into the authoritative
      // list, then removes the old key so it never repeats.
      try {
        const legacyNotes = JSON.parse(localStorage.getItem('qm_quest_notes') || 'null')
        if (Array.isArray(legacyNotes) && legacyNotes.length > 0) {
          const current = loadRumorsMeta().items
          const have = new Set(current.map(r => r.text))
          const converted = legacyNotes
            .filter(n => n.title && !have.has(n.title))
            .map((n, i) => ({ id: `rm_${Date.now()}_${i}`, text: n.title, createdAt: new Date().toLocaleDateString('en-CA') }))
          if (converted.length > 0) {
            const merged = [...current, ...converted]
            setRumors(merged)
            saveRumorsToDrive(token, saveRumors(merged))
          }
          localStorage.removeItem('qm_quest_notes')
        }
      } catch {}

      // Stats + contribution history — reconciled in the useStats hook.
      mergeStats(driveStats, driveStatHistory)
      mergeLocations(driveLocations)

      // Penalty ledger — keep the latest sweep date so a toll done on another
      // device today isn't repeated here. Merge happens in-ref (no React state).
      if (driveLedger) {
        const merged = mergeLedgers(penaltyLedgerRef.current, driveLedger)
        penaltyLedgerRef.current = merged
        saveLedger(merged)
        // Pick up a per-card toll breakdown rolled on ANOTHER device today —
        // this is what makes the badge appear here even when this device
        // wasn't the one that ran the sweep.
        if (merged.dailyPerItem?.date === todayStr()) {
          setPenaltyByItem(merged.dailyPerItem.perItem)
        }
      }

      // Task display order — last-write-wins by updatedAt so a stale poll can't
      // clobber a reorder this device just made.
      if (driveTaskOrder) {
        const local = loadTaskOrder()
        if ((driveTaskOrder.updatedAt || '') > (local.updatedAt || '')) {
          setTaskOrder(driveTaskOrder)
          saveTaskOrderRaw(driveTaskOrder)
        } else if ((local.updatedAt || '') > (driveTaskOrder.updatedAt || '')) {
          saveTaskOrderToDrive(token, local)
        }
      } else {
        const local = loadTaskOrder()
        if (local.order.length > 0) saveTaskOrderToDrive(token, local)
      }

      // First successful sync this session — recurring-quest materialization
      // was gated on this (see loadTasksAndEvents). If it already ran and
      // skipped materialization while waiting, retry now with fresh data.
      if (!driveSyncedRef.current) {
        driveSyncedRef.current = true
        loadTasksAndEvents()
      }
    }

    syncFromDrive()
    const poll = setInterval(syncFromDrive, 15000)

    // Sync immediately when the user returns to this device (switching from
    // browser to phone, reopening the PWA, refocusing the tab).
    function onVisible() {
      if (document.visibilityState === 'visible') syncFromDrive()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', syncFromDrive)

    return () => {
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', syncFromDrive)
    }
  }, [token])

  // Write game state to Drive immediately after each XP earn or reset so the
  // other device picks it up on its next poll without waiting for our sync cycle.
  const prevPointsRef = useRef(null)
  useEffect(() => {
    if (prevPointsRef.current === null) {
      prevPointsRef.current = { points, lifetimeXp }
      return
    }
    if (points !== prevPointsRef.current.points || lifetimeXp !== prevPointsRef.current.lifetimeXp) {
      prevPointsRef.current = { points, lifetimeXp }
      saveGameStateToDrive(token, gameStateRef.current)
    }
  }, [points, lifetimeXp])

  useEffect(() => {
    if (!showMenu) return
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  // Record visible missions, roll the day's toll once, apply XP/HP, and surface
  // the report. Guarded against re-entry (load fires on mount, focus, every 15s).
  async function runPenaltySweep(currentTasks, currentSubtasks, currentEvents) {
    // No penalties until the player has a character (also dodges the brief
    // pre-Drive-merge window where HP/gear aren't loaded yet).
    if (!character?.class || penaltyRunningRef.current) return
    penaltyRunningRef.current = true
    try {
      const prev = penaltyLedgerRef.current
      const withMissions = recordMissions(prev, currentEvents)
      const result = runPenaltyPass({
        tasks: currentTasks,
        subtasks: currentSubtasks,
        habits: loadHabits(),
        character,
        settings,
        ledger: withMissions,
        points,
        difficultyMemory,
      })
      const ledger = result.ledger
      const ledgerChanged = JSON.stringify(prev) !== JSON.stringify(ledger)
      penaltyLedgerRef.current = ledger
      if (ledgerChanged) {
        saveLedger(ledger)
        savePenaltyLedger(token, ledger)
      }
      if (ledger.dailyPerItem?.date === todayStr()) {
        setPenaltyByItem(ledger.dailyPerItem.perItem)
      }

      if (result.xpLost > 0) deductXP(result.xpLost)
      let died = false
      if (result.hpLost > 0) died = await damagePlayer(result.hpLost)
      if (result.hpLost > 0 || result.xpLost > 0) {
        setPenaltyReport({ ...result, died })
      }
    } finally {
      penaltyRunningRef.current = false
    }
  }

  // Level-based max HP growth: whenever the lifetimeXp-derived `level` moves
  // past character.hpLevel (the last level its HP bonus was applied for),
  // roll 2d10+10 per level gained and add it to both max and current HP.
  // Gated on driveSyncedRef for the same reason as recurring-quest
  // materialization above — a stale, not-yet-merged character.hpLevel could
  // otherwise double-roll a level-up already applied on another device.
  useEffect(() => {
    if (!character?.class || !driveSyncedRef.current || levelUpRunningRef.current) return
    const fromLevel = character.hpLevel || 1
    if (level <= fromLevel) return
    levelUpRunningRef.current = true
    applyLevelUps(level)
      .then(result => {
        if (!result) return
        const range = result.levelsGained > 1 ? `${result.fromLevel + 1}–${result.newLevel}` : `${result.newLevel}`
        setToast(`🎉 LEVEL UP! You are now Level ${range}! +${result.hpGained} Max HP (now ${result.newMaxHP})`)
      })
      .finally(() => { levelUpRunningRef.current = false })
  }, [level, character?.class, character?.hpLevel])

  const loadTasksAndEvents = useCallback(async () => {
    try {
      // Materialize recurring quests that are due today before fetching tasks
      // so they appear in the list without needing a second load.
      const currentRecurring = loadRecurring()
      const due = getDueToday(currentRecurring)
      // Guarded against re-entry: loadTasksAndEvents can be invoked again
      // (by another effect run, a Drive-sync-driven re-render, or a caller
      // elsewhere in this file) before this materialization pass finishes —
      // without this guard that reentrant call re-reads the same
      // not-yet-materialized `currentRecurring` snapshot and double-materializes
      // (the same class of bug as creatingQuestRef/creatingMissionRef above).
      //
      // Also gated on driveSyncedRef (bug fixed 2026-07-05): loadRecurring()
      // reads purely local storage. On a device whose local copy predates a
      // completion made on another device, this used to run BEFORE the Drive
      // fetch could deliver the real state, wrongly judging an
      // already-completed recurring quest as missed — deleting the completed
      // task, creating a duplicate, and charging an XP penalty for a miss
      // that never happened. Once getDueToday marks a def materialized for
      // today it won't retry, so the later-arriving correct data couldn't
      // undo it. Now this waits for the first Drive sync to land; syncFromDrive
      // retries this call once that happens.
      if (due.length > 0 && !materializingRecurringRef.current && driveSyncedRef.current) {
        materializingRecurringRef.current = true
        try {
        // Mark them materialized SYNCHRONOUSLY (before any await) and persist
        // to localStorage immediately. JS is single-threaded, so any concurrent
        // loadTasksAndEvents call that runs after this point reads the updated
        // flag and skips — preventing the duplicate-materialization storm.
        let updated = currentRecurring
        for (const def of due) updated = markMaterialized(updated, def.id)
        setRecurring(updated)
        saveRecurringToDrive(token, saveRecurring(updated))

        const missedTitles = []
        for (const def of due) {
          // def still has pre-mark values since due was built from currentRecurring
          const prevMaterialized = def.lastMaterializedDate
          const prevCompleted = def.lastCompletedDate || null
          const wasMissed = prevMaterialized !== null
            && def.lastTaskId
            && (prevCompleted === null || prevCompleted < prevMaterialized)
          try {
            if (wasMissed) {
              try { await deleteTask(token, def.lastTaskId) } catch {}
              updated = recordMiss(updated, def.id)
              missedTitles.push(def.title)
            }
            const todayDate = new Date().toLocaleDateString('en-CA')
            const newTask = await createTask(token, { title: def.title, dueTime: def.dueTime || undefined, notes: def.notes || undefined, reminderMinutes: def.reminderMinutes ?? undefined })
            updated = setLastTaskId(updated, def.id, newTask?.id || null)
            if (def.dueTime) {
              try { await createEvent(token, buildCompanionEvent(def.title, todayDate, def.dueTime, def.reminderMinutes ?? settings.defaultReminderMinutes)) } catch {}
            }
          } catch { /* don't block if one fails — better a missed quest than a dupe storm */ }
        }
        // Persist final state (with new lastTaskIds and miss records)
        setRecurring(updated)
        saveRecurringToDrive(token, saveRecurring(updated))
        // Apply dice XP penalty for missed recurring quests and optionally toast.
        if (missedTitles.length > 0) {
          const penalty = recurringMissPenalty({
            count: missedTitles.length,
            hardMode: settings.hardMode,
            character,
          })
          if (penalty > 0) deductXP(penalty)
          if (settings.showMissedQuestSummary ?? true) {
            const listed = missedTitles.map(t => `"${t}"`).join(', ')
            setToast(`⚠️ Missed: ${listed} — −${penalty} XP penalty`)
          }
        }
        } finally {
          materializingRecurringRef.current = false
        }
      }

      const crystalEquipped = Object.values(character?.equippedItems || {}).includes('crystal-ball')
      const fetchLookAhead = crystalEquipped ? Math.max(3, settings.missionLookAhead || 0) : (settings.missionLookAhead || 0)
      const [{ tasks: rawT, subtasksByParent: subs }, e] = await Promise.all([
        fetchTodaysTasks(token),
        fetchUpcomingEvents(token, fetchLookAhead),
      ])

      // Dedup: if multiple tasks share a title with a recurring def, keep the newest,
      // delete the rest. This handles the migration window when lastTaskId was newly
      // introduced (existing defs had null, so stale cleanup couldn't fire).
      let t = rawT
      {
        const latestRecurring = loadRecurring()
        const recurringTitleMap = new Map(
          latestRecurring
            .filter(d => d.title)
            .map(d => [d.title.toLowerCase(), d])
        )
        const grouped = new Map()
        for (const task of rawT) {
          const key = (task.title || '').toLowerCase()
          if (!recurringTitleMap.has(key)) continue
          if (!grouped.has(key)) grouped.set(key, [])
          grouped.get(key).push(task)
        }
        const staleIds = new Set()
        let dedupedRecurring = latestRecurring
        for (const [key, dupes] of grouped) {
          if (dupes.length <= 1) continue
          const sorted = [...dupes].sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))
          const keeper = sorted[0]
          for (const stale of sorted.slice(1)) {
            staleIds.add(stale.id)
            try { await deleteTask(token, stale.id) } catch {}
          }
          const def = recurringTitleMap.get(key)
          if (def) dedupedRecurring = setLastTaskId(dedupedRecurring, def.id, keeper.id)
        }
        if (staleIds.size > 0) {
          t = rawT.filter(task => !staleIds.has(task.id))
          setRecurring(dedupedRecurring)
          saveRecurringToDrive(token, saveRecurring(dedupedRecurring))
        }
      }

      setTasks(t)
      setSubtasksByParent(subs)
      setEvents(e)

      const allSubtasks = Object.values(subs).flat()

      // Record the first time each task is seen so coin decay can be computed.
      const today = new Date().toLocaleDateString('en-CA')
      const seen = readJson('qm_task_seen', {})
      let changed = false
      for (const task of [...t, ...allSubtasks]) {
        if (!seen[task.id]) { seen[task.id] = today; changed = true }
      }
      if (changed) writeJson('qm_task_seen', seen)
      setTaskSeenMap({ ...seen })
      setLoading(false)

      // Passive penalty sweep — the day's "toll" + any missions that have passed.
      runPenaltySweep(t, allSubtasks, e)

      const includeNotes = settings.sendNotesToLlm
      const currentRecurringDefs = loadRecurring()
      // A recurring quest materializes a brand-new Google Task id every day it
      // recurs, so theme by the stable def id instead — otherwise the exact
      // same title gets re-sent to Haiku every morning it comes back around.
      const defIdByTaskId = new Map(
        currentRecurringDefs.filter(d => d.lastTaskId).map(d => [d.lastTaskId, d.id])
      )
      const allItems = [
        ...t.map(task => ({
          id: task.id,
          cacheKey: defIdByTaskId.get(task.id),
          title: task.title,
          notes: includeNotes ? stripAuxTags(task.notes) || undefined : undefined,
        })),
        ...allSubtasks.map(task => ({
          id: task.id,
          title: task.title,
          notes: includeNotes ? stripAuxTags(task.notes) || undefined : undefined,
        })),
        ...e.map(event => ({
          id: event.id,
          title: event.summary || '',
          notes: includeNotes ? event.description : undefined,
        })),
        ...currentRecurringDefs.map(def => ({ id: def.id, title: def.title })),
      ].filter(item => item.title)

      if (allItems.length > 0) {
        setTheming(true)
        const { themes, suggestedDifficulties: suggested, statWeights } = await themeItems(allItems, glossary, stats, token)
        setThemedTitles(themes)
        setSuggestedDifficulties(suggested)
        setStatWeightsMap(prev => ({ ...prev, ...statWeights }))
        setTheming(false)
      }
    } catch (err) {
      setLoading(false)
      if (err.message?.includes('401') || err.message?.includes('403')) {
        handleSignOut()
      } else {
        setError(err.message)
      }
    }
  }, [token, glossary, settings.sendNotesToLlm, settings.missionLookAhead, character?.equippedItems, handleSignOut])

  useEffect(() => { loadTasksAndEvents() }, [loadTasksAndEvents])

  // Refetch quests + missions when the user returns to a long-idle tab.
  // The 15s Drive poll only covers game/app state — the Google Tasks/Calendar
  // lists themselves were fetched once on mount, so a tab left open overnight
  // (or while items were added on another device) showed a stale list forever.
  // Gated to ≥5 min since the last load so quick tab switches don't hammer the
  // APIs or re-trigger LLM theming.
  const lastLoadRef = useRef(Date.now())
  useEffect(() => { lastLoadRef.current = Date.now() }, [loadTasksAndEvents])
  useEffect(() => {
    const STALE_MS = 5 * 60 * 1000
    function refetchIfStale() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastLoadRef.current < STALE_MS) return
      lastLoadRef.current = Date.now()
      loadTasksAndEvents()
    }
    document.addEventListener('visibilitychange', refetchIfStale)
    window.addEventListener('focus', refetchIfStale)
    return () => {
      document.removeEventListener('visibilitychange', refetchIfStale)
      window.removeEventListener('focus', refetchIfStale)
    }
  }, [loadTasksAndEvents])

  // When recurring defs arrive from Drive (after syncFromDrive finishes),
  // loadTasksAndEvents may have already built its allItems list without them.
  // This effect catches any defs that still lack a themed title and themes them.
  useEffect(() => {
    if (!recurring.length) return
    const unthemed = recurring.filter(d => !themedTitles[d.id])
    if (!unthemed.length) return
    themeItems(unthemed.map(d => ({ id: d.id, title: d.title })), glossary, null, token)
      .then(({ themes }) => setThemedTitles(prev => ({ ...prev, ...themes })))
      .catch(() => {})
  }, [recurring]) // eslint-disable-line react-hooks/exhaustive-deps

  // earnStatXP / saveStat / deleteStat live in useStats. These thin wrappers keep
  // the editor-modal UI state (which Dashboard owns) in sync.
  function handleSaveStat(updatedStat) {
    saveStat(updatedStat)
    setShowStatEditor(false)
    setEditingStat(null)
  }

  function handleDeleteStat(statId) {
    deleteStat(statId)
    setShowStatEditor(false)
    setEditingStat(null)
  }

  // Shared reward pipeline used by both top-level quests and side quests.
  // Caller is responsible for optimistically removing the task from its list
  // before calling. Returns the toast string (caller decides whether to show it).
  async function completeQuest(taskObj, taskId, xp, coinValue, difficulty) {
    // XP: scroll double → class perk → tome bonus → flat XP bonuses from all equipped items
    const scrolled = xpDoubleActive
    if (scrolled) setXpDoubleActive(false)
    const baseXP = applyXpPerk(scrolled ? xp * 2 : xp, character.class, difficulty)
    const tomeBonus = getTomeBonus(character, baseXP)
    const eqIds = Object.values(character.equippedItems || {}).filter(Boolean)
    const xpFlatBonus = eqIds.reduce((sum, id) => sum + (ITEMS[id]?.xpFlatBonus || 0), 0)
    const finalXP = baseXP + tomeBonus + xpFlatBonus

    // Coins: per-difficulty perks, fortune proc, philosopher passive
    let finalCoins = coinValue
    if (difficulty === 'legendary') eqIds.forEach(id => { finalCoins += ITEMS[id]?.legendaryCoinsBonus || 0 })
    if (difficulty === 'normal')    eqIds.forEach(id => { finalCoins += ITEMS[id]?.normalCoinsBonus || 0 })
    const fortuned = eqIds.includes('fortune-amulet') && Math.random() < 0.1
    if (fortuned) finalCoins *= 2
    finalCoins += getPhilosopherBonus(character, finalXP)

    // Boss damage: equipped Cleric items deal bonus damage to the active boss per quest
    const bossHealAmount = eqIds.reduce((sum, id) => sum + (ITEMS[id]?.bossHealPerQuest || 0), 0)
    if (bossHealAmount > 0) {
      const target = habits.find(h => h.status === 'active')
      if (target && target.boss.currentHP > 0) {
        const updatedHabits = habits.map(h =>
          h.id === target.id ? { ...h, boss: { ...h.boss, currentHP: Math.max(1, h.boss.currentHP - bossHealAmount) } } : h
        )
        setHabits(updatedHabits)
        saveHabits(updatedHabits)
        saveToDrive(token, updatedHabits)
      }
    }

    completeTask(finalXP)
    earnCoins(finalCoins)
    earnStatXP(statWeightsMap[taskId], finalXP, themedTitles[taskId] || taskObj?.title)
    await markTaskComplete(token, taskId)

    // Move task to "Completed Today" section
    const entry = {
      task: taskObj,
      themedTitle: themedTitles[taskId] || null,
      xp: finalXP,
      coins: finalCoins,
      difficulty,
    }
    setCompletedTasks(prev => {
      const next = [entry, ...prev]
      const today = new Date().toLocaleDateString('en-CA')
      writeJson('qm_completed_today', { date: today, entries: next })
      return next
    })

    const notes = []
    if (scrolled) notes.push('×2 scroll')
    if (baseXP !== (scrolled ? xp * 2 : xp)) notes.push(`${CLASSES[character.class]?.name} perk`)
    if (tomeBonus) notes.push('📚 tome')
    if (fortuned) notes.push('🍀 fortune!')
    const note = notes.length ? ` (${notes.join(', ')})` : ''
    return { finalXP, finalCoins, note }
  }

  // Deducts HP from the player, triggers reincarnation at 0. Returns true if died.
  async function handleComplete(taskId, xp, coinValue, difficulty) {
    try {
      const taskObj = tasks.find(t => t.id === taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
      const { finalXP, finalCoins, note } = await completeQuest(taskObj, taskId, xp, coinValue, difficulty)
      // Record completion for any recurring def that materialized this task
      const matchingDef = recurring.find(d => d.lastTaskId === taskId)
      if (matchingDef) {
        const updatedRecurring = recordCompletion(recurring, matchingDef.id)
        setRecurring(updatedRecurring)
        saveRecurringToDrive(token, saveRecurring(updatedRecurring))
      }
      // Completing a quest no longer costs HP — overdue cost is now the passive
      // daily toll (runPenaltySweep), so finishing late is rewarded, not punished.
      setToast(`⚔️ Quest Complete! +${finalXP} XP${note}  +${finalCoins} 🪙`)
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
  }

  async function handleCompleteSubtask(parentId, taskId, xp, coinValue, difficulty) {
    try {
      const taskObj = (subtasksByParent[parentId] || []).find(s => s.id === taskId)
      let remaining = 0
      setSubtasksByParent(prev => {
        const next = { ...prev }
        const list = (next[parentId] || []).filter(s => s.id !== taskId)
        remaining = list.length
        if (list.length) next[parentId] = list
        else delete next[parentId]
        return next
      })
      const { finalXP, finalCoins, note } = await completeQuest(taskObj, taskId, xp, coinValue, difficulty)
      if (remaining === 0) {
        setToast(`✨ All side quests cleared! +${finalXP} XP${note}  +${finalCoins} 🪙 — the main quest awaits.`)
      } else {
        setToast(`⚔️ Side Quest done! +${finalXP} XP${note}  +${finalCoins} 🪙  (${remaining} left)`)
      }
    } catch (err) {
      console.error('Failed to complete side quest:', err)
    }
  }

  function handleOpenSideQuests(taskObj) {
    setSideQuestParent(taskObj)
  }

  // Drag-to-reorder (undated quests only). `orderedTasks` is the displayed list.
  function handleDragEnd(result) {
    const { source, destination } = result
    if (!destination || destination.index === source.index) return
    const displayedIds = orderedTasks.map(t => t.id)
    const newIds = reorderIds(displayedIds, source.index, destination.index)
    const payload = saveTaskOrder(newIds)   // writes localStorage with fresh updatedAt
    setTaskOrder(payload)
    saveTaskOrderToDrive(token, payload)
  }

  async function handleCreateSideQuests(parentId, sideQuests) {
    const created = []
    for (const sq of sideQuests) {
      try {
        const sub = await createSubtask(token, parentId, sq)
        created.push(sub)
      } catch (err) {
        console.error('Failed to create side quest:', err)
      }
    }
    if (created.length) {
      // Google returns subtasks in reverse insert order; sort by position on reload.
      setSubtasksByParent(prev => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), ...created],
      }))
      setToast(`⚡ ${created.length} side quest${created.length > 1 ? 's' : ''} added!`)
      loadTasksAndEvents() // refetch to get correct order + theme the new subtasks
    }
    setSideQuestParent(null)
  }

  async function handleSaveSubtask(parentId, taskId, data) {
    await updateTask(token, taskId, data)
    const current = subtasksByParent[parentId] || []
    const updated = current.map(s =>
      s.id === taskId
        ? { ...s, title: data.title, due: data.due ? new Date(`${data.due}T00:00:00Z`).toISOString() : null, notes: data.notes || '' }
        : s
    )
    const sorted = sortSubtasksByDate(updated)
    const needsSort = sorted.some((s, i) => s.id !== updated[i].id)
    setSubtasksByParent(prev => ({ ...prev, [parentId]: needsSort ? sorted : updated }))
    setEditingSubtask(null)
    if (needsSort) {
      setToast('✏️ Side quest updated & re-sorted by date.')
      persistSubtaskOrder(parentId, sorted)
    } else {
      setToast('✏️ Side quest updated.')
    }
    loadTasksAndEvents()
  }

  async function handleDeleteSubtaskFromEdit(parentId, taskId) {
    await deleteTask(token, taskId)
    setSubtasksByParent(prev => {
      const next = { ...prev }
      const list = (next[parentId] || []).filter(s => s.id !== taskId)
      if (list.length) next[parentId] = list
      else delete next[parentId]
      return next
    })
    setEditingSubtask(null)
    setToast('🗑 Side quest removed.')
  }

  function sortSubtasksByDate(subs) {
    const dated = subs.filter(s => s.due).sort((a, b) => new Date(a.due) - new Date(b.due))
    const undated = subs.filter(s => !s.due)
    return [...dated, ...undated]
  }

  async function persistSubtaskOrder(parentId, orderedSubs) {
    for (let i = 0; i < orderedSubs.length; i++) {
      const previousId = i > 0 ? orderedSubs[i - 1].id : null
      try {
        await moveSubtask(token, orderedSubs[i].id, { parentId, previousId })
      } catch (err) {
        console.error('Failed to persist side quest order:', err)
      }
    }
  }

  async function handleSubtaskDragEnd(parentId, sourceIndex, destIndex) {
    const subs = subtasksByParent[parentId] || []
    const reordered = [...subs]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(destIndex, 0, moved)
    setSubtasksByParent(prev => ({ ...prev, [parentId]: reordered }))
    persistSubtaskOrder(parentId, reordered)
  }

  async function handleDeleteSubtask(parentId, taskId) {
    setSubtasksByParent(prev => {
      const next = { ...prev }
      const list = (next[parentId] || []).filter(s => s.id !== taskId)
      if (list.length) next[parentId] = list
      else delete next[parentId]
      return next
    })
    try {
      await deleteTask(token, taskId)
    } catch (err) {
      console.error('Failed to delete side quest:', err)
    }
  }

  async function handleRestoreTask(entry) {
    try {
      await markTaskIncomplete(token, entry.task.id)
      uncompleteTask(entry.xp)
      removeCoins(entry.coins)
      // A restored side quest goes back under its parent, not the top-level list.
      if (entry.task.parent) {
        setSubtasksByParent(prev => ({
          ...prev,
          [entry.task.parent]: [...(prev[entry.task.parent] || []), entry.task],
        }))
      } else {
        setTasks(prev => [entry.task, ...prev])
      }
      setCompletedTasks(prev => {
        const next = prev.filter(e => e.task.id !== entry.task.id)
        const today = new Date().toLocaleDateString('en-CA')
        writeJson('qm_completed_today', { date: today, entries: next })
        return next
      })
      setToast(`↩ "${entry.themedTitle || entry.task.title}" restored`)
    } catch (err) {
      console.error('Failed to restore task:', err)
    }
  }

  // Reads the coin ledger from localStorage (written synchronously by spendCoins/earnCoins)
  // and immediately pushes it to Drive so the other device sees it on its next poll.
  async function flushCoinsToD() {
    const ce = readNum('qm_coins_earned')
    const cs = readNum('qm_coins_spent')
    await saveGameStateToDrive(token, { ...gameStateRef.current, coinsEarned: ce, coinsSpent: cs, coins: Math.max(0, ce - cs) })
  }

  async function handleBuyItem(itemId) {
    const item = ITEMS[itemId]
    if (!item || coins < item.cost) return
    let updated
    if (item.consumable) {
      const consumables = { ...(character.consumables || {}), [itemId]: ((character.consumables || {})[itemId] || 0) + 1 }
      updated = { ...character, consumables }
    } else {
      if (character.ownedItems.includes(itemId)) return
      updated = { ...character, ownedItems: [...character.ownedItems, itemId] }
    }
    spendCoins(item.cost)
    await Promise.all([commitCharacter(updated), flushCoinsToD()])
    setToast(`🛒 ${item.name} purchased!`)
  }

  function handleEquipItem(itemId) {
    const item = equipItem(itemId)
    if (item) setToast(`${item.emoji} ${item.name} equipped!`)
  }

  function handleUnequipItem(itemId) {
    const item = unequipItem(itemId)
    if (item) setToast(`${item.emoji} ${item.name} unequipped`)
  }

  async function handleUseConsumable(itemId) {
    const item = ITEMS[itemId]
    const count = (character.consumables || {})[itemId] || 0
    if (!item?.consumable || count <= 0) return

    // Start from the consumable decremented; branches layer their effect onto
    // the same object so a single commit carries both (no stale-state clobber).
    const consumables = { ...(character.consumables || {}), [itemId]: count - 1 }
    if (consumables[itemId] <= 0) delete consumables[itemId]
    let updated = { ...character, consumables }

    if (item.playerHeal) {
      const maxHP = character.maxHP ?? 100
      const current = character.currentHP ?? maxHP
      const healed = Math.min(maxHP, current + item.playerHeal)
      updated = { ...updated, currentHP: healed }
      setToast(`${item.emoji} Restored +${healed - current} HP! (${healed}/${maxHP})`)
    } else if (item.bossDamage) {
      const target = habits.find(h => h.status === 'active')
      if (!target) { setToast('No active bosses to target!'); return }
      const newHP = Math.max(1, target.boss.currentHP - item.bossDamage) // can't land killing blow
      const updatedHabits = habits.map(h => h.id === target.id ? { ...h, boss: { ...h.boss, currentHP: newHP } } : h)
      setHabits(updatedHabits); saveHabits(updatedHabits); saveToDrive(token, updatedHabits)
      setToast(`${item.emoji} ${target.boss.name} weakened to ${newHP} HP! Finish it off.`)
    } else if (item.xpDouble) {
      setXpDoubleActive(true)
      setToast(`${item.emoji} Active — next Quest earns double XP!`)
    } else if (item.flavorOnly) {
      setToast(item.flavorText || `${item.emoji} ${item.name} used.`)
    }

    await commitCharacter(updated)
  }

  async function handleSellItem(itemId) {
    const item = ITEMS[itemId]
    if (!item) return
    const sellPrice = Math.floor(item.cost / 2)
    let updated = { ...character }

    if (item.consumable) {
      const count = (character.consumables || {})[itemId] || 0
      if (count <= 0) return
      const consumables = { ...(character.consumables || {}), [itemId]: count - 1 }
      if (consumables[itemId] <= 0) delete consumables[itemId]
      updated = { ...updated, consumables }
    } else {
      if (!character.ownedItems.includes(itemId)) return
      updated = { ...updated, ownedItems: character.ownedItems.filter(id => id !== itemId) }
      // Unequip if this item was in any slot (rings can be in ring-1 or ring-2)
      if (item.slot) {
        const newEquipped = { ...updated.equippedItems }
        if (item.slot === 'ring') {
          if (newEquipped['ring-1'] === itemId) newEquipped['ring-1'] = null
          if (newEquipped['ring-2'] === itemId) newEquipped['ring-2'] = null
        } else if (newEquipped[item.slot] === itemId) {
          newEquipped[item.slot] = null
        }
        updated = { ...updated, equippedItems: newEquipped }
      }
    }

    earnCoins(sellPrice)
    await Promise.all([commitCharacter(updated), flushCoinsToD()])
    setToast(`💰 Sold ${item.name} for ${sellPrice} 🪙`)
  }

  async function handleCreateQuest(data) {
    // Guards against a double-tap/double-invocation firing this twice (same
    // class of bug fixed for handleCreateMission) — without it, a re-entrant
    // call creates both the task AND its companion calendar event twice,
    // showing up as an overlapping duplicate on Google Calendar.
    if (creatingQuestRef.current) return
    creatingQuestRef.current = true
    try {
      const created = await createTask(token, data)
      if (data.due && data.dueTime) {
        try { await createEvent(token, buildCompanionEvent(data.title, data.due, data.dueTime, data.reminderMinutes)) } catch {}
      }
      // Immediately slot the new task into the saved order so computeDisplayOrder
      // places it at the right end rather than wherever the API returns it.
      if (created?.id) {
        setTaskOrder(prev => {
          const existing = prev.order.filter(id => id !== created.id)
          const next = settings.newQuestPosition === 'top'
            ? [created.id, ...existing]
            : [...existing, created.id]
          const payload = saveTaskOrder(next)
          saveTaskOrderToDrive(token, payload)
          return payload
        })
      }
      setShowCreateQuest(false)
      setCreateQuestInitialData(null)
      if (convertingRumorId) {
        handleDeleteRumor(convertingRumorId)
        setConvertingRumorId(null)
      }
      setToast(`⚔️ Quest summoned: ${data.title}`)
      loadTasksAndEvents()
    } finally {
      creatingQuestRef.current = false
    }
  }

  function handleCreateRecurringFromModal({ title, notes, days, dueTime, reminderMinutes }) {
    handleCreateRecurring({ title, notes, days, dueTime, reminderMinutes })
    setShowCreateQuest(false)
    setCreateQuestInitialData(null)
    if (convertingRumorId) {
      handleDeleteRumor(convertingRumorId)
      setConvertingRumorId(null)
    }
  }

  async function handleCreateMission(data) {
    if (creatingMissionRef.current) return
    creatingMissionRef.current = true
    try {
      await createEvent(token, data)
      setShowCreateMission(false)
      setToast(`📅 Mission inscribed: ${data.title}`)
      loadTasksAndEvents()
    } finally {
      creatingMissionRef.current = false
    }
  }

  async function handleSelectClass(classId) {
    const { unequipped } = await selectClass(classId)
    setShowCharacterSelect(false)
    const cls = CLASSES[classId]
    setToast(`${cls.emoji} You are now a ${cls.name}!`)
    if (unequipped.length) {
      setTimeout(() => setToast(`⚠️ Unequipped: ${unequipped.join(', ')} (incompatible with ${cls.name})`), 2200)
    }
  }

  async function handleSaveTask(taskId, data) {
    // Detect the "push the deadline to dodge penalties" cheat BEFORE the write,
    // while editingTask still holds the original due date.
    const pen = dueChangePenalty({
      oldDue: dueDateOnly(editingTask?.due),
      newDue: data.due,
      hardMode: settings.hardMode,
      character,
    })

    // Preserve the existing checklist — this modal doesn't edit it, and
    // updateTask rebuilds notes from scratch, so omitting it would wipe it.
    await updateTask(token, taskId, { ...data, checklist: parseChecklist(editingTask?.notes) })
    // Only create a new companion event if the time, date, or reminder lead
    // time actually changed — prevents stale companion events from
    // accumulating in Google Calendar on every title/notes edit of a timed
    // quest.
    const oldTime = parseQuestTime(editingTask?.notes)
    const oldReminder = parseQuestReminder(editingTask?.notes)
    const oldDue = dueDateOnly(editingTask?.due)
    const timeChanged = data.dueTime !== oldTime
    const dateChanged = (data.due || null) !== oldDue
    const reminderChanged = (data.reminderMinutes ?? null) !== (oldReminder ?? null)
    if (data.due && data.dueTime && (timeChanged || dateChanged || reminderChanged)) {
      try { await createEvent(token, buildCompanionEvent(data.title, data.due, data.dueTime, data.reminderMinutes)) } catch {}
    }

    // Remember the new due date so a later push can be detected again.
    const ledger = {
      ...penaltyLedgerRef.current,
      dueDates: { ...penaltyLedgerRef.current.dueDates, [taskId]: data.due || null },
    }
    penaltyLedgerRef.current = ledger
    saveLedger(ledger)
    savePenaltyLedger(token, ledger)

    setEditingTask(null)
    if (pen) {
      if (pen.xp > 0) deductXP(pen.xp)
      let died = false
      if (pen.hp > 0) died = await damagePlayer(pen.hp)
      setToast(died
        ? `⏳ Deadline pushed — −${pen.xp} XP, and the strain felled you! Equipment lost, reincarnated.`
        : `⏳ Deadline pushed past due — double toll: −${pen.xp} XP, −${pen.hp} ❤️ HP`)
    } else {
      setToast('✏️ Quest updated.')
    }
    loadTasksAndEvents()
  }

  // Narrow save used by the checklist popup — only ever touches the
  // checklist tag inside notes (see updateTaskChecklist), so it can't
  // clobber the title/due/reminder the way a full updateTask would.
  async function handleSaveChecklist(taskId, items) {
    const taskObj = tasks.find(t => t.id === taskId)
    if (!taskObj) return
    const updated = await updateTaskChecklist(token, taskId, taskObj.notes, items)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes: updated.notes } : t))
  }

  async function handleDeleteTask(taskId) {
    await deleteTask(token, taskId)
    setEditingTask(null)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setToast('🗑 Quest removed.')
  }

  async function handleSaveEvent(eventId, data) {
    await updateEvent(token, eventId, data)
    setEditingEvent(null)
    setToast('✏️ Mission updated.')
    loadTasksAndEvents()
  }

  // eventId is either a single event/instance id, or — when deleting a whole
  // recurring series — the series master's id (the instance's recurringEventId).
  // The filter drops both the id itself and any listed instances of that series.
  async function handleDeleteEvent(eventId, { series = false } = {}) {
    await deleteEvent(token, eventId)
    setEditingEvent(null)
    setEvents(prev => prev.filter(e => e.id !== eventId && e.recurringEventId !== eventId))
    setToast(series ? '🗑 Mission and all its repeats removed.' : '🗑 Mission removed.')
  }

  function getEffectiveDifficulty(id) {
    return getDifficulty(id, difficultyMemory) || suggestedDifficulties[id] || 'normal'
  }

  async function handleDifficultyChange(id, _originalTitle, newTier) {
    // Optimistic local update so the badge changes instantly.
    const optimistic = setDifficultyInMemory(id, newTier, difficultyMemory)
    setDifficultyMemory(optimistic)
    saveDifficultyMemory(optimistic)
    setSuggestedDifficulties(prev => ({ ...prev, [id]: newTier }))

    // Read-modify-write: pull the latest from Drive and merge our single change
    // on top, so a near-simultaneous edit on the other device isn't clobbered.
    // Use the remote file as the base (not our full local memory) so stale keys
    // don't get re-propagated; fall back to local only if the read failed.
    const { memory: remote, error: remoteErr } = await loadDifficulties(token)
    const base = remoteErr ? optimistic : (remote || {})
    const merged = { ...base, [id]: newTier }
    setDifficultyMemory(merged)
    saveDifficultyMemory(merged)
    const result = await saveDifficulties(token, merged)
    if (!result?.ok) {
      const expired = (() => {
        const expiry = localStorage.getItem('qm_token_expiry')
        return !expiry || Date.now() >= Number(expiry)
      })()
      if (expired || result?.status === 401 || result?.status === 403) {
        setToast('⚠️ Session expired — signing you out. Sign back in to sync.')
        setTimeout(onSignOut, 2000)
      } else {
        setToast('⚠️ Drive sync failed — difficulty saved locally only.')
      }
    }
  }

  async function handleSaveGlossary(text) {
    await saveGlossary(token, text)
    setGlossary(text)
    clearThemeCache()
    setToast('📜 Glossary saved — new items will use updated translations.')
  }

  async function handleSaveSettings(next) {
    setSettings(next)
    saveSettings(next)
    setShowSettings(false)
    setToast('⚙️ Settings saved.')
    saveSettingsToDrive(token, next)
  }

  // Mission look-ahead filter — persists in settings (synced via Drive) and the
  // missionLookAhead useCallback dep triggers a re-fetch of the wider window.
  function handleSetLookAhead(days) {
    if ((settings.missionLookAhead || 0) === days) return
    const next = { ...settings, missionLookAhead: days }
    setSettings(next)
    saveSettings(next)
    saveSettingsToDrive(token, next)
  }

  // View mode: "split" keeps Today's Quests / Missions separate, "full" merges
  // quests + missions into one urgency-sorted list. Takes an explicit target so
  // the segmented toggle can set a mode rather than blind-flipping it.
  function handleSetCombinedView(combined) {
    if (combined === settings.combinedView) return
    const next = { ...settings, combinedView: combined }
    setSettings(next)
    saveSettings(next)
    saveSettingsToDrive(token, next)
  }

  async function handleReThemeAll() {
    clearThemeCache()
    await saveThemeCache(token, {})
    setThemedTitles({})
    setShowSettings(false)

    const includeNotes = settings.sendNotesToLlm
    const allItems = [
      ...tasks.map(t => ({ id: t.id, title: t.title, notes: includeNotes ? t.notes : undefined })),
      ...events.map(e => ({ id: e.id, title: e.summary || '', notes: includeNotes ? e.description : undefined })),
    ].filter(item => item.title)

    if (allItems.length > 0) {
      setTheming(true)
      try {
        const { themes, suggestedDifficulties: suggested } = await themeItems(allItems, glossary, null, token)
        setThemedTitles(themes)
        setSuggestedDifficulties(suggested)
        const newCache = getThemeCacheAll()
        if (Object.keys(newCache).length > 0) saveThemeCache(token, newCache)
        setToast('✨ All titles re-enchanted!')
      } catch {
        setToast('✨ Re-theme failed — try again.')
      } finally {
        setTheming(false)
      }
    }
  }

  function handleClaim(eventId, xp, coinValue) {
    // coinValue is already fully adjusted (ranger + item bonuses applied in render)
    claimEvent(eventId, xp, coinValue)
    earnCoins(coinValue)
    const eventTitle = events.find(e => e.id === eventId)?.summary || ''
    earnStatXP(statWeightsMap[eventId], xp, eventTitle)
    // Attended → settle the mission so it never incurs a past-due penalty.
    const ledger = resolveMission(penaltyLedgerRef.current, eventId)
    penaltyLedgerRef.current = ledger
    saveLedger(ledger)
    savePenaltyLedger(token, ledger)
    setToast(`🔮 Mission Claimed! +${xp} XP  +${coinValue} 🪙`)
  }

  function handleUnclaimEvent(eventId) {
    unclaimEvent(eventId) // reads stored xp+coins from claimedEvents.claims, reverses both
    setToast('↩ Mission unclaimed')
  }

  function isEventClaimed(eventId) {
    return claimedEvents?.ids?.includes(eventId) || false
  }

  function handleCreateHabit(habitData) {
    const newHabit = createHabitObj(habitData)
    const updated = [...habits, newHabit]
    setHabits(updated)
    saveHabits(updated)
    saveToDrive(token, updated)
    setShowCreateHabit(false)
    setToast(`🐉 ${newHabit.boss.name} has been summoned!`)
  }

  async function handleHabitComplete(habitId) {
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return

    const newHP = Math.max(0, habit.boss.currentHP - 1)
    const action = newHP === 0 ? 'defeat' : 'progress'

    let narrative = null
    try {
      const res = await fetch('/api/habit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action,
          habit: habit.themedTitle,
          boss: habit.boss.name,
          hpRemaining: newHP,
        }),
      })
      const data = await res.json()
      narrative = data.narrative || null
    } catch {
      // fall back to no narrative update
    }

    const updated = completeHabitObj(habits, habitId, narrative)
    setHabits(updated)
    saveHabits(updated)
    saveToDrive(token, updated)

    const finished = updated.find(h => h.id === habitId)
    if (finished?.status === 'defeated') {
      playBossDefeat()
      setToast(`💀 ${finished.boss.name} DEFEATED! Habit forged!`)
    } else {
      playBossStrike()
      setToast(`🐉 ${finished?.boss.name} struck! ${newHP} HP remaining`)
    }
  }

  function handlePauseHabit(habitId) {
    const updated = pauseHabit(habits, habitId)
    setHabits(updated)
    saveHabits(updated)
    saveToDrive(token, updated)
    setToast('⏸ Boss paused — no penalties while on hold.')
  }

  function handleResumeHabit(habitId) {
    const updated = resumeHabit(habits, habitId)
    setHabits(updated)
    saveHabits(updated)
    saveToDrive(token, updated)
    setToast('▶ Boss resumed — the battle continues!')
  }

  function handleDeleteHabit(habitId) {
    const habit = habits.find(h => h.id === habitId)
    const updated = deleteHabit(habits, habitId)
    setHabits(updated)
    saveHabits(updated)
    saveToDrive(token, updated)
    setToast(`🗑 ${habit?.boss?.name || 'Boss'} dismissed.`)
  }

  function handleResetHabit(habitId) {
    const habit = habits.find(h => h.id === habitId)
    const updated = resetHabit(habits, habitId)
    setHabits(updated)
    saveHabits(updated)
    saveToDrive(token, updated)
    setToast(`↺ ${habit?.boss?.name || 'Boss'} restarted — back to day one!`)
  }

  function handleReincarnate(defeatedHabit) {
    const newHabit = createHabitObj({
      title: defeatedHabit.title,
      themedTitle: defeatedHabit.themedTitle,
      bossName: defeatedHabit.boss.name,
      bossDescription: defeatedHabit.boss.description,
    })
    const updated = [...habits, newHabit]
    setHabits(updated)
    saveHabits(updated)
    saveToDrive(token, updated)
    setShowBossJournal(false)
    setView('bosses')
    setToast(`🐉 ${newHabit.boss.name} has returned for a rematch!`)
  }

  function handleCreateRecurring({ title, notes, days, dueTime, reminderMinutes }) {
    const def = createRecurringDef({ title, notes, days, dueTime, reminderMinutes })
    const updated = [...recurring, def]
    setRecurring(updated)
    saveRecurringToDrive(token, saveRecurring(updated))
    const timeStr = dueTime ? ` at ${formatQuestTime(dueTime)}` : ''
    setToast(`🔄 "${title}" will repeat ${scheduleLabel(days)}${timeStr}`)
  }

  function handleDeleteRecurring(id) {
    const updated = recurring.filter(d => d.id !== id)
    setRecurring(updated)
    saveRecurringToDrive(token, saveRecurring(updated))
  }

  function handleToggleRecurring(id) {
    const updated = recurring.map(d => d.id === id ? { ...d, active: !d.active } : d)
    setRecurring(updated)
    saveRecurringToDrive(token, saveRecurring(updated))
  }

  function handleAddRumor(e) {
    e.preventDefault()
    const text = rumorDraft.trim()
    if (!text) return
    const updated = [...rumors, createRumor(text)]
    setRumors(updated)
    saveRumorsToDrive(token, saveRumors(updated))
    setRumorDraft('')
    rumorInputRef.current?.focus()
  }

  function handleDeleteRumor(id) {
    const updated = rumors.filter(r => r.id !== id)
    setRumors(updated)
    saveRumorsToDrive(token, saveRumors(updated))
  }

  function handleConvertRumor(rumor) {
    setCreateQuestInitialData({ title: rumor.text })
    setConvertingRumorId(rumor.id)
    setShowCreateQuest(true)
  }

  function handleResetAllBossStats() {
    const updated = resetAllBossStats(habits)
    setHabits(updated)
    saveHabits(updated)
    saveToDrive(token, updated)
    setToast('↺ All boss encounters restarted.')
  }

  const activeHabits = habits.filter(h => h.status === 'active')
  const pausedHabits = habits.filter(h => h.status === 'paused')
  const defeatedHabits = habits.filter(h => h.status === 'defeated')
  const canAddHabit = activeHabits.length < 3

  // Display order: auto-sort by urgency when enabled, otherwise manual+date order.
  const orderedTasks = settings.autoSort
    ? computeAutoSortOrder(tasks, taskSeenMap)
    : computeDisplayOrder(tasks, taskOrder.order)

  // Mission look-ahead window + day grouping for the multi-day view.
  // Crystal Ball (off-hand) forces a minimum of 3 days even if the user hasn't expanded manually.
  const crystalBallEquipped = Object.values(character?.equippedItems || {}).includes('crystal-ball')
  const lookAhead = crystalBallEquipped ? Math.max(3, settings.missionLookAhead || 0) : (settings.missionLookAhead || 0)
  const groupedEvents = lookAhead > 0 ? groupEventsByDay(events) : null

  // "Full List" combined view: quests + missions interleaved by urgency,
  // claimed missions filtered out (they live in the shared completed bucket instead).
  const unclaimedEvents = events.filter(e => !isEventClaimed(e.id))
  const combinedOrder = settings.combinedView
    ? computeCombinedOrder(tasks, unclaimedEvents, taskSeenMap)
    : null
  const combinedCompletedEntries = settings.combinedView
    ? [
        ...completedTasks.map(entry => ({
          type: 'quest',
          id: entry.task.id,
          label: entry.themedTitle || entry.task.title || '(Quest)',
          xp: entry.xp,
          entry,
        })),
        ...events.filter(e => isEventClaimed(e.id)).map(event => ({
          type: 'mission',
          id: event.id,
          label: themedTitles[event.id] || event.summary || '(Mission)',
          xp: claimedEvents?.claims?.[event.id]?.xp ?? 0,
          event,
        })),
      ]
    : []

  const renderTaskItem = (task, index, dragHandleProps = null) => (
    <TaskItem
      key={task.id}
      task={task}
      themedTitle={themedTitles[task.id]}
      difficulty={getEffectiveDifficulty(task.id)}
      coinValue={computeCoins(task.id, getEffectiveDifficulty(task.id), taskSeenMap, character.class)}
      diceBonus={classDiceBonus(character.class) + getItemDiceBonus(character)}
      revealMs={settings.revealMs || 5000}
      onComplete={handleComplete}
      onDifficultyChange={handleDifficultyChange}
      onEdit={() => setEditingTask(task)}
      subtasks={subtasksByParent[task.id] || []}
      themedTitles={themedTitles}
      getEffectiveDifficulty={getEffectiveDifficulty}
      taskSeenMap={taskSeenMap}
      characterClass={character.class}
      onCompleteSubtask={handleCompleteSubtask}
      onDeleteSubtask={handleDeleteSubtask}
      onEditSubtask={(sub) => setEditingSubtask({ sub, parentId: task.id })}
      onSubtaskDragEnd={handleSubtaskDragEnd}
      onAddSideQuests={() => handleOpenSideQuests(task)}
      onOpenChecklist={() => setChecklistTask(task)}
      dragHandleProps={dragHandleProps}
      isDated={Boolean(task.due)}
      penaltyByItem={penaltyByItem}
      cardIndex={index}
    />
  )

  const renderEventItem = (event, index) => (
    <EventItem
      key={event.id}
      event={event}
      themedTitle={themedTitles[event.id]}
      claimed={isEventClaimed(event.id)}
      claimedXp={claimedEvents?.claims?.[event.id]?.xp ?? null}
      difficulty={getEffectiveDifficulty(event.id)}
      coinValue={applyRangerMissionBonus(BASE_COIN_VALUE[getEffectiveDifficulty(event.id)] || BASE_COIN_VALUE.normal, character.class) + getItemMissionBonus(character)}
      revealMs={settings.revealMs || 5000}
      onClaim={handleClaim}
      onUnclaim={handleUnclaimEvent}
      onDifficultyChange={handleDifficultyChange}
      onEdit={() => setEditingEvent(event)}
      penaltyByItem={penaltyByItem}
      cardIndex={index}
    />
  )

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  function getStreakBanner() {
    if (streak === 0 && !completedToday) return null
    if (completedToday) return { text: `Day ${streak} streak secured! ✓`, type: 'success' }
    return { text: `Complete a quest to keep your ${streak}-day streak alive!`, type: 'warning' }
  }

  const streakBanner = getStreakBanner()

  return (
    <div className="dashboard">
      <audio ref={bgmRef} src={BGM_SRC} loop preload="auto" style={{ display: 'none' }} />
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {penaltyReport && (
        <PenaltyReportModal report={penaltyReport} onClose={() => setPenaltyReport(null)} />
      )}
      {showCreateHabit && (
        <CreateHabitModal
          onClose={() => setShowCreateHabit(false)}
          onCreate={handleCreateHabit}
          token={token}
        />
      )}
      {showCreateQuest && (
        <CreateQuestModal
          onClose={() => {
            setShowCreateQuest(false)
            setCreateQuestInitialData(null)
            setConvertingRumorId(null)
          }}
          onCreate={handleCreateQuest}
          onCreateRecurring={handleCreateRecurringFromModal}
          defaultReminderMinutes={settings.defaultReminderMinutes}
          initialData={createQuestInitialData}
        />
      )}
      {showCreateMission && (
        <CreateMissionModal
          onClose={() => setShowCreateMission(false)}
          onCreate={handleCreateMission}
          defaultReminderMinutes={settings.defaultReminderMinutes}
        />
      )}
      {sideQuestParent && (
        <SideQuestModal
          parentTask={sideQuestParent}
          parentThemedTitle={themedTitles[sideQuestParent.id]}
          onCreate={handleCreateSideQuests}
          onClose={() => setSideQuestParent(null)}
          token={token}
        />
      )}
      {editingTask && (
        <EditQuestModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          defaultReminderMinutes={settings.defaultReminderMinutes}
        />
      )}
      {checklistTask && (
        <ChecklistModal
          task={checklistTask}
          checklist={parseChecklist(checklistTask.notes)}
          onClose={() => setChecklistTask(null)}
          onSave={handleSaveChecklist}
        />
      )}
      {editingSubtask && (
        <EditQuestModal
          task={editingSubtask.sub}
          onClose={() => setEditingSubtask(null)}
          onSave={(taskId, data) => handleSaveSubtask(editingSubtask.parentId, taskId, data)}
          onDelete={(taskId) => handleDeleteSubtaskFromEdit(editingSubtask.parentId, taskId)}
          defaultReminderMinutes={settings.defaultReminderMinutes}
        />
      )}
      {editingEvent && (
        <EditMissionModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          defaultReminderMinutes={settings.defaultReminderMinutes}
        />
      )}
      {showGlossary && (
        <GlossaryModal
          glossary={glossary}
          onSave={handleSaveGlossary}
          onClose={() => setShowGlossary(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onReThemeAll={handleReThemeAll}
          onClose={() => setShowSettings(false)}
          token={token}
          buildInfo={typeof __BUILD_STAMP__ !== 'undefined' ? __BUILD_STAMP__ : 'dev'}
          bgmStatus={describeBgmState()}
        />
      )}
      {showCharacterSelect && (
        <CharacterSelectModal
          currentClass={character.class}
          onSelect={handleSelectClass}
          onClose={() => setShowCharacterSelect(false)}
        />
      )}
      {showBossJournal && (
        <BossJournalModal
          defeatedHabits={defeatedHabits}
          onReincarnate={handleReincarnate}
          onClose={() => setShowBossJournal(false)}
        />
      )}

      {showStatEditor && (
        <StatEditorModal
          stat={editingStat}
          onSave={handleSaveStat}
          onDelete={handleDeleteStat}
          onClose={() => { setShowStatEditor(false); setEditingStat(null) }}
        />
      )}

      {helpTopic && <HelpModal topic={helpTopic} onClose={() => setHelpTopic(null)} />}

      {showInventory && (
        <InventoryModal
          character={character}
          onClose={() => setShowInventory(false)}
          onEquip={handleEquipItem}
          onUnequip={handleUnequipItem}
          onUse={handleUseConsumable}
        />
      )}

      {showStatDetail && detailStat && (
        <StatDetailModal
          stat={detailStat}
          history={readJson('qm_stat_history', {})[detailStat.id] || []}
          onEdit={detailStat.custom ? () => { setShowStatDetail(false); setEditingStat(detailStat); setShowStatEditor(true) } : null}
          onClose={() => { setShowStatDetail(false); setDetailStat(null) }}
        />
      )}

      <header className="header" ref={headerRef}>
        <div className="header-top">
          <h1 className="header-title">⚔️ QuestMaster</h1>
          <div className="header-right">
            {syncStatus === 'ok' && <span className="sync-dot sync-dot--ok" title="Drive sync active" />}
            {syncStatus === 'scope' && <span className="sync-dot sync-dot--error" title="Sign out and back in to enable Drive sync" />}
            {syncStatus === 'network' && <span className="sync-dot sync-dot--warn" title="Drive sync unavailable" />}
            <button
              className={`nav-btn${view === 'map' ? ' nav-btn--active' : ''}`}
              onClick={() => setView(v => v === 'map' ? 'quests' : 'map')}
            >
              <span className="nav-btn-icon">🗺️</span>
              <span className="nav-btn-label">Map</span>
            </button>
            <button
              className={`nav-btn${view === 'chronicle' ? ' nav-btn--active' : ''}`}
              onClick={() => setView(v => v === 'chronicle' ? 'quests' : 'chronicle')}
            >
              <span className="nav-btn-icon">📊</span>
              <span className="nav-btn-label">Stats</span>
            </button>
            <button
              className={`nav-btn${(view === 'character' || view === 'shop') ? ' nav-btn--active' : ''}`}
              onClick={() => setView(v => (v === 'character' || v === 'shop') ? 'quests' : 'character')}
            >
              <span className="nav-btn-icon">👤</span>
              <span className="nav-btn-label">Hero</span>
            </button>
            <button className="nav-btn" onClick={() => setShowGlossary(true)}>
              <span className="nav-btn-icon">📜</span>
              <span className="nav-btn-label">Lore</span>
            </button>
            <div className="nav-menu-wrap" ref={menuRef}>
              <button
                className={`nav-btn${showMenu ? ' nav-btn--active' : ''}`}
                onClick={() => setShowMenu(v => !v)}
                aria-label="More options"
              >
                <span className="nav-btn-icon nav-btn-icon--dots">⋯</span>
                <span className="nav-btn-label">More</span>
              </button>
              {showMenu && (
                <div className="nav-dropdown">
                  <button className="nav-dropdown-item" onClick={() => { setShowSettings(true); setShowMenu(false) }}>
                    ⚙️ Settings
                  </button>
                  <button className="nav-dropdown-item nav-dropdown-item--danger" onClick={() => { setShowMenu(false); onSignOut() }}>
                    🚪 Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="date-label">{todayLabel}</div>
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-value stat-value--gold">{level}</span>
            <span className="stat-label">⚔️ Level</span>
          </div>
          <div className="stat-card">
            <span className={`stat-value${streak > 0 ? ' stat-value--fire' : ''}`}>{streak}</span>
            <span className="stat-label">🔥 Streak</span>
          </div>
          <div className="stat-card">
            <span className="stat-value stat-value--gold">{bestStreak}</span>
            <span className="stat-label">🏆 Best</span>
          </div>
          <div className="stat-card">
            <span className="stat-value stat-value--gold">{coins}</span>
            <span className="stat-label">🪙 Coins</span>
          </div>
        </div>
        <div className="xp-bar-wrap">
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width: `${xpPct * 100}%` }} />
          </div>
          <div className="xp-bar-label">{xpInto} / {xpNeeded} XP → Level {level + 1}</div>
        </div>
        {character.class && (() => {
          const maxHP = character.maxHP ?? 100
          const currentHP = character.currentHP ?? maxHP
          const hpPct = Math.max(0, Math.min(1, currentHP / maxHP))
          const hpTier = hpPct > 0.5 ? 'high' : hpPct > 0.25 ? 'mid' : 'low'
          return (
            <div className="hp-bar-wrap">
              <div className="hp-bar-track">
                <div className={`hp-bar-fill hp-bar-fill--${hpTier}`} style={{ width: `${hpPct * 100}%` }} />
              </div>
              <div className="hp-bar-label">❤️ {currentHP} / {maxHP} HP</div>
            </div>
          )
        })()}
        {streakBanner && (
          <div className={`streak-banner streak-banner--${streakBanner.type}`}>
            {streakBanner.text}
          </div>
        )}
      </header>

      <main className={`main${view === 'map' ? ' main--map' : ''}`}>
        {loading && <div className="loading">Summoning your quests...</div>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && view === 'map' && (
          <WorldMap
            tasks={tasks}
            events={events}
            locations={locations}
            onPinAdded={addPin}
            onPinRemoved={removePin}
          />
        )}

        {!loading && !error && view === 'chronicle' && (
          <Chronicle
            history={history}
            habits={habits}
            recurring={recurring}
            onResetBossStats={handleResetAllBossStats}
            onResetStats={resetStats}
          />
        )}

        {!loading && !error && view === 'character' && (
          <CharacterView
            character={character}
            level={level}
            coins={coins}
            points={points}
            bossesDefeated={defeatedHabits.length}
            stats={stats}
            onChangeClass={() => setShowCharacterSelect(true)}
            onVisitShop={(cat) => { setShopStartCategory(cat || 'weapon'); setView('shop') }}
            onSlotTap={(cat) => { setShopStartCategory(cat); setView('shop') }}
            onUnequip={handleUnequipItem}
            onOpenInventory={() => setShowInventory(true)}
            onBossJournal={() => setShowBossJournal(true)}
            onViewStat={(stat) => { setDetailStat(stat); setShowStatDetail(true) }}
            onAddStat={() => { setEditingStat(null); setShowStatEditor(true) }}
            onEditStat={(stat) => { setEditingStat(stat); setShowStatEditor(true) }}
          />
        )}

        {!loading && !error && view === 'shop' && (
          <ShopView
            character={character}
            coins={coins}
            habits={habits}
            onBuy={handleBuyItem}
            onEquip={handleEquipItem}
            onUnequip={handleUnequipItem}
            onUse={handleUseConsumable}
            onSell={handleSellItem}
            onBack={() => setView('character')}
            startCategory={shopStartCategory}
          />
        )}

        {!loading && !error && view === 'quests' && (
          <>
            <section className="section">
              <div className="section-title-row">
                <h2 className="section-title">
                  ⚔️ Today's Quests
                  {theming && <span className="theming-badge">✨ Enchanting...</span>}
                </h2>
                <HelpButton topic="quests" onHelp={setHelpTopic} />
                <button className="add-habit-btn" onClick={() => setShowCreateQuest(true)}>
                  + New Quest
                </button>
                {settings.combinedView && (
                  <button className="add-habit-btn" onClick={() => setShowCreateMission(true)}>
                    + New Mission
                  </button>
                )}
                <button
                  type="button"
                  className={`view-switch${settings.combinedView ? ' view-switch--on' : ''}`}
                  role="switch"
                  aria-checked={settings.combinedView}
                  onClick={() => handleSetCombinedView(!settings.combinedView)}
                >
                  <span>📋 Full List</span>
                  <span className="view-switch-track">
                    <span className="view-switch-knob" />
                  </span>
                </button>
              </div>
              {settings.combinedView && (
                <div className="lookahead-filter" role="group" aria-label="Mission look-ahead window">
                  {LOOKAHEAD_OPTIONS.map(opt => (
                    <button
                      key={opt.days}
                      className={`lookahead-btn${lookAhead === opt.days ? ' lookahead-btn--active' : ''}`}
                      onClick={() => handleSetLookAhead(opt.days)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              {settings.combinedView
                ? (combinedOrder.length === 0 && combinedCompletedEntries.length === 0
                    ? <p className="empty">No quests or missions right now. Tap <strong>+ New Quest</strong> or <strong>+ New Mission</strong> to add one.</p>
                    : (
                      <div>
                        {groupCombinedByDay(combinedOrder).map(group => (
                          <div key={group.key} className="mission-day-group">
                            <div className="mission-day-header">{group.label}</div>
                            {group.entries.map(entry => (
                              entry.type === 'quest'
                                ? renderTaskItem(entry.item, entry.index)
                                : renderEventItem(entry.item, entry.index)
                            ))}
                          </div>
                        ))}
                      </div>
                    )
                  )
                : (tasks.length === 0 && completedTasks.length === 0
                    ? <p className="empty">No quests today — your Google Tasks for today will appear here. Tap <strong>+ New Quest</strong> to create one.</p>
                    : (
                      <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="quests">
                          {(dropProvided) => (
                            <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                              {orderedTasks.map((task, index) => (
                                <Draggable
                                  key={task.id}
                                  draggableId={task.id}
                                  index={index}
                                  isDragDisabled={settings.autoSort || Boolean(task.due)}
                                >
                                  {(dragProvided, dragSnapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      className={dragSnapshot.isDragging ? 'task-dragging' : undefined}
                                    >
                                      {renderTaskItem(task, index, (settings.autoSort || task.due) ? null : dragProvided.dragHandleProps)}
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {dropProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    )
                  )
              }

              {settings.combinedView
                ? (combinedCompletedEntries.length > 0 && (
                    <div className="completed-section">
                      <button
                        className="completed-section-header recurring-section-header--btn"
                        onClick={() => setShowCompletedList(v => !v)}
                      >
                        <span className="completed-section-label">✓ Completed Today</span>
                        <span className="completed-section-count">{combinedCompletedEntries.length}</span>
                        <span className="recurring-chevron">{showCompletedList ? '▲' : '▼'}</span>
                      </button>
                      {showCompletedList && combinedCompletedEntries.map(row => (
                        <div key={row.id} className="completed-row">
                          <span className="completed-row-check">✓</span>
                          <span className="completed-row-name">{row.label}</span>
                          <span className="completed-row-xp">+{row.xp} XP</span>
                          <button
                            className="completed-row-restore"
                            onClick={() => row.type === 'quest' ? handleRestoreTask(row.entry) : handleUnclaimEvent(row.id)}
                          >
                            ↩ {row.type === 'quest' ? 'Restore' : 'Unclaim'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ))
                : (completedTasks.length > 0 && (
                    <div className="completed-section">
                      <button
                        className="completed-section-header recurring-section-header--btn"
                        onClick={() => setShowCompletedList(v => !v)}
                      >
                        <span className="completed-section-label">✓ Completed Today</span>
                        <span className="completed-section-count">{completedTasks.length}</span>
                        <span className="recurring-chevron">{showCompletedList ? '▲' : '▼'}</span>
                      </button>
                      {showCompletedList && completedTasks.map(entry => (
                        <div key={entry.task.id} className="completed-row">
                          <span className="completed-row-check">✓</span>
                          <span className="completed-row-name">
                            {entry.themedTitle || entry.task.title || '(Quest)'}
                          </span>
                          <span className="completed-row-xp">+{entry.xp} XP</span>
                          <button
                            className="completed-row-restore"
                            onClick={() => handleRestoreTask(entry)}
                          >
                            ↩ Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  ))
              }

              {recurring.length > 0 && (
                <div className="completed-section">
                  <div className="recurring-header-row">
                    <button
                      className="completed-section-header recurring-section-header--btn"
                      onClick={() => setShowRecurringList(v => !v)}
                    >
                      <span className="completed-section-label" style={{ color: 'var(--accent-light)' }}>🔄 Recurring</span>
                      <span className="completed-section-count" style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--accent-light)' }}>{recurring.length}</span>
                      <span className="recurring-chevron">{showRecurringList ? '▲' : '▼'}</span>
                    </button>
                    <HelpButton topic="recurring" onHelp={setHelpTopic} />
                  </div>
                  {showRecurringList && recurring.map(def => (
                    <div key={def.id} className={`completed-row${!def.active ? ' recurring-row--paused' : ''}`}>
                      <span className="completed-row-check" style={{ color: def.active ? 'var(--accent-light)' : 'var(--text-muted)' }}>
                        {def.active ? '🔄' : '⏸'}
                      </span>
                      <div className="recurring-row-body">
                        <span className="completed-row-name" style={{ textDecoration: 'none', color: def.active ? 'var(--text)' : 'var(--text-muted)' }}>
                          {themedTitles[def.id] || def.title}
                        </span>
                        <span className="recurring-row-schedule">
                          {scheduleLabel(def.days)}{def.dueTime ? ` · ⏰ ${formatQuestTime(def.dueTime)}` : ''}
                        </span>
                      </div>
                      <div className="recurring-row-actions">
                        <button
                          className="recurring-action-btn"
                          onClick={() => handleToggleRecurring(def.id)}
                          title={def.active ? 'Pause' : 'Resume'}
                        >{def.active ? '⏸' : '▶'}</button>
                        <button
                          className="recurring-action-btn recurring-action-btn--delete"
                          onClick={() => handleDeleteRecurring(def.id)}
                          title="Delete"
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="section">
              <div className="section-title-row">
                <h2 className="section-title">📜 Rumors</h2>
                <HelpButton topic="rumors" onHelp={setHelpTopic} />
              </div>
              <p className="rumor-subtitle">Quick thoughts, parked here with no date and no dice — until you send one off to become a quest.</p>
              <form className="rumor-capture-row" onSubmit={handleAddRumor}>
                <input
                  ref={rumorInputRef}
                  type="text"
                  className="rumor-capture-input"
                  value={rumorDraft}
                  onChange={e => setRumorDraft(e.target.value)}
                  placeholder="Jot a quick thought..."
                />
                <button type="submit" className="rumor-capture-btn" disabled={!rumorDraft.trim()}>+ Add</button>
              </form>
              {rumors.length > 0 && (
                <div className="rumor-list">
                  {rumors.map(rumor => (
                    <div key={rumor.id} className="rumor-row">
                      <span className="rumor-row-text">{rumor.text}</span>
                      <div className="rumor-row-actions">
                        <button
                          className="rumor-action-btn rumor-action-btn--convert"
                          onClick={() => handleConvertRumor(rumor)}
                          title="Convert to quest"
                        >⚔️</button>
                        <button
                          className="rumor-action-btn rumor-action-btn--delete"
                          onClick={() => handleDeleteRumor(rumor.id)}
                          title="Delete"
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {!settings.combinedView && (
              <section className="section">
                <div className="section-title-row">
                  <h2 className="section-title">📅 {lookAhead > 0 ? 'Upcoming Missions' : "Today's Missions"}</h2>
                  <HelpButton topic="missions" onHelp={setHelpTopic} />
                  <button className="add-habit-btn" onClick={() => setShowCreateMission(true)}>
                    + New Mission
                  </button>
                </div>
                <div className="lookahead-filter" role="group" aria-label="Mission look-ahead window">
                  {LOOKAHEAD_OPTIONS.map(opt => (
                    <button
                      key={opt.days}
                      className={`lookahead-btn${lookAhead === opt.days ? ' lookahead-btn--active' : ''}`}
                      onClick={() => handleSetLookAhead(opt.days)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {events.length === 0
                  ? <p className="empty">{lookAhead > 0 ? 'No missions in this window. Events from your Google Calendar appear here.' : 'No missions today. Events from your Google Calendar appear here — try expanding the look-ahead window above.'}</p>
                  : lookAhead > 0
                    ? groupedEvents.map(group => (
                        <div key={group.key} className="mission-day-group">
                          <div className="mission-day-header">{group.label}</div>
                          {group.events.map(renderEventItem)}
                        </div>
                      ))
                    : events.map(renderEventItem)
                }
              </section>
            )}

            <section className="section">
              <div className="section-title-row">
                <h2 className="section-title">🐉 Active Bosses</h2>
                <HelpButton topic="bosses" onHelp={setHelpTopic} />
                {canAddHabit && (
                  <button className="add-habit-btn" onClick={() => setShowCreateHabit(true)}>
                    + New Habit
                  </button>
                )}
              </div>
              {activeHabits.length === 0 && defeatedHabits.length === 0 && (
                <p className="empty">No boss battles yet. Create a habit with <strong>+ New Habit</strong> to summon your first boss — each missed day lets it heal, so stay consistent.</p>
              )}
              {activeHabits.map(habit => (
                <BossCard
                  key={habit.id}
                  habit={habit}
                  onComplete={handleHabitComplete}
                  onPause={handlePauseHabit}
                  onResume={handleResumeHabit}
                  onDelete={handleDeleteHabit}
                  onReset={handleResetHabit}
                />
              ))}
              {pausedHabits.length > 0 && (
                <>
                  <h3 className="defeated-title">⏸ On Hold</h3>
                  {pausedHabits.map(habit => (
                    <BossCard
                      key={habit.id}
                      habit={habit}
                      onComplete={handleHabitComplete}
                      onPause={handlePauseHabit}
                      onResume={handleResumeHabit}
                      onDelete={handleDeleteHabit}
                    />
                  ))}
                </>
              )}
              {defeatedHabits.length > 0 && (
                <>
                  <h3 className="defeated-title">💀 Defeated</h3>
                  {defeatedHabits.map(habit => (
                    <BossCard
                      key={habit.id}
                      habit={habit}
                      onComplete={handleHabitComplete}
                      onPause={handlePauseHabit}
                      onResume={handleResumeHabit}
                      onDelete={handleDeleteHabit}
                    />
                  ))}
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
