import React, { useState, useEffect, useRef } from 'react'
import Gallery from './editor/Gallery.jsx'
import Editor from './editor/Editor.jsx'
import BrandKit from './editor/BrandKit.jsx'
import MockupPreview from './editor/MockupPreview.jsx'
import { createShare, loadShare, listComments, addComment } from './lib/supabase.js'
import { TEMPLATES, TEMPLATES_BY_ID, BLANK_TEMPLATE, placeholderContent } from './templates/index.js'
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
  const [preview, setPreview] = useState(null) // pieza compartida en modo preview (mockup)
  // revisión con comentarios (share en la nube)
  const [comments, setComments] = useState([])
  const [pin, setPin] = useState(null) // {x,y} en % del mockup, pendiente de comentar
  const [cAuthor, setCAuthor] = useState(() => localStorage.getItem('magoya_author') || '')
  const [cText, setCText] = useState('')
  const importRef = useRef(null)

  useEffect(() => {
    if (preview?.shareId) listComments(preview.shareId).then(setComments).catch(() => {})
  }, [preview?.shareId])

  const allTemplates = [...TEMPLATES, ...customTemplates]
  const allById = Object.fromEntries(allTemplates.map((t) => [t.id, t]))

  // contenido inicial: estructura de la plantilla con placeholders (el copy
  // no vive en la plantilla; el usuario lo escribe).
  const freshContent = (tpl) => placeholderContent(tpl)

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
    // ¿link de revisión en la nube? (#r=<id>, con foto y comentarios)
    const rm = location.hash.match(/[#&]r=([\w-]+)/)
    if (rm) {
      loadShare(rm[1])
        .then((p) => setPreview({ ...p, shareId: rm[1], preview: true }))
        .catch(() => showToast('⚠ No se encontró la pieza compartida'))
      return
    }
    // ¿link liviano embebido?
    const shared = fromShareLink()
    if (shared?.preview) setPreview(shared)
    else if (shared) openFromSerialized(shared)
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
  function convertToCarousel() {
    setCarousel(true); setDirty(true)
    showToast('Listo: ya es un carrusel. Sumá la slide 2 con el +')
  }
  function backToSingle() { setCarousel(false); setActive(0); setDirty(true) }
  function duplicateSlide() {
    // clona la slide activa (deep) para continuar la historia (ej: chat que sigue)
    setPieces((ps) => {
      const src = ps[active]
      if (!src) return ps
      const content = JSON.parse(JSON.stringify(src.content))
      const next = [...ps]
      next.splice(active + 1, 0, { template: src.template, content })
      return next
    })
    setCarousel(true)
    setActive((a) => a + 1)
    setDirty(true)
    showToast('Slide duplicada — seguí la historia')
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
    if (pieces.length - 1 < 1) setCarousel(false)
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
  function share(mockup) {
    const link = toShareLink(serialize(), typeof mockup === 'string' ? mockup : undefined)
    navigator.clipboard?.writeText(link)
    showToast('✓ Link copiado' + (typeof mockup === 'string' ? ' (preview en mockup)' : '') + ' — sin foto; para foto usá Exportar proyecto')
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

  // ---- compartir para revisión (nube: con foto + comentarios) ----
  async function shareForReview(mockup) {
    showToast('Subiendo pieza…')
    try {
      const payload = { ...serialize(), mockup: typeof mockup === 'string' ? mockup : 'phone' }
      const id = await createShare(payload)
      const link = location.origin + location.pathname + '#r=' + id
      await navigator.clipboard?.writeText(link)
      showToast('✓ Link de revisión copiado — con foto y comentarios')
    } catch (e) {
      console.error(e)
      showToast('⚠ No se pudo subir la pieza')
    }
  }
  async function sendComment() {
    if (!pin || !cText.trim()) return
    try {
      await addComment({ share_id: preview.shareId, author: cAuthor.trim() || 'Anónimo', text: cText.trim(), x: pin.x, y: pin.y })
      localStorage.setItem('magoya_author', cAuthor.trim())
      setCText(''); setPin(null)
      setComments(await listComments(preview.shareId))
      showToast('✓ Comentario enviado')
    } catch (e) {
      console.error(e)
      showToast('⚠ No se pudo enviar el comentario')
    }
  }

  // ---- pantalla de PREVIEW (link compartido con mockup) ----
  if (preview) {
    const pc = preview.pieces?.[0]
    const t = pc && allById[pc.templateId]
    const pfmt = FORMATS_BY_ID[preview.formatId] || FORMATS_BY_ID[DEFAULT_FORMAT]
    const exitPreview = () => { setPreview(null); if (location.hash) location.hash = '' }
    const verdict = (ok) => {
      const name = preview.name || 'pieza'
      const msg = (ok ? `✅ Aprobada: "${name}"` : `✏️ Pedido de cambios en "${name}" — mis comentarios: `) + `\n${location.href}`
      window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank')
    }
    return (
      <div className="app">
        <div className="topbar">
          <button className="brand" onClick={exitPreview}>Magoya <b>Studio</b></button>
          <span className="save-status">Pieza para revisar</span>
          <div className="spacer" />
          <label className="dk-toggle" style={{ color: 'var(--cream-300)' }}>
            <input type="checkbox" checked={!!preview.dark} onChange={(e) => setPreview({ ...preview, dark: e.target.checked })} /> Modo oscuro
          </label>
          <button className="btn ghost-light" onClick={() => { const p = preview; setPreview(null); if (location.hash) location.hash = ''; openFromSerialized(p) }}>Editar esta pieza</button>
        </div>
        <div className="preview-stage">
          <div className="review-wrap"
            onClick={(e) => {
              if (!preview.shareId) return
              if (e.target.closest('.c-pin') || e.target.closest('.pin-form')) return
              const r = e.currentTarget.getBoundingClientRect()
              setPin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
            }}>
            {t ? <MockupPreview template={t} content={pc.content} format={pfmt} mockup={preview.mockup || 'phone'} dark={!!preview.dark} /> : <div className="center-note">No se pudo cargar la pieza compartida.</div>}
            {preview.shareId && comments.map((c, i) => (
              <span key={c.id} className="c-pin" style={{ left: c.x + '%', top: c.y + '%' }} title={`${c.author}: ${c.text}`}>{i + 1}</span>
            ))}
            {pin && (
              <div className="pin-form" style={{ left: Math.min(pin.x, 60) + '%', top: Math.min(pin.y, 70) + '%' }} onClick={(e) => e.stopPropagation()}>
                <input type="text" placeholder="Tu nombre" value={cAuthor} onChange={(e) => setCAuthor(e.target.value)} />
                <textarea placeholder="Tu comentario sobre este punto…" value={cText} onChange={(e) => setCText(e.target.value)} rows={2} autoFocus />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setPin(null)}>Cancelar</button>
                  <button className="btn primary" onClick={sendComment}>Comentar</button>
                </div>
              </div>
            )}
          </div>
          {preview.shareId && (
            <p className="preview-note"><b>Tocá un punto de la pieza para dejar un comentario ahí</b> — quedan anclados como en Figma.</p>
          )}
          {preview.shareId && comments.length > 0 && (
            <div className="c-list">
              {comments.map((c, i) => (
                <div key={c.id} className="c-item"><span className="c-num">{i + 1}</span><div><b>{c.author}</b> {c.text}</div></div>
              ))}
            </div>
          )}
          <div className="verdict-row">
            <button className="btn primary" onClick={() => verdict(true)}>✓ Aprobar (responde por WhatsApp)</button>
            <button className="btn" onClick={() => verdict(false)}>✏️ Pedir cambios</button>
          </div>
          {!preview.shareId && <p className="preview-note">Así se ve publicada. La foto no viaja en este link — usá "Compartir para revisión" para verla completa.</p>}
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
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
            <span className="save-status" title="Tu trabajo se guarda solo">{dirty ? '• Sin guardar' : '✓ Guardado'}</span>
            <button className="btn ghost-light" onClick={() => setView('gallery')}>‹ Volver al inicio</button>
          </>
        )}
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
          onDuplicateSlide={duplicateSlide}
          onConvertToCarousel={convertToCarousel}
          onBackToSingle={backToSingle}
          onChangeSlideTemplate={changeSlideTemplate}
          onDeleteSlide={deleteSlide}
          onToast={showToast}
          templates={allTemplates}
          onSaveTemplate={saveAsTemplate}
          onShare={share}
          onShareReview={shareForReview}
          onExportFile={() => exportProjectFile(serialize())}
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
