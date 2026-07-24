import React, { useRef } from 'react'
import { TEMPLATES, TEMPLATES_BY_ID, CATEGORIES } from '../templates/index.js'
import { FORMATS_BY_ID } from '../formats/registry.js'
import PiecePreview from './PiecePreview.jsx'

const THUMB_FORMAT = FORMATS_BY_ID['ig-post']

export default function Gallery({ onPick, projects, onOpenProject, onImport, onDeleteProject }) {
  const fileRef = useRef(null)

  const byCat = {}
  for (const t of TEMPLATES) (byCat[t.category] ||= []).push(t)

  return (
    <div className="gallery">
      <h1>Magoya Studio</h1>
      <p className="lead">
        Piezas para redes <b>on-brand por diseño</b>. Elegís una plantilla, cambiás foto, texto y logo, y descargás en el
        formato de cada red. La marca queda <span className="mark">bloqueada</span> — imposible que se desvíe.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={() => fileRef.current?.click()}>↑ Importar proyecto (.magoya.json)</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files[0] && onImport(e.target.files[0])}
        />
      </div>

      {projects && projects.length > 0 && (
        <>
          <div className="section-title">Tus proyectos</div>
          <div className="grid">
            {projects.map((p) => (
              <div key={p.id} className="tcard">
                <button className="thumb" style={{ border: 0, width: '100%' }} onClick={() => onOpenProject(p)} title="Abrir">
                  <ProjectThumb project={p} />
                </button>
                <div className="meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="n">{p.name || 'Sin título'}</div>
                    <div className="c">{FORMATS_BY_ID[p.formatId]?.label || p.formatId}</div>
                  </div>
                  <button className="btn" style={{ padding: '4px 10px' }} onClick={() => onDeleteProject(p.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {Object.entries(byCat).map(([cat, tpls]) => (
        <div key={cat}>
          <div className="section-title">{CATEGORIES[cat] || cat}</div>
          <div className="grid">
            {tpls.map((t) => (
              <button key={t.id} className="tcard" onClick={() => onPick(t)}>
                <div className="thumb">
                  <PiecePreview template={t} content={t.defaults} format={THUMB_FORMAT} />
                </div>
                <div className="meta">
                  <div className="n">{t.name}</div>
                  <div className="c">{CATEGORIES[t.category] || t.category}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ProjectThumb({ project }) {
  const tpl = TEMPLATES_BY_ID[project.templateId]
  if (!tpl) return <div style={{ padding: 20, color: '#fff', fontSize: 12 }}>?</div>
  return <PiecePreview template={tpl} content={project.content} format={THUMB_FORMAT} />
}
