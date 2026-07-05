import { useState, useEffect } from 'react'
import DatePicker from './DatePicker'
import TimePicker from './TimePicker'

const EMPTY_ROW = () => ({ title: '', due: '', dueTime: '09:00', showDate: false, showTime: false })

export default function SideQuestModal({ parentTask, parentThemedTitle, onCreate, onClose }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
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
          setRows(subtasks.map(t => ({ ...EMPTY_ROW(), title: t })))
        } else {
          setSuggestFailed(true)
          setRows([EMPTY_ROW()])
        }
      } catch {
        if (!cancelled) { setSuggestFailed(true); setRows([EMPTY_ROW()]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    suggest()
    return () => { cancelled = true }
  }, [parentTask])

  function sortByDate(list) {
    const dated = list.filter(r => r.showDate && r.due).sort((a, b) => a.due.localeCompare(b.due))
    const undated = list.filter(r => !r.showDate || !r.due)
    return [...dated, ...undated]
  }

  function updateRow(i, patch) {
    setRows(prev => {
      const updated = prev.map((r, idx) => idx === i ? { ...r, ...patch } : r)
      return ('due' in patch || 'showDate' in patch) ? sortByDate(updated) : updated
    })
  }
  function removeRow(i) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }
  function addRow() {
    setRows(prev => [...prev, EMPTY_ROW()])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const valid = rows.filter(r => r.title.trim())
    if (!valid.length || saving) return
    setSaving(true)
    await onCreate(parentTask.id, valid.map(r => ({
      title: r.title.trim(),
      due: r.showDate && r.due ? r.due : undefined,
      dueTime: r.showDate && r.due && r.showTime ? r.dueTime : undefined,
    })))
  }

  const validCount = rows.filter(r => r.title.trim()).length

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
                <div className="sidequest-row-group" key={i}>
                  <div className="sidequest-row">
                    <span className="sidequest-bullet">⚔</span>
                    <input
                      type="text"
                      className="form-input"
                      value={row.title}
                      onChange={e => updateRow(i, { title: e.target.value })}
                      placeholder={`Side quest ${i + 1}`}
                      autoFocus={i === 0}
                    />
                    <button
                      type="button"
                      className={`sidequest-date-toggle${row.showDate ? ' sidequest-date-toggle--active' : ''}`}
                      onClick={() => updateRow(i, { showDate: !row.showDate })}
                      aria-label="Set date"
                      title="Set date"
                    >📅</button>
                    <button
                      type="button"
                      className="sidequest-remove"
                      onClick={() => removeRow(i)}
                      aria-label="Remove side quest"
                    >✕</button>
                  </div>

                  {row.showDate && (
                    <div className="sidequest-datetime">
                      <DatePicker
                        value={row.due}
                        onChange={val => updateRow(i, { due: val, showTime: val ? row.showTime : false })}
                        allowClear
                      />
                      {row.due && (
                        <label className="sidequest-time-toggle">
                          <input
                            type="checkbox"
                            checked={row.showTime}
                            onChange={e => updateRow(i, { showTime: e.target.checked })}
                          />
                          <span>⏰ Set time</span>
                        </label>
                      )}
                      {row.due && row.showTime && (
                        <TimePicker value={row.dueTime} onChange={val => updateRow(i, { dueTime: val })} />
                      )}
                    </div>
                  )}
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
