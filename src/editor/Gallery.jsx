import React, { useRef } from 'react'
import { TEMPLATES, placeholderContent } from '../templates/index.js'
import { FORMATS_BY_ID, FORMATS, formatsByNetwork } from '../formats/registry.js'
import PiecePreview from './PiecePreview.jsx'
import Icon from '../ui/Icon.jsx'

// La home resuelve UNA cosa: cómo arrancás. Tres caminos, siempre visibles.
// El formato NO se decide acá (se cambia en el editor cuando querés): sacarlo
// de la home es lo que la hace corta.
const FILTERS = [
  { k: 'all', label: 'Todas' },
  { k: 'photo', label: 'Con foto' },
  { k: 'solid', label: 'Sin foto' },
  { k: 'mine', label: 'Mías' },
]

export default function Gallery({
  galleryFormat, setGalleryFormat, templates = TEMPLATES, onDeleteTemplate,
  onPick, onStartCarousel, onStartBlank, projects, onOpenProject, onImport, onDeleteProject, onDuplicateProject,
  shares = [], shareCounts = {}, onOpenShare, onCopyShare, onForgetShare,
}) {
  const fileRef = useRef(null)
  const [filter, setFilter] = React.useState('all')
  const fmt = galleryFormat
  const groups = formatsByNetwork()
  const byId = Object.fromEntries(templates.map((t) => [t.id, t]))
  const blank = templates.find((t) => t.id === 'blank')

  const visible = templates.filter((t) => {
    if (t.id === 'blank') return false // vive en el acceso grande de arriba
    if (filter === 'mine') return t.custom
    if (filter === 'photo') return t.surface === 'photo'
    if (filter === 'solid') return t.surface !== 'photo'
    return true
  })

  return (
    <div className="home3">
      {/* 1 · CÓMO ARRANCÁS — la única decisión de la home */}
      <div className="h3-head">
        <h1>¿Qué vas a crear?</h1>
        <div className="h3-fmt">
          <span>Tamaño</span>
          <select value={fmt.id} onChange={(e) => setGalleryFormat(FORMATS_BY_ID[e.target.value])}
            title="Lo podés cambiar en cualquier momento mientras editás">
            {Object.entries(groups).map(([net, list]) => (
              <optgroup key={net} label={net}>
                {list.map((f) => <option key={f.id} value={f.id}>{f.label} · {f.w}×{f.h}</option>)}
              </optgroup>
            ))}
          </select>
          <button className="linklike" onClick={() => fileRef.current?.click()}>Abrir un archivo</button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
            onChange={(e) => e.target.files[0] && onImport(e.target.files[0])} />
        </div>
      </div>

      <div className="h3-start">
        <button className="start-card primary" onClick={() => onStartBlank(fmt)}>
          <span className="sc-ico"><Icon n="plus" size={24} /></span>
          <span className="sc-t">Empezar en blanco</span>
          <span className="sc-s">Armá la tuya desde cero</span>
        </button>
        <button className="start-card" onClick={() => onStartCarousel(fmt)}>
          <span className="sc-ico"><Icon n="grid" size={24} /></span>
          <span className="sc-t">Carrusel</span>
          <span className="sc-s">Varias slides que cuentan algo</span>
        </button>
        <button className="start-card" onClick={() => document.querySelector('.h3-templates')?.scrollIntoView({ behavior: 'smooth' })}>
          <span className="sc-ico"><Icon n="layers" size={24} /></span>
          <span className="sc-t">Desde una plantilla</span>
          <span className="sc-s">{visible.length} diseños ya resueltos</span>
        </button>
      </div>

      {/* 2 · RETOMAR — solo si hay */}
      {projects && projects.length > 0 && (
        <div className="h3-recent">
          <span className="h3-label">Seguir con lo tuyo</span>
          <div className="proj-row">
            {projects.slice(0, 8).map((p) => {
              const pc = p.pieces?.[0]
              const t = pc && byId[pc.templateId]
              const pf = FORMATS_BY_ID[p.formatId] || fmt
              return (
                <div key={p.id} className="proj-card">
                  <button className="proj-thumb" onClick={() => onOpenProject(p)} title={p.name || 'Seguir editando'}>
                    {t && <PiecePreview template={t} content={pc.content} format={pf} />}
                  </button>
                  <div className="proj-meta">
                    <span className="proj-name" title={p.name}>{p.name || 'Sin título'}</span>
                    <span className="proj-acts">
                      {onDuplicateProject && <button className="proj-act" onClick={() => onDuplicateProject(p)} title="Duplicar"><Icon n="copy" size={12} /></button>}
                      <button className="proj-act del" onClick={() => onDeleteProject(p.id)} title="Eliminar"><Icon n="close" size={12} /></button>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 2b · COMPARTIDAS — D4: si perdés el link, perdés el feedback */}
      {shares.length > 0 && (
        <div className="h3-recent">
          <span className="h3-label">Compartidas para revisión</span>
          <div className="share-list">
            {shares.slice(0, 6).map((sh) => {
              const total = shareCounts[sh.id]
              const nuevos = total === undefined ? 0 : Math.max(0, total - (sh.seen || 0))
              return (
                <div key={sh.id} className="share-row">
                  <button className="share-open" onClick={() => onOpenShare && onOpenShare(sh)}
                    title="Abrir la vista de revisión y leer los comentarios">
                    <span className="sr-name">{sh.name}</span>
                    <span className="sr-meta">
                      {total === undefined ? 'buscando comentarios…'
                        : total === 0 ? 'sin comentarios todavía'
                        : `${total} comentario${total === 1 ? '' : 's'}`}
                    </span>
                    {nuevos > 0 && <span className="sr-badge" title="Comentarios que todavía no leíste">{nuevos} nuevo{nuevos === 1 ? '' : 's'}</span>}
                  </button>
                  <button className="proj-act" title="Copiar el link" onClick={() => onCopyShare && onCopyShare(sh)}><Icon n="copy" size={13} /></button>
                  <button className="proj-act del" title="Sacar de la lista (el link sigue funcionando)" onClick={() => onForgetShare && onForgetShare(sh.id)}><Icon n="close" size={13} /></button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3 · PLANTILLAS — visual, sin texto de más */}
      <div className="h3-templates">
        <div className="h3-trow">
          <span className="h3-label">Plantillas</span>
          <div className="h3-filters">
            {FILTERS.map((f) => (
              <button key={f.k} className={'h3-filter' + (filter === f.k ? ' on' : '')} onClick={() => setFilter(f.k)}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="h3-grid">
          {visible.map((t) => (
            <div key={t.id} className="h3-card" role="button" tabIndex={0} onClick={() => onPick(t, fmt)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(t, fmt)} title={t.purpose}>
              <div className="h3-thumb">
                <PiecePreview template={t} content={placeholderContent(t)} format={fmt} />
                {t.custom && onDeleteTemplate && (
                  <button className="tpl-del" title="Eliminar plantilla" onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id) }}>✕</button>
                )}
                <span className="h3-use">Usar →</span>
              </div>
              <div className="h3-name">{t.name}{t.custom && <span className="h3-mine">mía</span>}</div>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="empty-filters">
              No hay plantillas con este filtro.
              <button className="linklike" onClick={() => setFilter('all')}>Ver todas</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
