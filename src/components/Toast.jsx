import { useEffect, useState } from 'react'

export default function Toast({ message, onDone }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(onDone, 300)
      return () => clearTimeout(t)
    }
  }, [visible, onDone])

  return (
    <div className={`toast ${visible ? 'toast--in' : 'toast--out'}`}>
      {message}
    </div>
  )
}
