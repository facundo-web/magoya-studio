import React, { useState, useEffect } from 'react'
import Gallery from './editor/Gallery.jsx'
import Editor from './editor/Editor.jsx'
import { TEMPLATES_BY_ID } from './templates/index.js'
import { FORMATS_BY_ID } from './formats/registry.js'
import {
  loadProjects, upsertProject, deleteProject, newProjectId,
  exportProjectFile, importProjectFile, toShareLink, fromShareLink,
} from './project/store.js'

const DEFAULT_FORMAT = 'ig-post'

export default function App() {
  const [view, setView] = useState('gallery')
  const [mode, setMode] = useState('quick') // quick | designer
  const [projects, setProjects] = useState([])
  const [toast, setToast] = useState(null)

  // pieza(s) en edición
  const [projectId, setProjectId] = useState(null)
  const [projectName, setProjectName] = useState('')
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT)
  const [pieces, setPieces] = useState([]) // [{template, content}]
  const [active, setActive] = useState(0)
  const [carousel, setCarousel] = useState(false)

  useEffect(() => {
    setProjects(loadProjects())
    // ¿link compartido?
    const shared = fromShareLink()
    if (shared) openFromSerialized(shared)
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    clearTimeout(window.__mt)
    window.__mt = setTimeout(() => setToast(null), 2200)
  }

  const format = FORMATS_BY_ID[formatId] || FORMATS_BY_ID[DEFAULT_FORMAT]
  const current = pieces[active] || null

  // ---- iniciar desde template ----
  function pickTemplate(template) {
    setProjectId(newProjectId())
    setProjectName(template.defaults?.title || template.name)
    setFormatId(DEFAULT_FORMAT)
    setPieces([{ template, content: { ...template.defaults } }])
    setActive(0)
    setCarousel(false)
    setView('editor')
  }

  // ---- abrir proyecto guardado / serializado ----
  function openFromSerialized(p) {
    const ps = (p.pieces || []).map((pp) => ({
      template: TEMPLATES_BY_ID[pp.templateId],
      content: pp.content || {},
    })).filter((x) => x.template)
    if (!ps.length) {
      showToast('No se pudo abrir el proyecto')
      return
    }
    setProjectId(p.id || newProjectId())
    setProjectName(p.name || '')
    setFormatId(FORMATS_BY_ID[p.formatId] ? p.formatId : DEFAULT_FORMAT)
    setPieces(ps)
    setActive(0)
    setCarousel(!!p.carousel)
    setView('editor')
  }

  function serialize() {
    return {
      id: projectId,
      name: projectName,
      formatId,
      carousel,
      pieces: pieces.map((p) => ({ templateId: p.template.id, content: p.content })),
    }
  }

  // ---- editar ----
  function changeContent(next) {
    setPieces((ps) => ps.map((p, i) => (i === active ? { ...p, content: next } : p)))
    if (active === 0 && next.title) setProjectName(next.title)
  }
  function addSlide() {
    setPieces((ps) => {
      const src = ps[active]
      return [...ps, { template: src.template, content: { ...src.content, photo: null } }]
    })
    setCarousel(true)
    setActive(pieces.length)
    showToast('Slide agregada')
  }
  function deleteSlide(i) {
    setPieces((ps) => {
      const next = ps.filter((_, idx) => idx !== i)
      return next.length ? next : ps
    })
    setActive((a) => Math.max(0, a - (i <= a ? 1 : 0)))
    if (pieces.length - 1 <= 1) setCarousel(false)
  }

  // ---- acciones ----
  function save() {
    const proj = serialize()
    const next = upsertProject(proj)
    setProjects(next)
    showToast('✓ Proyecto guardado')
  }
  function share() {
    const link = toShareLink(serialize())
    navigator.clipboard?.writeText(link)
    showToast('✓ Link copiado (sin foto — para foto usá el archivo)')
  }
  async function importFile(file) {
    try {
      const p = await importProjectFile(file)
      openFromSerialized(p)
      showToast('✓ Proyecto importado')
    } catch {
      showToast('⚠ Archivo inválido')
    }
  }
  function removeProject(id) {
    setProjects(deleteProject(id))
    showToast('Proyecto eliminado')
  }

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">Magoya <b>Studio</b></span>
        {view === 'editor' && (
          <>
            <button className="btn ghost-light" onClick={() => setView('gallery')}>← Galería</button>
            <div className="seg" title="Modo de edición">
              <button className={mode === 'quick' ? 'on' : ''} onClick={() => setMode('quick')}>Rápido</button>
              <button className={mode === 'designer' ? 'on' : ''} onClick={() => setMode('designer')}>Diseñador</button>
            </div>
          </>
        )}
        <div className="spacer" />
        {view === 'editor' && (
          <>
            <button className="btn ghost-light" onClick={() => exportProjectFile(serialize())}>Exportar proyecto</button>
            <button className="btn ghost-light" onClick={share}>Compartir</button>
            <button className="btn primary" onClick={save}>Guardar</button>
          </>
        )}
        {view === 'gallery' && <span className="badge">on-brand por diseño · v0.1</span>}
      </div>

      {view === 'gallery' ? (
        <Gallery
          onPick={pickTemplate}
          projects={projects}
          onOpenProject={openFromSerialized}
          onDeleteProject={removeProject}
          onImport={importFile}
        />
      ) : current ? (
        <Editor
          template={current.template}
          content={current.content}
          format={format}
          mode={mode}
          slides={carousel ? pieces : null}
          activeSlide={active}
          onChangeContent={changeContent}
          onChangeFormat={(f) => setFormatId(f.id)}
          onSelectSlide={setActive}
          onAddSlide={addSlide}
          onDeleteSlide={deleteSlide}
          onToast={showToast}
        />
      ) : (
        <div className="center-note">Cargando…</div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
