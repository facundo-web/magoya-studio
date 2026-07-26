import React, { useState, useEffect, useRef } from 'react'
import Gallery from './editor/Gallery.jsx'
import Editor from './editor/Editor.jsx'
import BrandKit from './editor/BrandKit.jsx'
import MockupPreview from './editor/MockupPreview.jsx'
import { createShare, loadShare, listComments, addComment, countComments } from './lib/supabase.js'
import { TEMPLATES, TEMPLATES_BY_ID, BLANK_TEMPLATE, placeholderContent } from './templates/index.js'
import { FORMATS_BY_ID, CAROUSEL_FORMATS } from './formats/registry.js'
import {
  loadProjects, upsertProject, deleteProject, newProjectId,
  exportProjectFile, importProjectFile, toShareLink, fromShareLink,
  loadElements, addElement, deleteElement,
  loadCustomTemplates, buildTemplateFromPiece, saveCustomTemplate, deleteCustomTemplate,
  loadShares, rememberShare, markShareSeen, forgetShare, copyToClipboard,
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
  const undoRef = useRef([])
  const redoRef = useRef([])
  const [histTick, setHistTick] = useState(0)
  const [saveFail, setSaveFail] = useState(false)
  const [undoDelete, setUndoDelete] = useState(null)
  const [shares, setShares] = useState([])       // D4 · links de revisión propios
  const [shareCounts, setShareCounts] = useState({})
  const [linkToCopy, setLinkToCopy] = useState(null) // fallback si el portapapeles falla
  const [pvSlide, setPvSlide] = useState(0)

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
    setShares(loadShares())
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

  // cuántos comentarios tiene cada pieza compartida (para el badge)
  useEffect(() => {
    if (view !== 'gallery' || !shares.length) return
    countComments(shares.map((s) => s.id)).then(setShareCounts).catch(() => {})
  }, [view, shares.length])

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
    const t = setTimeout(() => {
      const next = upsertProject(serialize())
      setProjects(next)
      if (next.saveOk === false) {
        setSaveFail(true)
        showToast('⚠ Se llenó el guardado del navegador — descargá el proyecto para no perderlo')
      } else setSaveFail(false)
    }, 800)
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
  // `tag` agrupa una MISMA interacción (arrastrar, mover un slider) en un
  // solo paso de deshacer. Sin esto, arrastrar un objeto dejaba un estado
  // por cada píxel y Deshacer tenía que recorrerlos todos uno por uno.
  const lastTagRef = useRef(null)
  // El gesto termina cuando soltás el mouse o la tecla; ahí se abre un paso
  // de deshacer nuevo. (No se usa reloj: algunos navegadores redondean
  // Date.now() a 1s por privacidad y una ventana temporal no cierra nunca.)
  useEffect(() => {
    const end = () => { lastTagRef.current = null }
    window.addEventListener('pointerup', end)
    window.addEventListener('keyup', end)
    return () => { window.removeEventListener('pointerup', end); window.removeEventListener('keyup', end) }
  }, [])
  function changeContent(next, tag) {
    const sameGesture = !!tag && lastTagRef.current === tag
    lastTagRef.current = tag || null
    setPieces((ps) => {
      if (!sameGesture) pushHistory(ps)
      return ps.map((p, i) => (i === active ? { ...p, content: next } : p))
    })
    if (active === 0 && next.title) setProjectName(next.title)
    setDirty(true)
  }
  // ---- undo / redo (últimos 40 estados de pieces) ----
  function pushHistory(prev) {
    undoRef.current.push(prev)
    if (undoRef.current.length > 40) undoRef.current.shift()
    redoRef.current = []
    setHistTick((t) => t + 1)
  }
  function undo() {
    const prev = undoRef.current.pop()
    if (!prev) return
    redoRef.current.push(pieces)
    setPieces(prev); setDirty(true); setHistTick((t) => t + 1)
  }
  function redo() {
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push(pieces)
    setPieces(next); setDirty(true); setHistTick((t) => t + 1)
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
  function startBlank(fmt) {
    const f = fmt || FORMATS_BY_ID[galleryFormatId] || FORMATS_BY_ID[DEFAULT_FORMAT]
    setProjectId(newProjectId())
    setProjectName('Pieza nueva')
    setFormatId(f.id)
    setPieces([{ template: BLANK_TEMPLATE, content: freshContent(BLANK_TEMPLATE) }])
    setActive(0); setCarousel(false); setDirty(false); setView('editor')
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
  function reorderSlides(from, to) {
    setPieces((ps) => { const a = [...ps]; const [it] = a.splice(from, 1); a.splice(to, 0, it); return a })
    setActive(to); setDirty(true)
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
  async function share(mockup) {
    const link = toShareLink(serialize(), typeof mockup === 'string' ? mockup : undefined)
    const ok = await copyToClipboard(link)
    if (ok) showToast('✓ Link de preview copiado — sin foto (para la foto, compartí para revisión)')
    else setLinkToCopy(link)
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
  function duplicateProject(p) {
    // copia con id propio: abrir el original ya no lo pisa
    const copy = { ...JSON.parse(JSON.stringify(p)), id: newProjectId(), name: (p.name || 'Proyecto') + ' (copia)' }
    setProjects(upsertProject(copy))
    showToast('✓ Duplicado — el original queda intacto')
  }
  function removeProject(id) {
    const backup = loadProjects().find((p) => p.id === id)
    setProjects(deleteProject(id))
    setUndoDelete({ kind: 'project', data: backup })
    showToast('Se eliminó «' + (backup?.name || 'el proyecto') + '»')
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
  function openShare(sh) {
    const n = shareCounts[sh.id] ?? 0
    setShares(markShareSeen(sh.id, n))
    loadShare(sh.id)
      .then((p) => { location.hash = 'r=' + sh.id; setPreview({ ...p, shareId: sh.id, preview: true }) })
      .catch(() => showToast('⚠ Ya no está disponible esa pieza compartida'))
  }
  function copyShareLink(sh) {
    navigator.clipboard?.writeText(location.origin + location.pathname + '#r=' + sh.id)
    showToast('✓ Link copiado')
  }
  function removeShare(id) { setShares(forgetShare(id)); showToast('Sacado de tu lista (el link sigue vivo)') }

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
      // D4 · lo guardamos: si perdés el link, no perdés el feedback
      setShares(rememberShare({ id, name: projectName || 'Sin título', formatId }))
      // el portapapeles puede fallar (pestaña sin foco): la pieza YA se subió,
      // así que en ese caso mostramos el link en vez de mentir con un error.
      const ok = await copyToClipboard(link)
      if (ok) showToast('✓ Link de revisión copiado — lo tenés en Inicio › Compartidas')
      else setLinkToCopy(link)
    } catch (e) {
      console.error(e)
      showToast('⚠ No se pudo subir la pieza')
    }
  }
  async function sendComment() {
    if (!pin || !cText.trim()) return
    try {
      await addComment({ share_id: preview.shareId, author: cAuthor.trim() || 'Anónimo', text: cText.trim(), x: pin.x, y: pin.y, slide: pin.slide ?? 0 })
      localStorage.setItem('magoya_author', cAuthor.trim())
      setCText(''); setPin(null)
      setComments(await listComments(preview.shareId))
      showToast('✓ Comentario enviado')
    } catch (e) {
      console.error(e)
      showToast('⚠ No se pudo enviar el comentario')
    }
  }

  // atajos globales de deshacer/rehacer
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      e.shiftKey ? redo() : undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- pantalla de PREVIEW (link compartido con mockup) ----
  if (preview) {
    const pvPieces = preview.pieces || []
    const idx = Math.min(pvSlide, Math.max(pvPieces.length - 1, 0))
    const pc = pvPieces[idx]
    const t = pc && allById[pc.templateId]
    const multi = pvPieces.length > 1
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
              setPin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, slide: idx })
            }}>
            {t ? <MockupPreview template={t} content={pc.content} format={pfmt} mockup={preview.mockup || 'phone'} dark={!!preview.dark} /> : <div className="center-note">No se pudo cargar la pieza compartida.</div>}
            {preview.shareId && comments.filter((c) => (c.slide ?? 0) === idx).map((c, i) => (
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
          {multi && (
            <div className="pv-nav">
              <button className="btn" onClick={() => setPvSlide((v) => Math.max(0, v - 1))} disabled={idx === 0}>‹</button>
              <span className="pv-count">{idx + 1} / {pvPieces.length}</span>
              <button className="btn" onClick={() => setPvSlide((v) => Math.min(pvPieces.length - 1, v + 1))} disabled={idx === pvPieces.length - 1}>›</button>
            </div>
          )}
          {preview.shareId && (
            <p className="preview-note"><b>Tocá un punto de la pieza para dejar un comentario ahí</b> — quedan anclados como en Figma.</p>
          )}
          {preview.shareId && comments.length > 0 && (
            <div className="c-list">
              {comments.map((c, i) => (
                <div key={c.id} className="c-item"><span className="c-num">{i + 1}</span><div><b>{c.author}</b> {c.text}{multi && <span className="c-slide"> · slide {(c.slide ?? 0) + 1}</span>}</div></div>
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
            {/* C3 · el nombre del proyecto es editable acá (antes mostraba,
                sin poder cambiarlo, el nombre de la plantilla) */}
            <input className="crumb-name" value={projectName}
              placeholder="Sin título"
              title="Nombre de esta pieza"
              onChange={(e) => { setProjectName(e.target.value); setDirty(true) }} />
          </nav>
        )}
        <div className="spacer" />
        {view === 'editor' && (
          <>
            <span className={'save-status' + (saveFail ? ' fail' : '')} title={saveFail ? 'No se pudo guardar: el navegador está lleno' : 'Tu trabajo se guarda solo'}>
              {saveFail ? '⚠ No se pudo guardar' : dirty ? '• Guardando…' : '✓ Guardado'}
            </span>
            {saveFail && <button className="btn ghost-light" onClick={() => exportProjectFile(serialize())}>Descargar ahora</button>}
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
          onStartBlank={startBlank}
          projects={projects}
          onOpenProject={openFromSerialized}
          onDeleteProject={removeProject}
          onDuplicateProject={duplicateProject}
          onImport={importFile}
          shares={shares}
          shareCounts={shareCounts}
          onOpenShare={openShare}
          onCopyShare={copyShareLink}
          onForgetShare={removeShare}
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
          onReorderSlides={reorderSlides}
          onUndo={undo} onRedo={redo}
          canUndo={undoRef.current.length > 0} canRedo={redoRef.current.length > 0}
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

      {linkToCopy && (
        <div className="mk-modal-ov" onClick={() => setLinkToCopy(null)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-head"><strong>Tu link está listo</strong><button className="btn" onClick={() => setLinkToCopy(null)}>Cerrar</button></div>
            <p className="panel-help" style={{ margin: '0 0 10px' }}>El navegador no dejó copiarlo solo. Copialo de acá:</p>
            <input className="link-box" readOnly value={linkToCopy} onFocus={(e) => e.target.select()} autoFocus />
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          {toast}
          {undoDelete && (
            <button className="toast-act" onClick={() => {
              if (undoDelete.kind === 'project' && undoDelete.data) setProjects(upsertProject(undoDelete.data))
              setUndoDelete(null); showToast('Restaurado')
            }}>Deshacer</button>
          )}
        </div>
      )}
    </div>
  )
}
