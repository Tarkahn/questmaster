import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchTodaysTasks, fetchTodaysEvents, markTaskComplete, createTask, createEvent } from '../utils/api'
import { themeItems, clearThemeCache, getThemeCacheAll, applyThemeCache } from '../utils/theme'
import { loadDifficultyMemory, saveDifficultyMemory, getDifficulty, setDifficultyInMemory } from '../utils/difficulty'
import { loadHabits, saveHabits, createHabitObj, completeHabitObj, processHabits, pauseHabit, resumeHabit, deleteHabit, resetHabit, resetAllBossStats } from '../utils/habits'
import { loadFromDrive, saveToDrive, loadGlossary, saveGlossary, loadDifficulties, saveDifficulties, loadSettingsFromDrive, saveSettingsToDrive, loadGameState, saveGameStateToDrive, loadThemeCache, saveThemeCache } from '../utils/driveSync'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../utils/settings'
import { DEFAULT_GLOSSARY } from '../utils/defaultGlossary'
import { useGameState, computeGameStateMerge } from '../hooks/useGameState'
import TaskItem from './TaskItem'
import EventItem from './EventItem'
import BossCard from './BossCard'
import CreateHabitModal from './CreateHabitModal'
import CreateQuestModal from './CreateQuestModal'
import CreateMissionModal from './CreateMissionModal'
import GlossaryModal from './GlossaryModal'
import SettingsModal from './SettingsModal'
import Chronicle from './Chronicle'
import Toast from './Toast'

export default function Dashboard({ token, onSignOut }) {
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [themedTitles, setThemedTitles] = useState({})
  const [theming, setTheming] = useState(false)
  const [habits, setHabits] = useState(() => loadHabits())
  const [showCreateHabit, setShowCreateHabit] = useState(false)
  const [showCreateQuest, setShowCreateQuest] = useState(false)
  const [showCreateMission, setShowCreateMission] = useState(false)
  const [showGlossary, setShowGlossary] = useState(false)
  const [glossary, setGlossary] = useState(DEFAULT_GLOSSARY)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(() => loadSettings())
  const [difficultyMemory, setDifficultyMemory] = useState(() => loadDifficultyMemory())
  const [suggestedDifficulties, setSuggestedDifficulties] = useState({})
  const [syncStatus, setSyncStatus] = useState('checking') // checking | ok | scope | network
  const [view, setView] = useState('quests') // quests | chronicle

  const {
    points, streak, bestStreak, lastCompletedDate, completedToday,
    level, xpInto, xpNeeded, xpPct,
    claimedEvents, completeTask, claimEvent,
    history, resetStats, applyGameState,
  } = useGameState()
  const prevLevelRef = useRef(null)
  const gameStateRef = useRef({ points, streak, bestStreak, lastCompletedDate, claimedEvents, history })
  useEffect(() => {
    gameStateRef.current = { points, streak, bestStreak, lastCompletedDate, claimedEvents, history }
  })
  const handleSignOut = useCallback(onSignOut, [onSignOut])

  useEffect(() => {
    if (prevLevelRef.current !== null && level > prevLevelRef.current) {
      setToast(`🎉 LEVEL UP! You are now Level ${level}!`)
    }
    prevLevelRef.current = level
  }, [level])

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
      ] = await Promise.all([
        loadFromDrive(token),
        loadGlossary(token),
        loadDifficulties(token),
        loadSettingsFromDrive(token),
        loadGameState(token),
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
      prevPointsRef.current = points
      return
    }
    if (points !== prevPointsRef.current) {
      prevPointsRef.current = points
      saveGameStateToDrive(token, gameStateRef.current)
    }
  }, [points])

  const loadTasksAndEvents = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([
        fetchTodaysTasks(token),
        fetchTodaysEvents(token),
      ])
      setTasks(t)
      setEvents(e)
      setLoading(false)

      const includeNotes = settings.sendNotesToLlm
      const allItems = [
        ...t.map(task => ({
          id: task.id,
          title: task.title,
          notes: includeNotes ? task.notes : undefined,
        })),
        ...e.map(event => ({
          id: event.id,
          title: event.summary || '',
          notes: includeNotes ? event.description : undefined,
        })),
      ].filter(item => item.title)

      if (allItems.length > 0) {
        setTheming(true)
        const { themes, suggestedDifficulties: suggested } = await themeItems(allItems, glossary)
        setThemedTitles(themes)
        setSuggestedDifficulties(suggested)
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
  }, [token, glossary, settings.sendNotesToLlm, handleSignOut])

  useEffect(() => { loadTasksAndEvents() }, [loadTasksAndEvents])

  async function handleComplete(taskId, xp) {
    try {
      await markTaskComplete(token, taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
      completeTask(xp)
      setToast(`⚔️ Quest Complete! +${xp} XP`)
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
  }

  async function handleCreateQuest(data) {
    await createTask(token, data)
    setShowCreateQuest(false)
    setToast(`⚔️ Quest summoned: ${data.title}`)
    loadTasksAndEvents()
  }

  async function handleCreateMission(data) {
    await createEvent(token, data)
    setShowCreateMission(false)
    setToast(`📅 Mission inscribed: ${data.title}`)
    loadTasksAndEvents()
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

  function handleClaim(eventId, xp) {
    claimEvent(eventId, xp)
    setToast(`🔮 Mission Claimed! +${xp} XP`)
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
        headers: { 'content-type': 'application/json' },
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
      setToast(`💀 ${finished.boss.name} DEFEATED! Habit forged!`)
    } else {
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
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {showCreateHabit && (
        <CreateHabitModal
          onClose={() => setShowCreateHabit(false)}
          onCreate={handleCreateHabit}
        />
      )}
      {showCreateQuest && (
        <CreateQuestModal
          onClose={() => setShowCreateQuest(false)}
          onCreate={handleCreateQuest}
        />
      )}
      {showCreateMission && (
        <CreateMissionModal
          onClose={() => setShowCreateMission(false)}
          onCreate={handleCreateMission}
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
          onClose={() => setShowSettings(false)}
        />
      )}

      <header className="header">
        <div className="header-top">
          <h1 className="header-title">⚔️ QuestMaster</h1>
          <div className="header-right">
            {syncStatus === 'ok' && <span className="sync-dot sync-dot--ok" title="Drive sync active" />}
            {syncStatus === 'scope' && <span className="sync-dot sync-dot--error" title="Sign out and back in to enable Drive sync" />}
            {syncStatus === 'network' && <span className="sync-dot sync-dot--warn" title="Drive sync unavailable" />}
            <button
              className="glossary-btn"
              onClick={() => setView(v => v === 'chronicle' ? 'quests' : 'chronicle')}
              title={view === 'chronicle' ? 'Back to today\'s quests' : 'View your chronicle'}
            >
              {view === 'chronicle' ? '⚔️' : '📊'}
            </button>
            <button className="glossary-btn" onClick={() => setShowGlossary(true)} title="Edit D&D vocabulary glossary">📜</button>
            <button className="glossary-btn" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
            <button className="signout-btn" onClick={onSignOut}>Sign out</button>
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
        </div>
        <div className="xp-bar-wrap">
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width: `${xpPct * 100}%` }} />
          </div>
          <div className="xp-bar-label">{xpInto} / {xpNeeded} XP → Level {level + 1}</div>
        </div>
        {streakBanner && (
          <div className={`streak-banner streak-banner--${streakBanner.type}`}>
            {streakBanner.text}
          </div>
        )}
      </header>

      <main className="main">
        {loading && <div className="loading">Summoning your quests...</div>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && view === 'chronicle' && (
          <Chronicle
            history={history}
            habits={habits}
            onResetBossStats={handleResetAllBossStats}
            onResetStats={resetStats}
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
                <button className="add-habit-btn" onClick={() => setShowCreateQuest(true)}>
                  + New Quest
                </button>
              </div>
              {tasks.length === 0
                ? <p className="empty">All quests complete — you're a legend! 🎉</p>
                : tasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      themedTitle={themedTitles[task.id]}
                      difficulty={getEffectiveDifficulty(task.id)}
                      onComplete={handleComplete}
                      onDifficultyChange={handleDifficultyChange}
                    />
                  ))
              }
            </section>

            <section className="section">
              <div className="section-title-row">
                <h2 className="section-title">📅 Today's Missions</h2>
                <button className="add-habit-btn" onClick={() => setShowCreateMission(true)}>
                  + New Mission
                </button>
              </div>
              {events.length === 0
                ? <p className="empty">No missions today — rest up, hero.</p>
                : events.map(event => (
                    <EventItem
                      key={event.id}
                      event={event}
                      themedTitle={themedTitles[event.id]}
                      claimed={isEventClaimed(event.id)}
                      difficulty={getEffectiveDifficulty(event.id)}
                      onClaim={handleClaim}
                      onDifficultyChange={handleDifficultyChange}
                    />
                  ))
              }
            </section>

            <section className="section">
              <div className="section-title-row">
                <h2 className="section-title">🐉 Active Bosses</h2>
                {canAddHabit && (
                  <button className="add-habit-btn" onClick={() => setShowCreateHabit(true)}>
                    + New Habit
                  </button>
                )}
              </div>
              {activeHabits.length === 0 && defeatedHabits.length === 0 && (
                <p className="empty">No bosses yet — forge a habit to summon one.</p>
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
