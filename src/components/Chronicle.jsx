import { useState } from 'react'
import XPBarChart from './XPBarChart'
import LevelLineChart from './LevelLineChart'
import MissedQuestsChart from './MissedQuestsChart'
import HelpModal, { HelpButton } from './HelpModal'

export default function Chronicle({ history = [], habits = [], recurring = [], onResetBossStats, onResetStats }) {
  const [helpTopic, setHelpTopic] = useState(null)
  const [confirmBossReset, setConfirmBossReset] = useState(false)
  const [confirmStatsReset, setConfirmStatsReset] = useState(false)
  const today = new Date().toLocaleDateString('en-CA')
  const todayRow = history.find(h => h.date === today)
  const totalXpEarned = history.reduce((sum, h) => sum + (h.xpEarned || 0), 0)
  const totalQuests = history.reduce((sum, h) => sum + (h.tasksCompleted || 0), 0)
  const totalMissions = history.reduce((sum, h) => sum + (h.eventsClaimed || 0), 0)
  const activeDays = history.filter(h => (h.xpEarned || 0) > 0).length

  const activeHabits = habits.filter(h => h.status === 'active')
  const pausedHabits = habits.filter(h => h.status === 'paused')
  const defeatedHabits = habits.filter(h => h.status === 'defeated')
  const totalCheckIns = habits.reduce((sum, h) => sum + (h.totalCompletions || 0), 0)

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <>
      {helpTopic && <HelpModal topic={helpTopic} onClose={() => setHelpTopic(null)} />}

      <section className="section">
        <h2 className="section-title">📜 Your Chronicle</h2>
        <p className="empty">A retrospective of your adventures so far.</p>
      </section>

      <section className="section">
        <div className="chronicle-section-heading">
          <h3 className="defeated-title">⚡ Today</h3>
          <HelpButton topic="chronicle-today" onHelp={setHelpTopic} />
        </div>
        <div className="chronicle-cards">
          <div className="chronicle-card">
            <div className="chronicle-card-value">{todayRow?.xpEarned ?? 0}</div>
            <div className="chronicle-card-label">XP earned</div>
          </div>
          <div className="chronicle-card">
            <div className="chronicle-card-value">{todayRow?.tasksCompleted ?? 0}</div>
            <div className="chronicle-card-label">Quests fulfilled</div>
          </div>
          <div className="chronicle-card">
            <div className="chronicle-card-value">{todayRow?.eventsClaimed ?? 0}</div>
            <div className="chronicle-card-label">Missions claimed</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="chronicle-section-heading">
          <h3 className="defeated-title">🗓 Last 7 days</h3>
          <HelpButton topic="chronicle-7day" onHelp={setHelpTopic} />
        </div>
        <div className="chronicle-chart">
          <XPBarChart history={history} />
        </div>
      </section>

      <section className="section">
        <div className="chronicle-section-heading">
          <h3 className="defeated-title">📈 Level progression</h3>
          <HelpButton topic="chronicle-level" onHelp={setHelpTopic} />
        </div>
        <div className="chronicle-chart">
          <LevelLineChart history={history} />
        </div>
      </section>

      <section className="section">
        <div className="chronicle-section-heading">
          <h3 className="defeated-title">🐉 Bosses</h3>
          <HelpButton topic="chronicle-bosses" onHelp={setHelpTopic} />
        </div>
        <div className="chronicle-cards">
          <div className="chronicle-card">
            <div className="chronicle-card-value">{activeHabits.length}</div>
            <div className="chronicle-card-label">Active in battle{pausedHabits.length > 0 ? ` (+${pausedHabits.length} paused)` : ''}</div>
          </div>
          <div className="chronicle-card">
            <div className="chronicle-card-value">{defeatedHabits.length}</div>
            <div className="chronicle-card-label">Vanquished</div>
          </div>
          <div className="chronicle-card">
            <div className="chronicle-card-value">{totalCheckIns}</div>
            <div className="chronicle-card-label">Total check-ins</div>
          </div>
        </div>
        {defeatedHabits.length > 0 && (
          <div className="chronicle-hall">
            <div className="chronicle-hall-title">🏛 Hall of Victories</div>
            {defeatedHabits.map(h => (
              <div key={h.id} className="chronicle-hall-item">
                <span className="chronicle-hall-boss">💀 {h.boss.name}</span>
                <span className="chronicle-hall-habit">{h.themedTitle || h.title}</span>
                <span className="chronicle-hall-date">{formatDate(h.lastCompletedDate)}</span>
              </div>
            ))}
          </div>
        )}
        {habits.length > 0 && (
          <div className="chronicle-reset-row">
            {!confirmBossReset ? (
              <button className="chronicle-reset-btn" onClick={() => setConfirmBossReset(true)}>
                ↺ Reset all boss progress
              </button>
            ) : (
              <div className="chronicle-reset-confirm">
                <span>Restart all bosses to day one?</span>
                <button className="chronicle-reset-btn chronicle-reset-btn--confirm" onClick={() => { onResetBossStats(); setConfirmBossReset(false) }}>
                  Confirm
                </button>
                <button className="chronicle-reset-btn" onClick={() => setConfirmBossReset(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {recurring.length > 0 && (
        <section className="section">
          <div className="chronicle-section-heading">
            <h3 className="defeated-title">🔁 Recurring Quests</h3>
            <HelpButton topic="chronicle-recurring" onHelp={setHelpTopic} />
          </div>
          <div className="chronicle-recurring-list">
            {recurring.map(def => (
              <div key={def.id} className={`chronicle-recurring-row${!def.active ? ' chronicle-recurring-row--paused' : ''}`}>
                <span className="chronicle-recurring-name">{def.title}</span>
                <div className="chronicle-recurring-stats">
                  <span className="chronicle-recurring-streak" title="Current streak">
                    🔥 {def.streak || 0}
                  </span>
                  <span className="chronicle-recurring-best" title="Best streak">
                    ⭐ {def.bestStreak || 0}
                  </span>
                  <span className="chronicle-recurring-missed" title="Total missed">
                    💀 {def.missedCount || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="chronicle-chart" style={{ marginTop: '12px' }}>
            <div className="chronicle-chart-label">Missed per day — last 30 days</div>
            <MissedQuestsChart recurring={recurring} />
          </div>
        </section>
      )}

      <section className="section">
        <div className="chronicle-section-heading">
          <h3 className="defeated-title">🏆 All-time</h3>
          <HelpButton topic="chronicle-alltime" onHelp={setHelpTopic} />
        </div>
        <div className="chronicle-cards">
          <div className="chronicle-card">
            <div className="chronicle-card-value">{totalXpEarned}</div>
            <div className="chronicle-card-label">Total XP earned</div>
          </div>
          <div className="chronicle-card">
            <div className="chronicle-card-value">{totalQuests}</div>
            <div className="chronicle-card-label">Quests fulfilled</div>
          </div>
          <div className="chronicle-card">
            <div className="chronicle-card-value">{totalMissions}</div>
            <div className="chronicle-card-label">Missions claimed</div>
          </div>
          <div className="chronicle-card">
            <div className="chronicle-card-value">{activeDays}</div>
            <div className="chronicle-card-label">Active days</div>
          </div>
        </div>
        <div className="chronicle-reset-row">
          {!confirmStatsReset ? (
            <button className="chronicle-reset-btn" onClick={() => setConfirmStatsReset(true)}>
              ↺ Reset XP &amp; streak history
            </button>
          ) : (
            <div className="chronicle-reset-confirm">
              <span>Wipe all XP, levels, and streaks?</span>
              <button className="chronicle-reset-btn chronicle-reset-btn--confirm" onClick={() => { onResetStats(); setConfirmStatsReset(false) }}>
                Confirm
              </button>
              <button className="chronicle-reset-btn" onClick={() => setConfirmStatsReset(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
