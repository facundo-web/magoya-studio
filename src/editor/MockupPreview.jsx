import React from 'react'
import PiecePreview from './PiecePreview.jsx'
// el avatar es la marca de verdad, no un punto de color: es lo primero que
// mira cualquiera para saber si el preview es creíble
import avatarUrl from '../brand/assets/magoya-avatar.svg?url'

// ============================================================
// PREVIEW REAL — no es un dibujo de un teléfono, es el chrome de la app
// con sus medidas reales.
//
// Lo que aprendimos mirando cómo lo resuelven Later, Planoly, Buffer y el
// "Social Previewer" de Canva: en el FEED nadie dibuja el teléfono. Muestran
// la tarjeta de la red a ancho casi real, sobre el fondo real de la app y
// con las piezas vecinas cortadas — el contexto del scroll es lo que hace
// que se lea como "así se va a ver", mucho más que un marco de celular.
// El marco sí sirve para Story/Reel, que es pantalla completa.
//
// Las medidas salen de medir el chrome propio de Instagram y LinkedIn
// (sus renderers de embed) y están a escala 1,25× — a tamaño físico real un
// teléfono mide ~320 px de ancho en un monitor típico, que es exactamente
// el "teléfono enano" que no sirve para revisar nada.
// ============================================================

export const MOCKUPS = [
  { k: 'ig', label: 'Feed Instagram' },
  { k: 'phone', label: 'Story / Reel' },
  { k: 'li', label: 'Post LinkedIn' },
]

// íconos de UI (stroke, fieles a las apps sin copiar assets de marca)
const I = {
  heart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 21s-7.5-4.9-9.5-9C1 8.5 2.8 5 6.2 5c2 0 3.3 1 4.1 2.2h3.4C14.5 6 15.8 5 17.8 5c3.4 0 5.2 3.5 3.7 7-2 4.1-9.5 9-9.5 9z" strokeLinejoin="round"/></svg>,
  comment: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 12a8 8 0 0 1-8 8c-1.4 0-2.8-.3-4-1l-5 1 1.3-4.4A8 8 0 1 1 21 12z" strokeLinejoin="round"/></svg>,
  send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M22 3 3 10.5l7 3.5L14 21l8-18z" strokeLinejoin="round"/></svg>,
  save: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3h12v18l-6-4.5L6 21V3z" strokeLinejoin="round"/></svg>,
  like: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 11v9M3 11h4l3.5-7c1.5 0 2.5 1 2.5 2.5V10h5.5c1.3 0 2.2 1.2 1.9 2.4l-1.5 6A2 2 0 0 1 17 20H7" strokeLinejoin="round"/></svg>,
  repost: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" strokeLinejoin="round"/></svg>,
  world: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/></svg>,
}

// una "pieza vecina" del feed: no es tu pieza, es el contexto del scroll
function Vecino({ alto, cortadoArriba = false }) {
  return (
    <div className={'mk-vecino' + (cortadoArriba ? ' corte-arriba' : '')} aria-hidden="true">
      {!cortadoArriba && <div className="mk-ig-head"><span className="mk-av neutro" /><span className="mk-ph n" /></div>}
      <div className="mk-vecino-img" style={{ height: alto }} />
      {cortadoArriba && <div className="mk-ig-actions"><span>{I.heart}</span><span>{I.comment}</span><span>{I.send}</span><span className="mk-save">{I.save}</span></div>}
    </div>
  )
}

export default function MockupPreview({ template, content, format, mockup = 'ig', dark = false, safeZones = false, slides = null, sizeLock = null }) {
  // Un carrusel se veía como UNA pieza suelta: no se podía revisar cómo
  // encadena. Acá se pasa slide por slide, con los puntos de Instagram.
  const carrusel = slides && slides.length > 1
  const [i, setI] = React.useState(0)
  const idx = Math.min(i, carrusel ? slides.length - 1 : 0)
  const act = carrusel ? slides[idx] : { template, content }
  const piece = <PiecePreview template={act.template} content={act.content} format={format} sizeLock={sizeLock} />
  const ar = `${format.w} / ${format.h}`
  const dk = dark ? ' dark' : ''
  const nav = carrusel && (
    <div className="mk-carrusel">
      <button className="mkc-arrow" disabled={idx === 0} onClick={() => setI(idx - 1)} aria-label="Anterior">‹</button>
      <span className="mkc-dots">
        {slides.map((_, k) => <span key={k} className={'mkc-dot' + (k === idx ? ' on' : '')} onClick={() => setI(k)} />)}
      </span>
      <button className="mkc-arrow" disabled={idx === slides.length - 1} onClick={() => setI(idx + 1)} aria-label="Siguiente">›</button>
      <span className="mkc-num">{idx + 1} de {slides.length}</span>
    </div>
  )

  // ---- STORY / REEL: pantalla completa, acá el marco SÍ suma ----
  if (mockup === 'phone') {
    return (
      <div className="mk-stage-phone">
        <div className="mk-phone">
          <div className="mk-phone-screen">
            <div className="mk-piece" style={{ aspectRatio: ar }}>{piece}</div>
            {carrusel && (
              <div className="mk-story-top" style={{ top: 52 }}>
                {slides.map((_, k) => <span key={k} style={{ background: k === idx ? '#fff' : 'rgba(255,255,255,.45)' }} onClick={() => setI(k)} />)}
              </div>
            )}
            {/* zonas que tapa la app, a escala real sobre 1080×1920:
                arriba 250 px (13%), abajo 340 px (17,7%) */}
            {safeZones && (<><div className="mk-safe top" /><div className="mk-safe bottom" /></>)}
            <div className="mk-story-top"><span /><span /><span /></div>
            <div className="mk-story-user"><img className="mk-av" src={avatarUrl} alt="Magoya" />magoya <span className="mk-time">2 h</span></div>
            <div className="mk-story-reply">
              <span className="mk-reply-input">Enviar mensaje</span>
              <span className="mk-story-ic">{I.heart}</span>
              <span className="mk-story-ic">{I.send}</span>
            </div>
          </div>
          <div className="mk-notch" />
        </div>
      </div>
    )
  }

  // ---- FEED INSTAGRAM: sin teléfono, con vecinos cortados ----
  if (mockup === 'ig') {
    return (
      <div className={'mk-feed-stage' + dk}>
        <Vecino alto={90} cortadoArriba />
        <div className="mk-igcard">
          <div className="mk-ig-head">
            <img className="mk-av ring" src={avatarUrl} alt="Magoya" />
            <span className="mk-ig-name">magoya</span>
            <span className="mk-dots">···</span>
          </div>
          <div className="mk-piece pos" style={{ aspectRatio: ar, width: '100%' }}>
            {piece}
            {carrusel && <span className="mk-ig-count">{idx + 1}/{slides.length}</span>}
          </div>
          {nav}
          <div className="mk-ig-actions">
            <span>{I.heart}</span><span>{I.comment}</span><span>{I.send}</span><span className="mk-save">{I.save}</span>
          </div>
          <div className="mk-ig-likes">128 Me gusta</div>
          <div className="mk-ig-cap"><b>magoya</b> Tu caption acá…</div>
        </div>
        <Vecino alto={120} />
      </div>
    )
  }

  // ---- POST LINKEDIN: la tarjeta al ancho de embed oficial (504 px) ----
  return (
    <div className={'mk-li-stage' + dk}>
      <div className="mk-licard">
        <div className="mk-li-head">
          <img className="mk-av lg sq" src={avatarUrl} alt="Magoya" />
          <div className="mk-li-who">
            <div className="mk-li-name">Magoya</div>
            <div className="mk-li-sub">Product studio · 9.184 seguidores</div>
            <div className="mk-li-sub">1 h · <span className="mk-li-globe">{I.world}</span></div>
          </div>
          <span className="mk-li-follow">+ Seguir</span>
        </div>
        <div className="mk-li-text">
          Texto del posteo acá — LinkedIn corta a las ~140 primeras letras en celular.
          <span className="mk-li-more"> …ver más</span>
        </div>
        <div className="mk-li-media"><div className="mk-piece" style={{ aspectRatio: ar, width: '100%' }}>{piece}</div></div>
        {nav}
        <div className="mk-li-social"><span className="mk-li-reacts" /> 87 · 12 comentarios</div>
        <div className="mk-li-actions">
          <span>{I.like} Recomendar</span><span>{I.comment} Comentar</span><span>{I.repost} Compartir</span><span>{I.send} Enviar</span>
        </div>
      </div>
    </div>
  )
}
