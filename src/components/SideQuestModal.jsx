import { useState, useEffect } from 'react'

export default function SideQuestModal({ parentTask, parentThemedTitle, onCreate, onClose }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])       // array of strings
  const [saving, setSaving] = useState(false)
  const [suggestFailed, setSuggestFailed] = useState(false)

  const parentName = parentThemedTitle || parentTask.title

  useEffect(() => {
    let cancelled = false
    async function suggest() {
      try {
        const res = await fetch('/api/breakdown', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: parentTask.title, notes: parentTask.notes || undefined }),
        })
        const data = await res.json()
        if (cancelled) return
        const subtasks = Array.isArray(data.subtasks) ? data.subtasks : []
        if (subtasks.length) {
          setRows(subtasks)
        } else {
          setSuggestFailed(true)
          setRows([''])
        }
      } catch {
        if (!cancelled) { setSuggestFailed(true); setRows(['']) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    suggest()
    return () => { cancelled = true }
  }, [parentTask])

  function updateRow(i, value) {
    setRows(prev => prev.map((r, idx) => idx === i ? value : r))
  }
  function removeRow(i) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }
  function addRow() {
    setRows(prev => [...prev, ''])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const titles = rows.map(r => r.trim()).filter(Boolean)
    if (!titles.length || saving) return
    setSaving(true)
    await onCreate(parentTask.id, titles)
  }

  const validCount = rows.filter(r => r.trim()).length

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">⚡ Side Quests</h2>
        <p className="modal-subtitle">
          Breaking down <strong>{parentName}</strong> into smaller steps.
        </p>

        {loading ? (
          <div className="sidequest-loading">
            <span className="sidequest-spinner">✦</span>
            <span>The oracle is dividing your quest…</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="quest-form">
            {suggestFailed && (
              <p className="sidequest-note">
                Couldn't suggest a breakdown for this one — add your own side quests below.
              </p>
            )}

            <div className="sidequest-rows">
              {rows.map((row, i) => (
                <div className="sidequest-row" key={i}>
                  <span className="sidequest-bullet">⚔</span>
                  <input
                    type="text"
                    className="form-input"
                    value={row}
                    onChange={e => updateRow(i, e.target.value)}
                    placeholder={`Side quest ${i + 1}`}
                    autoFocus={i === 0}
                  />
                  <button
                    type="button"
                    className="sidequest-remove"
                    onClick={() => removeRow(i)}
                    aria-label="Remove side quest"
                  >✕</button>
                </div>
              ))}
            </div>

            <button type="button" className="sidequest-add" onClick={addRow}>
              + Add another
            </button>

            <p className="sidequest-hint">
              You must complete every side quest before the main quest can be finished.
            </p>

            <div className="modal-actions">
              <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                type="submit"
                className="modal-btn modal-btn--create"
                disabled={validCount === 0 || saving}
              >
                {saving ? 'Forging…' : `Create ${validCount || ''} Side Quest${validCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
