import React, { useRef } from 'react'
import { TEMPLATES, demoContent } from '../templates/index.js'
import { CAROUSELS, buildCarousel } from '../templates/carousels.js'
import { masUsadas } from '../project/uso.js'
import { FORMATS_BY_ID, formatsByNetwork } from '../formats/registry.js'
import PiecePreview from './PiecePreview.jsx'
import Icon from '../ui/Icon.jsx'

// La home resuelve UNA cosa: cómo arrancás. Tres caminos, siempre visibles.
// El formato NO se decide acá (se cambia en el editor cuando querés): sacarlo
// de la home es lo que la hace corta.
// Los filtros preguntan por lo que la persona SÍ sabe contestar.
// "Con foto / sin foto" es una pregunta de diseño: alguien de marketing no
// abre la herramienta pensando eso, abre pensando "vengo a invitar a un
// webinar". Lucho: "hay que ir reduciéndole el lugar… necesitan menos
// lugar para pensar o para la duda".
const FILTERS = [
  { k: 'all', label: 'Todas' },
  { k: 'webinar', label: 'Invitar a algo' },
  { k: 'prueba', label: 'Mostrar un resultado' },
  { k: 'ensenar', label: 'Explicar algo' },
  { k: 'anuncio', label: 'Anunciar' },
  { k: 'equipo', label: 'Equipo y cultura' },
  { k: 'mine', label: 'Mías' },
]
const OBJETIVOS = new Set(['webinar', 'prueba', 'ensenar', 'anuncio', 'equipo', 'cierre'])

export default function Gallery({
  galleryFormat, setGalleryFormat, templates = TEMPLATES, onDeleteTemplate,
  onPick, onStartCarousel, onStartBlank, projects, onOpenProject, onImport, onDeleteProject, onDuplicateProject,
  shares = [], shareCounts = {}, shareVerdicts = {}, onOpenShare, onCopyShare, onForgetShare, thumbs = {},
}) {
  const fileRef = useRef(null)
  const [filter, setFilter] = React.useState('all')
  // Se mostraban sólo los 8 primeros y el resto quedaba inalcanzable: si
  // tenías 19 proyectos, 11 no había forma de abrirlos desde la app.
  const [verTodos, setVerTodos] = React.useState(false)
  const [verTodasShares, setVerTodasShares] = React.useState(false)
  const [carruseles, setCarruseles] = React.useState(false)
  const fmt = galleryFormat
  const groups = formatsByNetwork()
  const byId = Object.fromEntries(templates.map((t) => [t.id, t]))

  // Lo que el equipo YA usa, arriba de todo. Sale de las descargas, no de
  // una encuesta: "volver sobre las piezas que más te sirvieron" (Lucho).
  // Aparece recién cuando hay señal de verdad, para que la home no arranque
  // con una sección vacía.
  const usadas = React.useMemo(() => masUsadas(templates.filter((t) => !t.hidden)), [templates, filter])

  const visible = templates.filter((t) => {
    if (t.hidden) return false        // es variante de otra, no plantilla propia
    if (t.id === 'blank') return false // vive en el acceso grande de arriba
    if (filter === 'mine') return t.custom
    if (OBJETIVOS.has(filter)) return t.objetivo === filter
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
        <button className="start-card" onClick={() => setCarruseles(true)}>
          <span className="sc-ico"><Icon n="grid" size={24} /></span>
          <span className="sc-t">Carrusel</span>
          <span className="sc-s">Portada, internos y cierre, ya armados</span>
        </button>
        <button className="start-card" onClick={() => document.querySelector('.h3-templates')?.scrollIntoView({ behavior: 'smooth' })}>
          <span className="sc-ico"><Icon n="layers" size={24} /></span>
          <span className="sc-t">Desde una plantilla</span>
          <span className="sc-s">{visible.length} diseños ya resueltos</span>
        </button>
      </div>

      {/* Elegir la ESTRUCTURA del carrusel, no las slides una por una.
          "Una portada, tres internos y un cierre" — Inés, textual. */}
      {carruseles && (
        <div className="mk-modal-ov" onClick={() => setCarruseles(false)}>
          <div className="carr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-head">
              <strong>¿Qué carrusel vas a armar?</strong>
              <button className="btn" onClick={() => setCarruseles(false)}>Cerrar</button>
            </div>
            <p className="panel-help" style={{ margin: '0 0 12px' }}>
              Vienen con las slides puestas y el mismo diseño en todas. Reemplazás el texto y listo;
              el slide interno lo multiplicás con “Duplicar”.
            </p>
            <div className="carr-list">
              {CAROUSELS.map((c) => (
                <button key={c.id} className="carr-card" onClick={() => { setCarruseles(false); onStartCarousel(fmt, c) }}>
                  <span className="carr-mini">
                    {buildCarousel(c).map((s, i) => (
                      <span key={i} className="carr-slide"><PiecePreview template={s.template} content={s.content} format={fmt} /></span>
                    ))}
                  </span>
                  <span className="carr-meta">
                    <span className="n">{c.name} · {c.slides.length} slides</span>
                    <span className="purpose">{c.purpose}</span>
                  </span>
                </button>
              ))}
              <button className="carr-card blanco" onClick={() => { setCarruseles(false); onStartCarousel(fmt) }}>
                <span className="carr-meta">
                  <span className="n">Empezar en blanco · 3 slides</span>
                  <span className="purpose">Si ya sabés qué querés y preferís componerlo vos.</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2 · RETOMAR — solo si hay */}
      {projects && projects.length > 0 && (
        <div className="h3-recent">
          <div className="h3-trow">
            <span className="h3-label">Seguir con lo tuyo</span>
            {projects.length > 8 && (
              <button className="linklike" onClick={() => setVerTodos((v) => !v)}>
                {verTodos ? 'Ver menos' : `Ver los ${projects.length}`}
              </button>
            )}
          </div>
          <div className={'proj-row' + (verTodos ? ' wrap' : '')}>
            {(verTodos ? projects : projects.slice(0, 8)).map((p) => {
              const pc = p.pieces?.[0]
              const t = pc && byId[pc.templateId]
              const pf = FORMATS_BY_ID[p.formatId] || fmt
              return (
                <div key={p.id} className="proj-card">
                  <button className="proj-thumb" onClick={() => onOpenProject(p)} title={p.name || 'Seguir editando'}>
                    {t && <PiecePreview template={t} content={thumbs[p.id] || pc.content} format={pf} />}
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
          <div className="h3-trow">
            <span className="h3-label">Compartidas para revisión</span>
            {shares.length > 6 && (
              <button className="linklike" onClick={() => setVerTodasShares((v) => !v)}>
                {verTodasShares ? 'Ver menos' : `Ver las ${shares.length}`}
              </button>
            )}
          </div>
          <div className="share-list">
            {(verTodasShares ? shares : shares.slice(0, 6)).map((sh) => {
              const total = shareCounts[sh.id]
              const nuevos = total === undefined ? 0 : Math.max(0, total - (sh.seen || 0))
              const v = shareVerdicts[sh.id]
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
                    {v && (
                      <span className={'sr-verdict' + (v.verdict === 'ok' ? ' ok' : '')}
                        title={`${v.author || 'Alguien'} · ${new Date(v.created_at).toLocaleDateString('es-AR')}`}>
                        {v.verdict === 'ok' ? 'Aprobada' : 'Pide cambios'}
                      </span>
                    )}
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

      {/* Lo que más usan, cuando ya hay datos */}
      {usadas.length > 0 && (
        <div className="h3-recent">
          <div className="h3-trow"><span className="h3-label">Las que más usás</span></div>
          <div className="h3-grid">
            {usadas.map(({ t, veces }) => (
              <div key={t.id} className="h3-card">
                <button className="h3-thumb" onClick={() => onPick(t, fmt)} title={t.purpose}>
                  <PiecePreview template={t} content={demoContent(t)} format={fmt} />
                </button>
                <div className="h3-name">{t.name}</div>
                <div className="purpose">{veces} descargas</div>
              </div>
            ))}
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
                <PiecePreview template={t} content={demoContent(t)} format={fmt} />
                {t.custom && onDeleteTemplate && (
                  <button className="tpl-del" title="Eliminar plantilla" onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id) }}><Icon n="close" size={11} /></button>
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
