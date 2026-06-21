import { useEffect, useState } from 'react'

export default function Toast({ message, onUndo, onDone }) {
  const duration = onUndo ? 5500 : 2200
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration)
    return () => clearTimeout(t)
  }, [duration])

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(onDone, 300)
      return () => clearTimeout(t)
    }
  }, [visible, onDone])

  function handleUndo() {
    onUndo()
    setVisible(false)
  }

  return (
    <div className={`toast ${visible ? 'toast--in' : 'toast--out'}`}>
      <span className="toast-message">{message}</span>
      {onUndo && (
        <button className="toast-undo-btn" onClick={handleUndo}>Undo</button>
      )}
    </div>
  )
}
