import { useState } from 'react'

export default function StatEditorModal({ stat, onSave, onDelete, onClose }) {
  const isEdit = !!(stat?.custom)
  const [name, setName] = useState(stat?.name || '')
  const [description, setDescription] = useState(stat?.description || '')
  const [emoji, setEmoji] = useState(stat?.emoji || '⭐')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleSave() {
    if (!name.trim()) return
    onSave({
      id: stat?.id || Date.now().toString(36),
      name: name.trim(),
      description: description.trim(),
      emoji: emoji.trim() || '⭐',
      custom: true,
      xp: stat?.xp || 0,
      level: stat?.level || 1,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{isEdit ? 'Edit Attribute' : '＋ New Attribute'}</h2>

        <label className="form-label">
          Name
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Creativity"
            maxLength={32}
            autoFocus
          />
        </label>

        <label className="form-label">
          Description
          <span className="form-optional"> — the AI reads this to classify your tasks</span>
          <textarea
            className="form-input form-textarea"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Art, writing, design, building — activities that produce something new"
            rows={3}
          />
        </label>

        <label className="form-label">
          Emoji
          <input
            className="form-input"
            value={emoji}
            onChange={e => setEmoji(e.target.value)}
            maxLength={2}
            style={{ width: '60px', textAlign: 'center', fontSize: '20px' }}
          />
        </label>

        {isEdit && (
          <div style={{ marginTop: '4px' }}>
            <button
              className={`modal-btn modal-btn--delete${confirmDelete ? ' modal-btn--confirm' : ''}`}
              onClick={() => confirmDelete ? onDelete(stat.id) : setConfirmDelete(true)}
            >
              {confirmDelete ? `Confirm — remove "${stat.name}"?` : '🗑 Remove Stat'}
            </button>
            {confirmDelete && (
              <button className="modal-btn modal-btn--cancel" style={{ marginLeft: '8px' }} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            )}
          </div>
        )}

        <div className="modal-actions">
          <div />
          <div className="modal-actions-right">
            <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose}>Cancel</button>
            <button
              className="modal-btn modal-btn--create"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              {isEdit ? 'Save Changes' : 'Add Attribute'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
