import { useState } from 'react'

export default function CreateHabitModal({ onClose, onCreate }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleCreate() {
    if (!input.trim() || loading) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/habit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', habit: input.trim() }),
      })
      const data = await res.json()
      onCreate({
        title: input.trim(),
        themedTitle: data.themedTitle || input.trim(),
        bossName: data.bossName || 'The Ancient Nemesis',
        bossDescription: data.bossDescription || 'A primordial force of resistance. Only discipline can bring it low.',
      })
    } catch {
      setError('Failed to summon boss. Check your connection and try again.')
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">⚔️ Forge a New Habit</h2>
        <p className="modal-sub">Name the discipline you want to build. We'll summon the boss that stands in your way.</p>
        <input
          className="modal-input"
          type="text"
          placeholder="e.g. exercise every morning"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          autoFocus
          maxLength={80}
          disabled={loading}
        />
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button className="modal-btn modal-btn--cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="modal-btn modal-btn--create" onClick={handleCreate} disabled={!input.trim() || loading}>
            {loading ? 'Summoning...' : 'Forge Habit'}
          </button>
        </div>
      </div>
    </div>
  )
}
