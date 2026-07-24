import React, { useState, useEffect } from 'react'
import Gallery from './editor/Gallery.jsx'
import Editor from './editor/Editor.jsx'
import BrandKit from './editor/BrandKit.jsx'
import { TEMPLATES, TEMPLATES_BY_ID, BLANK_TEMPLATE } from './templates/index.js'
import { FORMATS_BY_ID, CAROUSEL_FORMATS } from './formats/registry.js'
import {
  loadProjects, upsertProject, deleteProject, newProjectId,
  exportProjectFile, importProjectFile, toShareLink, fromShareLink,
  loadElements, addElement, deleteElement,
  loadCustomTemplates, buildTemplateFromPiece, saveCustomTemplate, deleteCustomTemplate,
} from './project/store.js'

const DEFAULT_FORMAT = 'ig-post'

export default function App() {
  const [view, setView] = useState('gallery')
  const [projects, setProjects] = useState([])
  const [elements, setElements] = useState([])
  const [customTemplates, setCustomTemplates] = useState([])
  const [toast, setToast] = useState(null)

  const allTemplates = [...TEMPLATES, ...customTemplates]
  const allById = Object.fromEntries(allTemplates.map((t) => [t.id, t]))

  // contenido inicial desde una plantilla, clonando arrays (sin refs compartidas)
  const freshContent = (tpl) => {
    const d = tpl.defaults || {}
    return {
      ...d,
      textBlocks: (d.textBlocks || []).map((b) => ({ ...b })),
      objects: (d.objects || []).map((o) => ({ ...o })),
    }
  }

  // pieza(s) en edición
  const [projectId, setProjectId] = useState(null)
  const [projectName, setProjectName] = useState('')
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT)
  const [galleryFormatId, setGalleryFormatId] = useState(DEFAULT_FORMAT)
  const [pieces, setPieces] = useState([]) // [{template, content}]
  const [active, setActive] = useState(0)
  const [carousel, setCarousel] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setProjects(loadProjects())
    setElements(loadElements())
    setCustomTemplates(loadCustomTemplates())
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

  // autosave: guarda el proyecto en edición tras cada cambio (debounced)
  useEffect(() => {
    if (view !== 'editor' || !projectId || !pieces.length || !dirty) return
    const t = setTimeout(() => setProjects(upsertProject(serialize())), 800)
    return () => clearTimeout(t)
  }, [dirty, pieces, formatId, carousel, view, projectId])

  // ---- iniciar desde template ----
  function pickTemplate(template, chosenFormat) {
    setProjectId(newProjectId())
    setProjectName(template.defaults?.title || template.name)
    setFormatId(chosenFormat?.id || galleryFormatId || DEFAULT_FORMAT)
    setPieces([{ template, content: freshContent(template) }])
    setActive(0)
    setCarousel(false)
    setDirty(false)
    setView('editor')
  }

  // ---- abrir proyecto guardado / serializado ----
  function openFromSerialized(p) {
    const ps = (p.pieces || []).map((pp) => ({
      template: allById[pp.templateId],
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
    setDirty(false)
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
    setDirty(true)
  }
  function addSlide(template) {
    // sin plantilla → slide EN BLANCO para componer con bloques
    const tpl = template || BLANK_TEMPLATE
    setPieces((ps) => [...ps, { template: tpl, content: freshContent(tpl) }])
    setCarousel(true)
    setActive(pieces.length)
    setDirty(true)
    showToast('Slide agregada')
  }
  function startBlankCarousel(fmt) {
    const format = fmt && CAROUSEL_FORMATS.includes(fmt.id) ? fmt : FORMATS_BY_ID['li-carousel']
    const blank = () => ({ template: BLANK_TEMPLATE, content: freshContent(BLANK_TEMPLATE) })
    setProjectId(newProjectId())
    setProjectName('Carrusel')
    setFormatId(format.id)
    setPieces([blank(), blank(), blank()])
    setActive(0)
    setCarousel(true)
    setDirty(false)
    setView('editor')
  }
  function changeSlideTemplate(template) {
    // cambia el diseño de la slide activa, conservando el contenido (textos/foto/marca)
    setPieces((ps) => ps.map((p, i) => (i === active ? { template, content: p.content } : p)))
    setDirty(true)
    showToast('Diseño de la slide cambiado')
  }
  function deleteSlide(i) {
    setPieces((ps) => {
      const next = ps.filter((_, idx) => idx !== i)
      return next.length ? next : ps
    })
    setActive((a) => Math.max(0, a - (i <= a ? 1 : 0)))
    if (pieces.length - 1 <= 1) setCarousel(false)
    setDirty(true)
  }

  // ---- acciones ----
  function save() {
    const proj = serialize()
    const next = upsertProject(proj)
    setProjects(next)
    setDirty(false)
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
  function addCustomElement({ name, src }) {
    const { el, saved } = addElement({ name, src })
    setElements(loadElements())
    if (!saved) showToast('⚠ Guardado local lleno — el elemento no quedó en la biblioteca')
    return el
  }
  function removeCustomElement(id) {
    setElements(deleteElement(id))
    showToast('Elemento eliminado de tu biblioteca')
  }
  function saveAsTemplate(name) {
    if (!current) return
    const tpl = buildTemplateFromPiece(current.template, current.content, name)
    if (saveCustomTemplate(tpl)) {
      setCustomTemplates(loadCustomTemplates())
      showToast('✓ Guardada en "Mis plantillas"')
    } else {
      showToast('⚠ No se pudo guardar (almacenamiento lleno)')
    }
  }
  function removeCustomTemplate(id) {
    setCustomTemplates(deleteCustomTemplate(id))
    showToast('Plantilla eliminada')
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={() => setView('gallery')} title="Ir al inicio">Magoya <b>Studio</b></button>
        {view !== 'editor' && (
          <nav className="topnav">
            <button className={view === 'gallery' ? 'on' : ''} onClick={() => setView('gallery')}>Crear pieza</button>
            <button className={view === 'brandkit' ? 'on' : ''} onClick={() => setView('brandkit')}>Kit de marca</button>
          </nav>
        )}
        {view === 'editor' && current && (
          <nav className="crumbs" aria-label="Ubicación">
            <button className="crumb-link" onClick={() => setView('gallery')}>Inicio</button>
            <span className="crumb-sep">›</span>
            <span className="crumb-cur">{current.template.name}</span>
          </nav>
        )}
        <div className="spacer" />
        {view === 'editor' && (
          <>
            <button className="btn ghost-light" onClick={() => setView('gallery')}>‹ Volver al inicio</button>
            <button className="btn ghost-light" onClick={() => exportProjectFile(serialize())} title="Guardá el proyecto como archivo para compartirlo o seguir después">Exportar archivo</button>
            <button className="btn ghost-light" onClick={share}>Compartir link</button>
            <button className="btn primary" onClick={save}>Guardar</button>
          </>
        )}
        {view === 'gallery' && <span className="badge">on-brand por diseño · v0.1</span>}
      </div>

      {view === 'brandkit' ? (
        <BrandKit onToast={showToast} />
      ) : view === 'gallery' ? (
        <Gallery
          galleryFormat={FORMATS_BY_ID[galleryFormatId] || FORMATS_BY_ID[DEFAULT_FORMAT]}
          setGalleryFormat={(f) => setGalleryFormatId(f.id)}
          templates={allTemplates}
          onDeleteTemplate={removeCustomTemplate}
          onPick={pickTemplate}
          onStartCarousel={startBlankCarousel}
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
          slides={carousel ? pieces : null}
          activeSlide={active}
          onChangeContent={changeContent}
          onChangeFormat={(f) => { setFormatId(f.id); setDirty(true) }}
          onSelectSlide={setActive}
          onAddSlide={addSlide}
          onChangeSlideTemplate={changeSlideTemplate}
          onDeleteSlide={deleteSlide}
          onToast={showToast}
          templates={allTemplates}
          onSaveTemplate={saveAsTemplate}
          elements={elements}
          onAddElement={addCustomElement}
          onDeleteElement={removeCustomElement}
        />
      ) : (
        <div className="center-note">Cargando…</div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
