import React, { useRef } from 'react'
import { TEMPLATES, CATEGORIES, placeholderContent } from '../templates/index.js'
import { FORMATS_BY_ID, formatsByNetwork } from '../formats/registry.js'
import PiecePreview from './PiecePreview.jsx'

const GROUP_USE = {
  square: 'Cuadrado — feed',
  portrait45: 'Retrato — ocupa más en el feed',
  vertical916: 'Vertical — pantalla completa (stories/reels)',
  landscape169: 'Horizontal — video / presentación',
  landscapeWide: 'Horizontal ancho — banner / link',
  landscape43: 'Clásico 4:3',
}

// orden de secciones en la home (las de contenido primero, "empezar de cero" al final)
const SECTION_ORDER = ['metric', 'quote', 'post', 'zocalo', 'chat']

function RatioBox({ w, h, on }) {
  const max = 14
  const s = w >= h ? { width: max, height: (max * h) / w } : { width: (max * w) / h, height: max }
  return <span className="ratio-box" style={{ ...s, background: on ? 'var(--ink-900)' : '#C9C2B6' }} />
}

// línea de variables (mono): qué completa el usuario
function varsLine(t) {
  if (t.category === 'chat') return 'Mensajes · Nombre del chat'
  if (t.freeform) return 'Fondo · Textos · Elementos'
  const map = { title: 'Título', subtitle: 'Bajada', kicker: 'Etiqueta', metric: 'Dato', metricLabel: 'Descripción', quote: 'Cita', author: 'Autor', body: 'Cuerpo' }
  const parts = []
  if (t.surface === 'photo') parts.push('Foto')
  ;(t.roles || []).forEach((r) => map[r] && parts.push(map[r]))
  return parts.join(' · ') || 'Listo para usar'
}

export default function Gallery({ galleryFormat, setGalleryFormat, templates = TEMPLATES, onDeleteTemplate, onPick, onStartCarousel, projects, onOpenProject, onImport, onDeleteProject, onDuplicateProject }) {
  const fileRef = useRef(null)
  const [cat, setCat] = React.useState('all')
  const [surface, setSurface] = React.useState('all') // all | photo | solid
  const groups = formatsByNetwork()
  const fmt = galleryFormat
  const network = fmt.network
  const pickNet = (net) => setGalleryFormat(groups[net][0])
  const byId = Object.fromEntries(templates.map((t) => [t.id, t]))

  // filtros combinables: categoría (rail) + superficie (refinamiento)
  const bySurface = (t) => surface === 'all' || (surface === 'photo' ? t.surface === 'photo' : t.surface !== 'photo')
  const catCount = (k) => templates.filter((t) => (k === 'mine' ? t.custom : t.category === k)).filter(bySurface).length
  const visible = templates.filter((t) => {
    if (cat === 'all') return true
    if (cat === 'mine') return t.custom
    return t.category === cat
  }).filter(bySurface)

  // agrupar para "Todas": secciones por categoría + "empezar de cero" al final
  const sections = []
  if (cat === 'all') {
    for (const k of SECTION_ORDER) {
      const items = visible.filter((t) => t.category === k && !t.custom)
      if (items.length) sections.push({ key: k, title: CATEGORIES[k] || k, items })
    }
    const mine = visible.filter((t) => t.custom)
    if (mine.length) sections.push({ key: 'mine', title: 'Mis plantillas', items: mine })
    const zero = visible.filter((t) => t.category === 'libre')
    sections.push({ key: 'zero', title: 'Empezar de cero', items: zero, withCarousel: true })
  } else {
    sections.push({ key: cat, title: cat === 'mine' ? 'Mis plantillas' : (CATEGORIES[cat] || cat), items: visible, withCarousel: cat === 'libre' })
  }

  const railItems = [
    { k: 'all', label: 'Todas', count: templates.filter(bySurface).length },
    ...SECTION_ORDER.map((k) => ({ k, label: CATEGORIES[k], count: catCount(k) })),
    { k: 'libre', label: 'En blanco', count: catCount('libre') },
    { k: 'mine', label: 'Mías', count: catCount('mine') },
  ]

  return (
    <div className="gallery compact home2">
      <div className="g-head">
        <div className="g-head-left">
          <h1>¿Qué vas a crear?</h1>
          <button className="linklike" onClick={() => fileRef.current?.click()}
            title="Si alguien te pasó un archivo .magoya.json, abrilo acá">¿Te compartieron un proyecto?</button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
            onChange={(e) => e.target.files[0] && onImport(e.target.files[0])} />
        </div>
        <div className="dest-stack">
          <div className="dest-row">
            <span className="dest-label-sm">1 · Red</span>
            <div className="nettabs">
              {Object.keys(groups).map((net) => (
                <button key={net} className={'nettab' + (network === net ? ' on' : '')} onClick={() => pickNet(net)}>{net}</button>
              ))}
            </div>
          </div>
          <div className="dest-row">
            <span className="dest-label-sm">2 · Formato</span>
            <div className="fmttabs slim">
              {groups[network].map((f) => (
                <button key={f.id} className={'fmttab' + (f.id === fmt.id ? ' on' : '')} onClick={() => setGalleryFormat(f)}
                  title={`${f.w}×${f.h} · ${GROUP_USE[f.group] || ''}`}>
                  <RatioBox w={f.w} h={f.h} on={f.id === fmt.id} />
                  <span className="fl">{f.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {(!projects || projects.length === 0) && (
        <div className="g-firsttime">
          <b>Todavía no creaste nada.</b> Elegí una plantilla acá abajo y en 2 minutos tenés la pieza lista para publicar.
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="g-retomar">
          <span className="ret-label">Retomar</span>
          <div className="proj-row">
            {projects.slice(0, 10).map((p) => {
              const pc = p.pieces?.[0]
              const t = pc && byId[pc.templateId]
              const pf = FORMATS_BY_ID[p.formatId] || fmt
              return (
                <div key={p.id} className="proj-card">
                  <button className="proj-thumb" onClick={() => onOpenProject(p)} title="Seguir editando">
                    {t && <PiecePreview template={t} content={pc.content} format={pf} />}
                  </button>
                  <div className="proj-meta">
                    <span className="proj-name" title={p.name}>{p.name || 'Sin título'}</span>
                    <span className="proj-acts">
                      {onDuplicateProject && <button className="proj-act" onClick={() => onDuplicateProject(p)} title="Duplicar (no pisa el original)">⧉</button>}
                      <button className="proj-act del" onClick={() => onDeleteProject(p.id)} title="Eliminar proyecto">✕</button>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <nav className="g-rail">
        {railItems.map((r) => (
          <button key={r.k} className={'rail-item' + (cat === r.k ? ' on' : '')} onClick={() => setCat(r.k)}>
            <span>{r.label}</span><span className="rail-count">{r.count}</span>
          </button>
        ))}
        <hr className="rail-hr" />
        <div className="rail-sub">Refinar</div>
        {[['all', 'Todo'], ['photo', 'Con foto'], ['solid', 'Solo color']].map(([k, l]) => (
          <button key={k} className={'rail-item sm' + (surface === k ? ' on' : '')} onClick={() => setSurface(k)}>{l}</button>
        ))}
      </nav>

      <div className="g-content">
        {sections.map((sec) => (
          <div key={sec.key}>
            <div className="sec-title2">{sec.title}</div>
            <div className="tgrid2">
              {sec.withCarousel && onStartCarousel && (
                <div className="tcard action-card" role="button" tabIndex={0} onClick={() => onStartCarousel(fmt)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onStartCarousel(fmt)}>
                  <div className="thumb fixed action">
                    <span className="action-ic">▦</span>
                    <span className="action-t">Armar un carrusel</span>
                    <span className="action-s">Varias slides, componés cada una</span>
                  </div>
                </div>
              )}
              {sec.items.map((t) => (
                <div key={t.id} className="tcard" role="button" tabIndex={0} onClick={() => onPick(t, fmt)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(t, fmt)}>
                  <div className="thumb fixed">
                    <span className={'fmt-tag ' + (t.surface === 'photo' ? 'img' : 'txt')}>{t.surface === 'photo' ? 'IMAGEN' : 'TEXTO'}</span>
                    {t.custom && <span className="mine-tag">Mía</span>}
                    {t.custom && onDeleteTemplate && (
                      <button className="tpl-del" title="Eliminar plantilla" onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id) }}>✕</button>
                    )}
                    <PiecePreview template={t} content={placeholderContent(t)} format={fmt} />
                    <span className="use-btn">Usar →</span>
                  </div>
                  <div className="meta">
                    <div className="n">{t.name}</div>
                    <div className="purpose2">{t.purpose}</div>
                    <div className="vars">{varsLine(t)}</div>
                  </div>
                </div>
              ))}
              {sec.items.length === 0 && !sec.withCarousel && (
                <div className="empty-filters">
                  Ninguna plantilla acá con este filtro.
                  <button className="linklike" onClick={() => { setSurface('all'); setCat('all') }}>Limpiar filtros</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
