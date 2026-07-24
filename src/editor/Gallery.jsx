import React, { useRef } from 'react'
import { TEMPLATES, TEMPLATES_BY_ID, CATEGORIES } from '../templates/index.js'
import { FORMATS_BY_ID, formatsByNetwork } from '../formats/registry.js'
import PiecePreview from './PiecePreview.jsx'

// descripción de uso por familia de proporción (autoexplicativo)
const GROUP_USE = {
  square: 'Cuadrado — feed',
  portrait45: 'Retrato — ocupa más en el feed',
  vertical916: 'Vertical — pantalla completa (stories/reels)',
  landscape169: 'Horizontal — video / presentación',
  landscapeWide: 'Horizontal ancho — banner / link',
  landscape43: 'Clásico 4:3',
}

function RatioBox({ w, h, on }) {
  const max = 20
  const s = w >= h ? { width: max, height: (max * h) / w } : { width: (max * w) / h, height: max }
  return (
    <span className="ratio-box" style={{ ...s, background: on ? 'var(--emerald-500)' : '#C9C2B6' }} />
  )
}

export default function Gallery({ galleryFormat, setGalleryFormat, onPick, projects, onOpenProject, onImport, onDeleteProject }) {
  const fileRef = useRef(null)
  const groups = formatsByNetwork()
  const fmt = galleryFormat

  const byCat = {}
  for (const t of TEMPLATES) (byCat[t.category] ||= []).push(t)

  return (
    <div className="gallery">
      <h1>Magoya Studio</h1>
      <p className="lead">
        Creá piezas para redes <b>on-brand</b> en minutos, sin diseñador. La marca queda <span className="mark">bloqueada</span> — imposible que se desvíe.
      </p>

      <div className="how">
        <span className="how-step"><b>1</b> Elegí dónde publicar</span>
        <span className="how-sep">→</span>
        <span className="how-step"><b>2</b> Elegí una plantilla</span>
        <span className="how-sep">→</span>
        <span className="how-step"><b>3</b> Editá y descargá</span>
      </div>

      <div className="open-file">
        ¿Te compartieron un proyecto para seguir editando?
        <button className="linklike" onClick={() => fileRef.current?.click()}>Abrir archivo .magoya.json</button>
        <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
          onChange={(e) => e.target.files[0] && onImport(e.target.files[0])} />
      </div>

      {projects && projects.length > 0 && (
        <>
          <div className="section-title">Tus proyectos</div>
          <div className="grid">
            {projects.map((p) => {
              const ptpl = TEMPLATES_BY_ID[p.templateId]
              const pfmt = FORMATS_BY_ID[p.formatId] || fmt
              return (
                <div key={p.id} className="tcard">
                  <button className="thumb" style={{ border: 0, width: '100%', aspectRatio: `${pfmt.w}/${pfmt.h}` }} onClick={() => onOpenProject(p)}>
                    {ptpl && <PiecePreview template={ptpl} content={p.content} format={pfmt} />}
                  </button>
                  <div className="meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="n">{p.name || 'Sin título'}</div>
                      <div className="c">{pfmt.network} · {pfmt.label}</div>
                    </div>
                    <button className="btn" style={{ padding: '4px 10px' }} onClick={() => onDeleteProject(p.id)}>✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Paso 1 — destino */}
      <div className="step">1 · ¿Dónde lo vas a publicar?</div>
      <div className="dest">
        {Object.entries(groups).map(([net, list]) => (
          <div className="netgroup" key={net}>
            <div className="netname">{net}</div>
            <div className="fchips">
              {list.map((f) => {
                const on = f.id === fmt.id
                return (
                  <button key={f.id} className={'fchip' + (on ? ' on' : '')} onClick={() => setGalleryFormat(f)}
                    title={`${f.w}×${f.h} · ${GROUP_USE[f.group] || ''}`}>
                    <RatioBox w={f.w} h={f.h} on={on} />
                    <span className="fl">{f.label}</span>
                    <span className="fd">{f.w}×{f.h}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="dest-summary">
        Elegido: <b>{fmt.network} · {fmt.label}</b> · {fmt.w}×{fmt.h} — {GROUP_USE[fmt.group]}
      </div>

      {/* Paso 2 — plantilla */}
      <div className="step">2 · Elegí una plantilla</div>
      {Object.entries(byCat).map(([cat, tpls]) => (
        <div key={cat}>
          <div className="section-title">{CATEGORIES[cat] || cat}</div>
          <div className="grid">
            {tpls.map((t) => (
              <button key={t.id} className="tcard" onClick={() => onPick(t, fmt)}>
                <div className="thumb" style={{ aspectRatio: `${fmt.w}/${fmt.h}` }}>
                  <PiecePreview template={t} content={t.defaults} format={fmt} />
                </div>
                <div className="meta">
                  <div className="n">{t.name}</div>
                  <div className="purpose">{t.purpose}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
