import React, { useState, useEffect, useRef } from 'react'
import Gallery from './editor/Gallery.jsx'
import Editor from './editor/Editor.jsx'
import BrandKit from './editor/BrandKit.jsx'
import MockupPreview from './editor/MockupPreview.jsx'
import { createShare, loadShare, listComments, addComment, countComments, setVerdict, getVerdicts } from './lib/supabase.js'
import { TEMPLATES, TEMPLATES_BY_ID, BLANK_TEMPLATE, placeholderContent } from './templates/index.js'
import { FORMATS_BY_ID, CAROUSEL_FORMATS } from './formats/registry.js'
import {
  loadProjects, upsertProject, deleteProject, newProjectId,
  exportProjectFile, importProjectFile, toShareLink, fromShareLink,
  loadElements, addElement, deleteElement,
  loadCustomTemplates, buildTemplateFromPiece, saveCustomTemplate, deleteCustomTemplate,
  loadShares, rememberShare, markShareSeen, forgetShare, copyToClipboard, elementRefs,
} from './project/store.js'
import { dehydrate, hydrate, collectGarbage, usage } from './project/photoStore.js'

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
  const [espacio, setEspacio] = useState(null) // {usado, disponible}
  const [undoDelete, setUndoDelete] = useState(null)
  const [shares, setShares] = useState([])       // D4 · links de revisión propios
  const [shareCounts, setShareCounts] = useState({})
  const [shareVerdicts, setShareVerdicts] = useState({})   // K2 · aprobada / pide cambios
  const [linkToCopy, setLinkToCopy] = useState(null) // fallback si el portapapeles falla
  const [tplName, setTplName] = useState(null)       // C4 · nombre al guardar plantilla
  const [pvSlide, setPvSlide] = useState(0)
  const [miVoto, setMiVoto] = useState(null)
  const [staleBuild, setStaleBuild] = useState(false) // salió una versión nueva

  // Cuando se despliega una versión, los archivos con hash viejo dejan de
  // existir. Si tenías la pestaña abierta, todo lo que carga bajo demanda
  // (quitar fondo, ZIP, PDF) falla con un error críptico. Lo detectamos y
  // decimos lo único útil: recargá.
  useEffect(() => {
    const stale = (msg) => /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(String(msg || ''))
    const onPreload = () => setStaleBuild(true)
    const onRej = (e) => { if (stale(e.reason?.message || e.reason)) setStaleBuild(true) }
    const onErr = (e) => { if (stale(e.message)) setStaleBuild(true) }
    window.addEventListener('vite:preloadError', onPreload)
    window.addEventListener('unhandledrejection', onRej)
    window.addEventListener('error', onErr)
    return () => {
      window.removeEventListener('vite:preloadError', onPreload)
      window.removeEventListener('unhandledrejection', onRej)
      window.removeEventListener('error', onErr)
    }
  }, [])

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
  // si lo renombraste a mano, editar el título de la pieza NO puede pisarlo
  const namedByHand = useRef(false)
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT)
  const [galleryFormatId, setGalleryFormatId] = useState(DEFAULT_FORMAT)
  const [pieces, setPieces] = useState([]) // [{template, content}]
  const [active, setActive] = useState(0)
  const [carousel, setCarousel] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setProjects(loadProjects())
    loadElements().then(setElements).catch(() => {})
    setCustomTemplates(loadCustomTemplates())
    setShares(loadShares())
    // ¿quedó una copia de emergencia de la última vez? (cierre de pestaña)
    try {
      const pend = localStorage.getItem('magoya_studio_pending_v1')
      if (pend) {
        const p = JSON.parse(pend)
        dehydrate(p).then((liv) => setProjects(upsertProject(liv))).catch(() => {})
        localStorage.removeItem('magoya_studio_pending_v1')
      }
    } catch {}
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
    else if (shared) openFromSerialized(shared, 'link')
  }, [])

  // Cuántos comentarios tiene cada pieza compartida (para el badge).
  // Se recuenta también al VOLVER de una revisión: si no, el badge se queda
  // con el número viejo hasta recargar la página.
  useEffect(() => {
    if (preview || view !== 'gallery' || !shares.length) return
    const ids = shares.map((s) => s.id)
    countComments(ids).then(setShareCounts).catch(() => {})
    getVerdicts(ids).then(setShareVerdicts).catch(() => {})
  }, [view, shares.length, preview])

  // Un aviso con botón "Deshacer" necesita tiempo para leerlo Y llegar al
  // botón: 2,2 s no alcanzaba. Y al vencer se limpia la acción, si no el
  // aviso siguiente heredaba un "Deshacer" de algo borrado hace rato.
  const [toastUndo, setToastUndo] = useState(false)
  const showToast = (msg, conAccion = false) => {
    setToast(msg)
    setToastUndo(conAccion)
    clearTimeout(window.__mt)
    window.__mt = setTimeout(() => { setToast(null); setToastUndo(false); setUndoDelete(null) }, conAccion ? 9000 : 2400)
  }

  const format = FORMATS_BY_ID[formatId] || FORMATS_BY_ID[DEFAULT_FORMAT]
  const current = pieces[active] || null

  // Guardar de verdad. Antes vivía dentro del setTimeout del efecto: al
  // salir del editor React corría el cleanup, mataba el timer y el guardado
  // no ocurría nunca. Todo lo hecho en los últimos 800 ms se perdía.
  const guardar = async () => {
    if (!projectId || !piecesRef.current.length) return
    const liviano = await dehydrate(serialize()).catch(() => serialize())
    const next = upsertProject(liviano)
    setProjects(next)
    if (next.saveOk === false) {
      setSaveFail(true)
      showToast('⚠ No se pudo guardar — mirá el aviso de abajo')
    } else {
      setSaveFail(false)
      setDirty(false)   // sin esto el chip decía "Guardando…" para siempre
      collectGarbage(next).catch(() => {})
    }
    usage().then(setEspacio).catch(() => {})
  }
  const guardarRef = useRef(guardar)
  useEffect(() => { guardarRef.current = guardar })

  // autosave: guarda el proyecto en edición tras cada cambio (debounced)
  useEffect(() => {
    if (view !== 'editor' || !projectId || !pieces.length || !dirty) return
    const t = setTimeout(() => guardarRef.current(), 800)
    // al desmontar (salir del editor) se guarda YA, no se descarta
    return () => { clearTimeout(t); guardarRef.current() }
  }, [dirty, pieces, formatId, carousel, view, projectId, projectName])

  // cerrar la pestaña o cambiar de app tampoco puede perder los últimos
  // cambios: localStorage es síncrono, así que alcanza con escribir el
  // proyecto sin dehidratar como copia de emergencia.
  useEffect(() => {
    const alSalir = () => {
      if (!dirtyRef.current || !projectId) return
      try { localStorage.setItem('magoya_studio_pending_v1', JSON.stringify(serialize())) } catch {}
    }
    window.addEventListener('pagehide', alSalir)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') alSalir() })
    return () => window.removeEventListener('pagehide', alSalir)
  })
  const dirtyRef = useRef(dirty)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  // ---- iniciar desde template ----
  function pickTemplate(template, chosenFormat) {
    setProjectId(newProjectId())
    namedByHand.current = false
    setProjectName(template.defaults?.title || template.name)
    setFormatId(chosenFormat?.id || galleryFormatId || DEFAULT_FORMAT)
    resetHistory()
    piecesRef.current = [{ template, content: freshContent(template) }]
    setPieces([{ template, content: freshContent(template) }])
    setActive(0)
    setCarousel(false)
    setDirty(false)
    setView('editor')
  }

  // ---- abrir proyecto guardado / serializado ----
  async function openFromSerialized(raw, fuente = 'local') {
    // las fotos guardadas son referencias a IndexedDB: hay que traerlas
    const p = await hydrate(raw).catch(() => raw)
    // Si falta la plantilla, la slide se sustituye por una en blanco
    // conservando el contenido. Antes se descartaba EN SILENCIO y, como se
    // reusaba el mismo id, el autosave destruía el original.
    let faltantes = 0
    const ps = (p.pieces || []).map((pp) => {
      const t = allById[pp.templateId]
      if (!t) faltantes++
      return { template: t || BLANK_TEMPLATE, content: pp.content || {} }
    })
    if (!ps.length) {
      showToast('No se pudo abrir el proyecto')
      return
    }
    if (faltantes) showToast(`⚠ ${faltantes} slide${faltantes > 1 ? 's usan' : ' usa'} una plantilla que no está en este navegador`)
    else if (p.__fotosFaltantes) showToast(`⚠ ${p.__fotosFaltantes} foto${p.__fotosFaltantes > 1 ? 's' : ''} ya no está${p.__fotosFaltantes > 1 ? 'n' : ''} en este navegador`)
    // Un link o un archivo abren una COPIA: reusar el id pisaba el proyecto
    // local que tuviera ese mismo id (y el del link viene sin fotos).
    const idExiste = p.id && loadProjects().some((x) => x.id === p.id)
    const id = (fuente !== 'local' && idExiste) ? newProjectId() : (p.id || newProjectId())
    setProjectId(id)
    namedByHand.current = true // el proyecto ya tiene su nombre elegido
    setProjectName(p.name || '')
    setFormatId(FORMATS_BY_ID[p.formatId] ? p.formatId : DEFAULT_FORMAT)
    resetHistory()
    piecesRef.current = ps
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

  // ============================================================
  // HISTORIAL — el modelo que usan Figma, Canva y Keynote:
  // el paso de deshacer se cierra cuando TERMINA el gesto, no en cada
  // cambio. Mientras arrastrás, movés un slider o escribís, la pieza se
  // actualiza pero el historial no anota nada; al soltar (o al frenar de
  // escribir) se anota UNA vez el estado de antes de empezar.
  //
  // El modelo anterior (comparar "etiquetas" de gesto en cada cambio)
  // dependía de que las etiquetas coincidieran entre renders: si fallaba,
  // Deshacer volvía píxel por píxel.
  // ============================================================
  // El historial guardaba SÓLO las slides. Al meter el cambio de formato
  // adentro, ⌘Z deshacía el cambio ANTERIOR de contenido y dejaba el
  // formato cambiado: peor que no cubrirlo. Ahora el paso es el estado
  // completo de la pieza (slides + formato + si es carrusel).
  const piecesRef = useRef(pieces)          // siempre el estado actual
  const fmtRef = useRef(formatId)
  const carRef = useRef(carousel)
  const snapshot = () => ({ pieces: piecesRef.current, formatId: fmtRef.current, carousel: carRef.current })
  const restore = (snap) => {
    if (!snap) return
    piecesRef.current = snap.pieces; setPieces(snap.pieces)
    fmtRef.current = snap.formatId; setFormatId(snap.formatId)
    carRef.current = snap.carousel; setCarousel(snap.carousel)
    setActive((a) => Math.min(a, snap.pieces.length - 1))
  }
  const gestureRef = useRef(null)           // { tag, antes } del gesto abierto
  const idleRef = useRef(null)
  useEffect(() => { piecesRef.current = pieces }, [pieces])
  useEffect(() => { fmtRef.current = formatId }, [formatId])
  useEffect(() => { carRef.current = carousel }, [carousel])

  // Abrir otra pieza tiene que empezar con el historial en cero: si no,
  // ⌘Z te inyecta las slides del proyecto anterior en el que estás.
  function resetHistory() {
    undoRef.current = []
    redoRef.current = []
    gestureRef.current = null
    setHistTick((t) => t + 1)
  }

  function endGesture() {
    clearTimeout(idleRef.current)
    const g = gestureRef.current
    gestureRef.current = null
    // sólo anota si el gesto cambió algo de verdad
    if (g && g.antes.pieces !== piecesRef.current) pushHistory(g.antes)
  }

  function beginGesture(tag) {
    const g = gestureRef.current
    if (g && g.tag === tag) return           // el mismo gesto sigue abierto
    endGesture()                             // cambió de gesto: cerrá el anterior
    gestureRef.current = { tag, antes: snapshot() }
  }

  // Escribir no tiene "soltar el mouse": el gesto se cierra tras una pausa.
  // Así una palabra entera es un solo Deshacer, como en cualquier editor.
  function touchIdle() {
    clearTimeout(idleRef.current)
    idleRef.current = setTimeout(endGesture, 700)
  }

  useEffect(() => {
    const end = () => endGesture()
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [])

  // `tag` = nombre del gesto en curso (arrastrar, un slider, escribir un
  // texto). Sin tag el cambio es discreto y va derecho al historial.
  function changeContent(next, tag) {
    if (tag) { beginGesture(tag); touchIdle() }
    else { endGesture(); pushHistory(snapshot()) }
    const nextPieces = piecesRef.current.map((p, i) => (i === active ? { ...p, content: next } : p))
    piecesRef.current = nextPieces
    setPieces(nextPieces)
    if (active === 0 && next.title && !namedByHand.current) setProjectName(next.title)
    setDirty(true)
  }

  // Toda operación de SLIDE (agregar, duplicar, reordenar, cambiar diseño,
  // borrar) es discreta: entra al historial de una.
  function mutatePieces(fn) {
    endGesture()
    pushHistory(snapshot())
    const nextPieces = fn(piecesRef.current)
    piecesRef.current = nextPieces
    setPieces(nextPieces)
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
    endGesture() // si estabas a mitad de un gesto, se cierra antes de volver
    const prev = undoRef.current.pop()
    if (!prev) return
    redoRef.current.push(snapshot())
    restore(prev); setDirty(true); setHistTick((t) => t + 1)
  }
  function redo() {
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push(snapshot())
    restore(next); setDirty(true); setHistTick((t) => t + 1)
  }
  function addSlide(template) {
    // sin plantilla → slide EN BLANCO para componer con bloques
    const tpl = template || BLANK_TEMPLATE
    mutatePieces((ps) => [...ps, { template: tpl, content: freshContent(tpl) }])
    carRef.current = true; setCarousel(true)
    setActive(pieces.length)
    showToast('Slide agregada')
  }
  function startBlank(fmt) {
    const f = fmt || FORMATS_BY_ID[galleryFormatId] || FORMATS_BY_ID[DEFAULT_FORMAT]
    setProjectId(newProjectId())
    namedByHand.current = false
    setProjectName('Pieza nueva')
    setFormatId(f.id)
    resetHistory()
    piecesRef.current = [{ template: BLANK_TEMPLATE, content: freshContent(BLANK_TEMPLATE) }]
    setPieces([{ template: BLANK_TEMPLATE, content: freshContent(BLANK_TEMPLATE) }])
    setActive(0); setCarousel(false); setDirty(false); setView('editor')
  }
  function startBlankCarousel(fmt) {
    const format = fmt && CAROUSEL_FORMATS.includes(fmt.id) ? fmt : FORMATS_BY_ID['li-carousel']
    const blank = () => ({ template: BLANK_TEMPLATE, content: freshContent(BLANK_TEMPLATE) })
    setProjectId(newProjectId())
    namedByHand.current = false
    setProjectName('Carrusel')
    setFormatId(format.id)
    resetHistory()
    piecesRef.current = [blank(), blank(), blank()]
    setPieces([blank(), blank(), blank()])
    setActive(0)
    setCarousel(true)
    setDirty(false)
    setView('editor')
  }
  function convertToCarousel() {
    endGesture(); pushHistory(snapshot())
    carRef.current = true
    setCarousel(true); setDirty(true)
    showToast('Listo: ya es un carrusel. Sumá la slide 2 con el +')
  }
  function backToSingle() {
    endGesture(); pushHistory(snapshot())
    carRef.current = false
    setCarousel(false); setActive(0); setDirty(true)
  }
  // C2 · lo que se borra de las bibliotecas también se puede recuperar
  function duplicateSlide() {
    // clona la slide activa (deep) para continuar la historia (ej: chat que sigue)
    mutatePieces((ps) => {
      const src = ps[active]
      if (!src) return ps
      const content = JSON.parse(JSON.stringify(src.content))
      const next = [...ps]
      next.splice(active + 1, 0, { template: src.template, content })
      return next
    })
    carRef.current = true; setCarousel(true)
    setActive((a) => a + 1)
    showToast('Slide duplicada — seguí la historia')
  }
  function reorderSlides(from, to) {
    mutatePieces((ps) => { const a = [...ps]; const [it] = a.splice(from, 1); a.splice(to, 0, it); return a })
    setActive(to)
  }
  function changeSlideTemplate(template) {
    // cambia el diseño de la slide activa, conservando el contenido (textos/foto/marca)
    mutatePieces((ps) => ps.map((p, i) => (i === active ? { template, content: p.content } : p)))
    showToast('Diseño de la slide cambiado')
  }
  function deleteSlide(i) {
    if (pieces.length <= 1) { showToast('Es la única slide: no se puede borrar'); return }
    mutatePieces((ps) => ps.filter((_, idx) => idx !== i))
    setActive((a) => Math.max(0, a - (i <= a ? 1 : 0)))
    showToast('Slide borrada', true)
  }

  // ---- acciones ----

  async function share(mockup) {
    const link = toShareLink(serialize(), typeof mockup === 'string' ? mockup : undefined)
    if (link && link.tooLong) {
      showToast('⚠ La pieza es muy pesada para un link. Usá "Para que lo revisen", que sube la foto.')
      return
    }
    const ok = await copyToClipboard(link)
    if (ok) showToast('✓ Link de preview copiado — sin foto (para la foto, compartí para revisión)')
    else setLinkToCopy(link)
  }
  async function importFile(file) {
    try {
      const p = await importProjectFile(file)
      openFromSerialized(p, 'archivo')
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
    showToast('Se eliminó «' + (backup?.name || 'el proyecto') + '»', true)
  }
  async function addCustomElement({ name, src, kind }) {
    // el `kind` se descartaba acá: las fotos subidas terminaban archivadas
    // como logos y "Mis fotos" quedaba siempre vacío
    const { el, saved } = await addElement({ name, src, kind })
    loadElements().then(setElements).catch(() => {})
    if (!saved) showToast('⚠ No se pudo guardar en tu biblioteca')
    return el
  }
  async function removeCustomElement(id) {
    const backup = elements.find((e) => e.id === id)
    setElements(await deleteElement(id))
    setUndoDelete({ kind: 'element', data: backup })
    showToast('Elemento eliminado de tu biblioteca', true)
  }
  function saveAsTemplate(name) {
    if (!current) return
    if (name === undefined) { setTplName(projectName || current.template.name); return } // pide nombre
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
    const backup = loadCustomTemplates().find((t) => t.id === id)
    setCustomTemplates(deleteCustomTemplate(id))
    setUndoDelete({ kind: 'template', data: backup })
    showToast('Se eliminó «' + (backup?.name || 'la plantilla') + '»', true)
  }

  // ---- compartir para revisión (nube: con foto + comentarios) ----
  async function shareForReview(mockup) {
    showToast('Subiendo pieza…')
    try {
      const payload = { ...serialize(), mockup: typeof mockup === 'string' ? mockup : 'ig' }
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
    // K2 · antes esto sólo abría WhatsApp: el que revisaba creía que había
    // terminado y el que esperaba no se enteraba nunca. Ahora queda guardado
    // y se ve en Inicio › Compartidas. Avisar por WhatsApp es opcional.
    const votar = async (ok) => {
      if (!preview.shareId) return showToast('Este link es sólo de vista: pedí el link de revisión')
      try {
        await setVerdict({ share_id: preview.shareId, author: cAuthor.trim() || 'Anónimo', verdict: ok ? 'ok' : 'changes' })
        setMiVoto(ok ? 'ok' : 'changes')
        showToast(ok ? '✓ Aprobada — ya lo ve el equipo' : '✓ Pedido de cambios registrado')
      } catch (e) { console.error(e); showToast('⚠ No se pudo registrar') }
    }
    const avisarWhatsApp = () => {
      const name = preview.name || 'pieza'
      const msg = (miVoto === 'ok' ? `Aprobada: "${name}"` : `Pedido de cambios en "${name}"`) + `\n${location.href}`
      window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank')
    }
    return (
      <div className="app app--fixed">
        <div className="topbar">
          <button className="brand" onClick={exitPreview}>Magoya <b>Studio</b></button>
          <span className="save-status">Pieza para revisar</span>
          <div className="spacer" />
          <label className="dk-toggle" style={{ color: 'var(--cream-300)' }}>
            <input type="checkbox" checked={!!preview.dark} onChange={(e) => setPreview({ ...preview, dark: e.target.checked })} /> Modo oscuro
          </label>
          <button className="btn ghost-light" onClick={() => { const p = preview; setPreview(null); if (location.hash) location.hash = ''; openFromSerialized(p, 'link') }}>Editar esta pieza</button>
        </div>
        <div className="preview-stage">
          <div className={'review-wrap' + (preview.shareId ? ' comentable' : '')}
            onClick={(e) => {
              if (!preview.shareId) return
              if (e.target.closest('.c-pin') || e.target.closest('.pin-form')) return
              const r = e.currentTarget.getBoundingClientRect()
              setPin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, slide: idx })
            }}>
            {t ? <MockupPreview template={t} content={pc.content} format={pfmt} mockup={preview.mockup || 'ig'} dark={!!preview.dark} /> : <div className="center-note">No se pudo cargar la pieza compartida.</div>}
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
          {/* en un link de sólo-vista no hay dónde guardar el veredicto:
              mostrar los botones era prometer algo que no funciona */}
          {preview.shareId && (
          <div className="verdict-row">
            {miVoto ? (
              <>
                <span className={'verdict-done' + (miVoto === 'ok' ? ' ok' : '')}>
                  {miVoto === 'ok' ? '✓ La aprobaste' : 'Pediste cambios'} — el equipo ya lo ve
                </span>
                <button className="btn" onClick={avisarWhatsApp}>Avisar por WhatsApp</button>
                <button className="btn" onClick={() => setMiVoto(null)}>Cambiar</button>
              </>
            ) : (
              <>
                <button className="btn primary" onClick={() => votar(true)}>Aprobar</button>
                <button className="btn" onClick={() => votar(false)}>Pedir cambios</button>
              </>
            )}
          </div>
          )}
          {!preview.shareId && <p className="preview-note">Así se ve publicada. La foto no viaja en este link — usá "Compartir para revisión" para verla completa.</p>}
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  return (
    <div className={'app ' + (view === 'editor' ? 'app--fixed' : 'app--scroll')}>
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
              onChange={(e) => { namedByHand.current = true; setProjectName(e.target.value); setDirty(true) }} />
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
          shareVerdicts={shareVerdicts}
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
          onChangeFormat={(f) => { endGesture(); pushHistory(snapshot()); fmtRef.current = f.id; setFormatId(f.id); setDirty(true) }}
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

      {tplName !== null && (
        <div className="mk-modal-ov" onClick={() => setTplName(null)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-head"><strong>Guardar como plantilla</strong><button className="btn" onClick={() => setTplName(null)}>Cancelar</button></div>
            <p className="panel-help" style={{ margin: '0 0 10px' }}>Con qué nombre la va a encontrar el resto del equipo. El diseño se guarda; los textos y la foto no.</p>
            <input className="link-box" value={tplName} autoFocus placeholder="Ej: Caso de cliente · versión corta"
              onChange={(e) => setTplName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && tplName.trim()) { const n = tplName.trim(); setTplName(null); saveAsTemplate(n) } }} />
            <div className="share-foot">
              <button className="btn primary" disabled={!tplName.trim()}
                onClick={() => { const n = tplName.trim(); setTplName(null); saveAsTemplate(n) }}>Guardar plantilla</button>
            </div>
          </div>
        </div>
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

      {saveFail && view === 'editor' && (
        <div className="stale-bar quota">
          <div>
            <b>No se pudo guardar esta pieza.</b> El navegador reserva un espacio
            chico por sitio y ya está lleno{espacio ? ` (${Math.round(espacio.usado / 1e6)} MB usados)` : ''}.
            Bajá la pieza para no perderla, o hacé lugar borrando proyectos viejos desde Inicio.
          </div>
          <button className="btn primary" onClick={() => exportProjectFile(serialize())}>Bajar la pieza</button>
          <button className="btn ghost-light" onClick={() => setView('gallery')}>Hacer lugar</button>
        </div>
      )}

      {staleBuild && (
        <div className="stale-bar">
          Salió una versión nueva de Magoya Studio. Recargá para que vuelvan a andar las
          funciones que cargan al vuelo (quitar fondo, ZIP, PDF). Tu trabajo está guardado.
          <button className="btn primary" onClick={() => location.reload()}>Recargar</button>
        </div>
      )}

      {toast && (
        <div className="toast">
          {toast}
          {/* Una sola regla: TODO lo que se borra ofrece Deshacer acá mismo.
              Si no hay nada guardado aparte (un objeto, una slide), el botón
              usa el historial normal. */}
          {(undoDelete || toastUndo) && (
            <button className="toast-act" onClick={() => {
              if (undoDelete) {
                const { kind, data } = undoDelete
                if (data && kind === 'project') setProjects(upsertProject(data))
                if (data && kind === 'template') { saveCustomTemplate(data); setCustomTemplates(loadCustomTemplates()) }
                if (data && kind === 'element') { addElement({ name: data.name, src: data.src, kind: data.kind }).then(() => loadElements().then(setElements)) }
                setUndoDelete(null)
              } else { undo() }
              setToastUndo(false); showToast('Listo, lo recuperamos')
            }}>Deshacer</button>
          )}
        </div>
      )}
    </div>
  )
}
