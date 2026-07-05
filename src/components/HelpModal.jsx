import { HELP } from '../utils/helpContent'

export function HelpButton({ topic, onHelp }) {
  return (
    <button
      className="help-btn"
      onClick={e => { e.stopPropagation(); onHelp(topic) }}
      aria-label="Help"
    >?</button>
  )
}

export default function HelpModal({ topic, onClose }) {
  const content = HELP[topic]
  if (!content) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{content.title}</h2>
        <div className="help-body">
          {content.body.map((para, i) => (
            <p key={i} className="help-para">{para}</p>
          ))}
        </div>
        <div className="modal-actions">
          <button
            className="modal-btn modal-btn--create"
            style={{ marginLeft: 'auto' }}
            onClick={onClose}
          >Got it</button>
        </div>
      </div>
    </div>
  )
}
