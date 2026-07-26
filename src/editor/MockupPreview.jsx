import React from 'react'
import PiecePreview from './PiecePreview.jsx'

export const MOCKUPS = [
  { k: 'phone', label: 'Celular · Story/Reel' },
  { k: 'ig', label: 'Feed Instagram' },
  { k: 'li', label: 'Post LinkedIn' },
]

// íconos de UI (stroke, fieles a las apps sin copiar assets de marca)
const I = {
  heart: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-7.5-4.9-9.5-9C1 8.5 2.8 5 6.2 5c2 0 3.3 1 4.1 2.2h3.4C14.5 6 15.8 5 17.8 5c3.4 0 5.2 3.5 3.7 7-2 4.1-9.5 9-9.5 9z" strokeLinejoin="round"/></svg>,
  comment: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a8 8 0 0 1-8 8c-1.4 0-2.8-.3-4-1l-5 1 1.3-4.4A8 8 0 1 1 21 12z" strokeLinejoin="round"/></svg>,
  send: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 3 3 10.5l7 3.5L14 21l8-18z" strokeLinejoin="round"/></svg>,
  save: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h12v18l-6-4.5L6 21V3z" strokeLinejoin="round"/></svg>,
  like: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 11v9M3 11h4l3.5-7c1.5 0 2.5 1 2.5 2.5V10h5.5c1.3 0 2.2 1.2 1.9 2.4l-1.5 6A2 2 0 0 1 17 20H7" strokeLinejoin="round"/></svg>,
  repost: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" strokeLinejoin="round"/></svg>,
  world: <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/></svg>,
}

export default function MockupPreview({ template, content, format, mockup = 'phone', dark = false }) {
  const piece = <PiecePreview template={template} content={content} format={format} />
  const ar = `${format.w} / ${format.h}`
  const dk = dark ? ' dark' : ''

  if (mockup === 'phone') {
    return (
      <div className="mk-phone">
        <div className="mk-phone-screen">
          <div className="mk-piece" style={{ aspectRatio: ar, width: '100%' }}>{piece}</div>
          <div className="mk-story-top"><span /><span /><span /></div>
          <div className="mk-story-user"><span className="mk-av" />magoya <span className="mk-time">2 h</span></div>
          <div className="mk-story-reply">
            <span className="mk-reply-input">Enviar mensaje</span>
            <span className="mk-story-ic">{I.heart}</span>
            <span className="mk-story-ic">{I.send}</span>
          </div>
        </div>
        <div className="mk-notch" />
      </div>
    )
  }
  if (mockup === 'ig') {
    return (
      <div className="mk-phone">
        <div className={'mk-phone-screen mk-feed' + dk}>
          <div className="mk-ig-head"><span className="mk-av ring" /><span className="mk-ig-name">magoya</span><span className="mk-dots">···</span></div>
          <div className="mk-piece" style={{ aspectRatio: ar, width: '100%' }}>{piece}</div>
          <div className="mk-ig-actions">
            <span>{I.heart}</span><span>{I.comment}</span><span>{I.send}</span><span className="mk-save">{I.save}</span>
          </div>
          <div className="mk-ig-likes">128 Me gusta</div>
          <div className="mk-ig-cap"><b>magoya</b> Tu caption acá…</div>
        </div>
        <div className="mk-notch" />
      </div>
    )
  }
  // LinkedIn
  return (
    <div className={'mk-licard' + dk}>
      <div className="mk-li-head">
        <span className="mk-av lg sq" />
        <div>
          <div className="mk-li-name">Magoya</div>
          <div className="mk-li-sub">2.412 seguidores</div>
          <div className="mk-li-sub">1 h · {I.world}</div>
        </div>
        <span className="mk-li-follow">+ Seguir</span>
      </div>
      <div className="mk-li-text">Texto del posteo acá… <span className="mk-li-more">…ver más</span></div>
      <div className="mk-piece" style={{ aspectRatio: ar, width: '100%' }}>{piece}</div>
      <div className="mk-li-social">👍❤️💡 <span>87</span> · 12 comentarios · 4 veces compartido</div>
      <div className="mk-li-actions">
        <span>{I.like} Recomendar</span><span>{I.comment} Comentar</span><span>{I.repost} Compartir</span><span>{I.send} Enviar</span>
      </div>
    </div>
  )
}
