import { useRef, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

// Client-only ids for stable React keys / drag identity — saved checklist
// data is plain {text, done} (see encodeChecklist), so these are generated
// on load/add and stripped again right before every save in persist().
let idCounter = 0
function withId(item) { return { ...item, _id: item._id ?? `c${idCounter++}` } }

// A plain checkoff list scoped to one quest (e.g. grocery items) — separate
// from the quest's Notes field, which is user-facing text the LLM reads when
// theming the title. Checklist items never go near the LLM.
export default function ChecklistModal({ task, checklist, onClose, onSave }) {
  const [items, setItems] = useState(() => checklist.map(withId))
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  function persist(next) {
    setItems(next)
    const clean = next.map(({ _id, ...rest }) => rest)
    onSave(task.id, clean).catch(err => setError(err.message || 'Could not save checklist.'))
  }

  function addItem(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    persist([...items, withId({ text, done: false })])
    setDraft('')
    // Tapping a submit button blurs the input on mobile Safari, so getting
    // back into "type the next item" flow doesn't happen for free — return
    // focus explicitly so the user can keep adding items without re-tapping.
    inputRef.current?.focus()
  }

  function toggleItem(index) {
    persist(items.map((it, i) => i === index ? { ...it, done: !it.done } : it))
  }

  function removeItem(index) {
    persist(items.filter((_, i) => i !== index))
  }

  function handleDragEnd(result) {
    const { source, destination } = result
    if (!destination || destination.index === source.index) return
    const reordered = [...items]
    const [moved] = reordered.splice(source.index, 1)
    reordered.splice(destination.index, 0, moved)
    persist(reordered)
  }

  const checkedCount = items.filter(i => i.done).length

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">📋 Checklist</h2>
        <p className="modal-subtitle">
          {items.length > 0 ? `${checkedCount} / ${items.length} checked off` : 'Break this quest into checkable items.'}
        </p>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="checklist-items">
            {(dropProvided) => (
              <div className="checklist-items" ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                {items.map((item, i) => (
                  <Draggable key={item._id} draggableId={item._id} index={i}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`checklist-row${dragSnapshot.isDragging ? ' checklist-row--dragging' : ''}`}
                      >
                        <span
                          className="checklist-drag-handle"
                          {...dragProvided.dragHandleProps}
                          aria-label="Drag to reorder"
                          title="Drag to reorder"
                        >⠿</span>
                        <label className="checklist-row-label">
                          <input type="checkbox" checked={item.done} onChange={() => toggleItem(i)} />
                          <span className={item.done ? 'checklist-row-text checklist-row-text--done' : 'checklist-row-text'}>
                            {item.text}
                          </span>
                        </label>
                        <button
                          type="button"
                          className="checklist-row-remove"
                          onClick={() => removeItem(i)}
                          aria-label={`Remove ${item.text}`}
                        >✕</button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
                {items.length === 0 && <div className="checklist-empty">No items yet.</div>}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <form onSubmit={addItem} className="checklist-add-row">
          <input
            ref={inputRef}
            type="text"
            className="form-input"
            placeholder="e.g. Milk"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
          />
          <button type="submit" className="modal-btn modal-btn--create" disabled={!draft.trim()}>Add</button>
        </form>

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <div className="modal-actions-right">
            <button type="button" className="modal-btn modal-btn--create" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  )
}
