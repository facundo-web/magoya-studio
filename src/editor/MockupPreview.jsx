import React from 'react'
import PiecePreview from './PiecePreview.jsx'

export const MOCKUPS = [
  { k: 'phone', label: 'Celular · Story/Reel' },
  { k: 'ig', label: 'Feed Instagram' },
  { k: 'li', label: 'Post LinkedIn' },
]

// chrome genérico (no imita marcas reales; solo da contexto de cómo se ve)
export default function MockupPreview({ template, content, format, mockup = 'phone' }) {
  const piece = <PiecePreview template={template} content={content} format={format} />
  const ar = `${format.w} / ${format.h}`

  if (mockup === 'phone') {
    return (
      <div className="mk-phone">
        <div className="mk-phone-screen">
          <div className="mk-piece" style={{ aspectRatio: ar, width: '100%' }}>{piece}</div>
          <div className="mk-story-top"><span /><span /><span /></div>
          <div className="mk-story-user"><span className="mk-av" />magoya</div>
        </div>
        <div className="mk-notch" />
      </div>
    )
  }
  if (mockup === 'ig') {
    return (
      <div className="mk-phone">
        <div className="mk-phone-screen mk-feed">
          <div className="mk-ig-head"><span className="mk-av" /><span className="mk-ig-name">magoya</span><span className="mk-dots">⋯</span></div>
          <div className="mk-piece" style={{ aspectRatio: ar, width: '100%' }}>{piece}</div>
          <div className="mk-ig-actions"><span>♡</span><span>💬</span><span>➤</span><span className="mk-save">🔖</span></div>
          <div className="mk-ig-cap"><b>magoya</b> Tu texto de caption acá…</div>
        </div>
        <div className="mk-notch" />
      </div>
    )
  }
  // LinkedIn
  return (
    <div className="mk-licard">
      <div className="mk-li-head"><span className="mk-av lg" /><div><div className="mk-li-name">Magoya</div><div className="mk-li-sub">AgTech · Producto · 1 h</div></div></div>
      <div className="mk-li-text">Texto del posteo acá…</div>
      <div className="mk-piece" style={{ aspectRatio: ar, width: '100%' }}>{piece}</div>
      <div className="mk-li-actions"><span>👍 Me gusta</span><span>💬 Comentar</span><span>↻ Compartir</span></div>
    </div>
  )
}
