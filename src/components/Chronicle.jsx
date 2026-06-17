import XPBarChart from './XPBarChart'
import LevelLineChart from './LevelLineChart'

export default function Chronicle({ history = [] }) {
  const today = new Date().toISOString().slice(0, 10)
  const todayRow = history.find(h => h.date === today)
  const totalXpEarned = history.reduce((sum, h) => sum + (h.xpEarned || 0), 0)
  const totalQuests = history.reduce((sum, h) => sum + (h.tasksCompleted || 0), 0)
  const totalMissions = history.reduce((sum, h) => sum + (h.eventsClaimed || 0), 0)
  const activeDays = history.filter(h => (h.xpEarned || 0) > 0).length

  return (
    <>
      <section className="section">
        <h2 className="section-title">📜 Your Chronicle</h2>
        <p className="empty">A retrospective of your adventures so far.</p>
      </section>

      <section className="section">
        <h3 className="defeated-title">⚡ Today</h3>
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
        <h3 className="defeated-title">🗓 Last 7 days</h3>
        <div className="chronicle-chart">
          <XPBarChart history={history} />
        </div>
      </section>

      <section className="section">
        <h3 className="defeated-title">📈 Level progression</h3>
        <div className="chronicle-chart">
          <LevelLineChart history={history} />
        </div>
      </section>

      <section className="section">
        <h3 className="defeated-title">🏆 All-time</h3>
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
      </section>
    </>
  )
}
