import React, { useRef } from 'react'
import { TEMPLATES, TEMPLATES_BY_ID, CATEGORIES, placeholderContent } from '../templates/index.js'
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

function RatioBox({ w, h, on }) {
  const max = 16
  const s = w >= h ? { width: max, height: (max * h) / w } : { width: (max * w) / h, height: max }
  return <span className="ratio-box" style={{ ...s, background: on ? 'var(--ink-900)' : '#C9C2B6' }} />
}

const FILTERS = [
  { k: 'all', label: 'Todas', test: () => true },
  { k: 'mine', label: 'Mías', test: (t) => t.custom },
  { k: 'photo', label: 'Con foto', test: (t) => t.surface === 'photo' },
  { k: 'solid', label: 'Sin foto (color)', test: (t) => t.surface !== 'photo' },
  { k: 'dato', label: 'Dato', test: (t) => (t.roles || []).includes('metric') },
  { k: 'cita', label: 'Cita', test: (t) => (t.roles || []).includes('quote') },
]

function templateBadges(t) {
  const b = []
  if (t.surface === 'photo') b.push('Foto')
  if ((t.roles || []).includes('title')) b.push('Título')
  if ((t.roles || []).includes('metric')) b.push('Dato')
  if ((t.roles || []).includes('quote')) b.push('Cita')
  if ((t.roles || []).includes('subtitle')) b.push('Bajada')
  b.push('Logo')
  return b
}

export default function Gallery({ galleryFormat, setGalleryFormat, templates = TEMPLATES, onDeleteTemplate, onPick, onStartCarousel, projects, onOpenProject, onImport, onDeleteProject }) {
  const fileRef = useRef(null)
  const [filter, setFilter] = React.useState('all')
  const groups = formatsByNetwork()
  const fmt = galleryFormat
  const network = fmt.network
  const pickNet = (net) => setGalleryFormat(groups[net][0])
  const byId = Object.fromEntries(templates.map((t) => [t.id, t]))
  const shownTemplates = templates.filter((FILTERS.find((f) => f.k === filter) || FILTERS[0]).test)

  return (
    <div className="gallery compact">
      <div className="g-head">
        <h1>Crear una pieza</h1>
        <p className="lead">Elegí la red y una plantilla. Vos ponés la <b>foto y el texto</b>; los colores, la tipografía y el logo ya salen de la marca.</p>
      </div>

      {projects && projects.length > 0 && (
        <div className="proj-strip">
          <span className="strip-label">Tus proyectos:</span>
          {projects.slice(0, 12).map((p) => {
            const t = byId[p.templateId]
            const pf = FORMATS_BY_ID[p.formatId] || fmt
            return (
              <div key={p.id} className="proj-mini" title={p.name}>
                <button className="pm-open" onClick={() => onOpenProject(p)}>
                  {t && <PiecePreview template={t} content={p.content} format={pf} />}
                </button>
                <button className="pm-del" onClick={() => onDeleteProject(p.id)} title="Eliminar">✕</button>
              </div>
            )
          })}
        </div>
      )}

      <div className="g-dest">
        <div className="dest-label"><b>1</b> ¿Dónde publicás?</div>
        <div className="nettabs">
          {Object.keys(groups).map((net) => (
            <button key={net} className={'nettab' + (network === net ? ' on' : '')} onClick={() => pickNet(net)}>{net}</button>
          ))}
        </div>
        <div className="fmttabs">
          {groups[network].map((f) => (
            <button key={f.id} className={'fmttab' + (f.id === fmt.id ? ' on' : '')} onClick={() => setGalleryFormat(f)}
              title={GROUP_USE[f.group]}>
              <RatioBox w={f.w} h={f.h} on={f.id === fmt.id} />
              <span className="fl">{f.label}</span>
              <span className="fd">{f.w}×{f.h}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="g-templates">
        <div className="dest-label">
          <b>2</b> Elegí una plantilla
          <div className="tfilters">
            {FILTERS.map((f) => (
              <button key={f.k} className={'tfilter' + (filter === f.k ? ' on' : '')} onClick={() => setFilter(f.k)}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="tgrid">
          {filter === 'all' && onStartCarousel && (
            <div className="tcard action-card" role="button" tabIndex={0} onClick={() => onStartCarousel(fmt)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onStartCarousel(fmt)}>
              <div className="thumb fixed action">
                <span className="action-ic">⊞</span>
                <span className="action-t">Armar un carrusel</span>
                <span className="action-s">Varias slides, componés cada una</span>
              </div>
            </div>
          )}
          {shownTemplates.map((t) => (
            <div key={t.id} className="tcard" role="button" tabIndex={0} onClick={() => onPick(t, fmt)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(t, fmt)}>
              <div className="thumb fixed">
                <span className={'fmt-tag ' + (t.surface === 'photo' ? 'img' : 'txt')}>{t.surface === 'photo' ? 'IMAGEN' : 'TEXTO'}</span>
                {t.custom && <span className="mine-tag">Mía</span>}
                {t.custom && onDeleteTemplate && (
                  <button className="tpl-del" title="Eliminar plantilla" onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id) }}>✕</button>
                )}
                <PiecePreview template={t} content={placeholderContent(t)} format={fmt} />
              </div>
              <div className="meta">
                <div className="n">{t.name}</div>
                <div className="badges">
                  {templateBadges(t).map((b) => <span key={b} className="badge-var">{b}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
