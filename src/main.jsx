import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Static fallback content for non-JS crawlers lives in index.html (see the
// comment there). Remove it the instant the real app takes over so
// JS-enabled visitors only ever see the React-rendered Landing/Dashboard.
document.getElementById('static-landing')?.remove()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
