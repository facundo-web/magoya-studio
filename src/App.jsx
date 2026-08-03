import React, { useState, useEffect, useRef, useMemo } from 'react'
import Gallery from './editor/Gallery.jsx'
import Editor from './editor/Editor.jsx'
import BrandKit from './editor/BrandKit.jsx'
import Pulso from './editor/Pulso.jsx'
import Copiloto, { useCopiloto, ROL as ROL_TEXTO } from './editor/Copiloto.jsx'
import MockupPreview from './editor/MockupPreview.jsx'
import Icon from './ui/Icon.jsx'
// Namespace a propósito, igual que en Copiloto.jsx: un import nombrado que
// no existe se lleva puesto el bundle entero, y esa pantalla muerta es
// justo lo que el invariante 3 prohíbe.
import * as copmotor from './lib/copiloto.js'
import { CAPACIDADES } from './lib/capabilities.js'
// Namespace en el import a propósito: un import nombrado que no existe
// rompe el bundle, que es exactamente la pantalla muerta que el invariante
// 3 prohíbe. Pero al copiloto NO le llega el namespace entero: abajo, en
// ctxCopiloto, se le pasan sólo las dos funciones de lectura.
import * as memoria from './lib/memoria.js'
import { createShare, loadShare, listComments, addComment, countComments, setVerdict, getVerdicts } from './lib/supabase.js'
import { TEMPLATES, BLANK_TEMPLATE, placeholderContent, applyDesign, rolesDePieza } from './templates/index.js'
// El wordmark REAL, el mismo archivo que exporta el Kit de marca. Antes acá
// decía "Magoya" en Manrope 800 con la palabra en verde: una imitación
// tipográfica del logo. Facu: "el logo de Magoya tiene que ser el real".
// En una herramienta de marca, escribir la marca a mano en vez de usar el
// activo es justo lo que la herramienta existe para impedir.
import { WORDMARKS } from './brand/brandKit.js'
import { buildCarousel } from './templates/carousels.js'
import { tamanoComun } from './engine/layouts.js'
import { FORMATS_BY_ID, CAROUSEL_FORMATS, isKnownFormat, formatLabel } from './formats/registry.js'
import { setProjectExportName } from './engine/export.js'
import {
  loadProjects, upsertProject, deleteProject, newProjectId, projectRev,
  exportProjectFile, importProjectFile, toShareLink, fromShareLink,
  loadElements, addElement, deleteElement,
  loadCustomTemplates, buildTemplateFromPiece, saveCustomTemplate, deleteCustomTemplate,
  loadShares, rememberShare, markShareSeen, forgetShare, copyToClipboard, elementRefs,
} from './project/store.js'
import { dehydrate, hydrate, collectGarbage, usage } from './project/photoStore.js'

const DEFAULT_FORMAT = 'ig-post'

export default function App() {
  const [view, setView] = useState('gallery')
  // "Al navegar no cambia la URL, entonces no puede usar las flechas
  // nativas del explorer" — cambiar de pantalla (Crear pieza / Kit de
  // marca / editor) no tocaba la URL, así que las flechas atrás/adelante
  // del navegador no volvían a donde venías; la única forma de volver
  // era el botón de la propia app. `navigate` empuja un estado de
  // historial en cada cambio, y `popstate` escucha esas flechas — sin
  // tocar el resto del enrutado (el hash `#r=` de los links de revisión
  // sigue exactamente igual, es un mecanismo aparte).
  function navigate(next) {
    setView((prev) => {
      if (prev === next) return prev
      history.pushState({ magoyaView: next }, '', location.pathname + '#' + next)
      return next
    })
  }
  useEffect(() => {
    // deja la entrada inicial coherente, sin pisar un link de revisión
    // (`#r=...`) que haya traído la pestaña
    if (!location.hash.startsWith('#r=')) {
      history.replaceState({ magoyaView: view }, '', location.pathname + '#' + view)
    }
    const onPop = (e) => {
      const next = e.state?.magoyaView || (location.hash.match(/^#(gallery|editor|brandkit|pulso)$/) || [])[1] || 'gallery'
      setView(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
  const [thumbs, setThumbs] = useState({})   // portadas hidratadas para la home
  const [linkToCopy, setLinkToCopy] = useState(null) // fallback si el portapapeles falla
  const [tplName, setTplName] = useState(null)       // C4 · nombre al guardar plantilla
  const [pvSlide, setPvSlide] = useState(0)
  const [miVoto, setMiVoto] = useState(null)
  const [staleBuild, setStaleBuild] = useState(false) // salió una versión nueva
  const [conflicto, setConflicto] = useState(false)   // la pieza cambió en otra pestaña

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

  // Un link compartido puede traer un formato que ya sacamos del registro:
  // se dibujaba con las proporciones del default sin decir nada.
  useEffect(() => {
    if (!preview?.formatId || isKnownFormat(preview.formatId)) return
    showToast(`⚠ El formato «${preview.formatId}» ya no existe — se muestra como ${formatLabel(DEFAULT_FORMAT)}`)
  }, [preview?.formatId])

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

  // El ZIP/PDF del carrusel se baja con el nombre de la pieza. El botón vive
  // en el editor, que no conoce el proyecto: se lo pasamos al motor.
  // (Va DESPUÉS de declarar projectName: en el array de dependencias se lee
  // durante el render, y arriba de la declaración eso revienta el componente.)
  useEffect(() => { setProjectExportName(projectName) }, [projectName])

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

  // La home dibuja el proyecto TAL COMO ESTÁ GUARDADO, o sea con la
  // referencia a IndexedDB en vez de la foto: las miniaturas de las piezas
  // con foto salían vacías. Se hidrata sólo la primera slide, que es lo
  // único que se ve en la miniatura.
  useEffect(() => {
    if (view !== 'gallery' || !projects.length) return
    let vivo = true
    ;(async () => {
      const nuevos = {}
      for (const p of projects) {
        if (!p.pieces?.[0] || thumbs[p.id]) continue
        if (!JSON.stringify(p.pieces[0]).includes('"idb:')) continue
        try {
          const h = await hydrate({ pieces: [p.pieces[0]] })
          nuevos[p.id] = h.pieces[0].content
        } catch {}
      }
      if (vivo && Object.keys(nuevos).length) setThumbs((t) => ({ ...t, ...nuevos }))
    })()
    return () => { vivo = false }
  }, [view, projects])

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
  // `conAccion` puede ser true (el "Deshacer" de siempre) o {label, run}
  // para un aviso con su propio botón (ej: "Recargar" del choque de pestañas).
  const [toastAct, setToastAct] = useState(null)
  const showToast = (msg, conAccion = false) => {
    const propia = conAccion && typeof conAccion === 'object' ? conAccion : null
    setToast(msg)
    setToastUndo(!!conAccion && !propia)
    setToastAct(propia)
    clearTimeout(window.__mt)
    window.__mt = setTimeout(() => { setToast(null); setToastUndo(false); setToastAct(null); setUndoDelete(null) }, conAccion ? 9000 : 2400)
  }

  const format = FORMATS_BY_ID[formatId] || FORMATS_BY_ID[DEFAULT_FORMAT]
  const current = pieces[active] || null

  // `rev` del proyecto tal como lo tenemos cargado en ESTA pestaña. Si en
  // localStorage hay otro, alguien lo guardó por fuera desde que abrimos.
  const revRef = useRef(0)
  const conflictoRef = useRef(false)
  useEffect(() => { conflictoRef.current = conflicto }, [conflicto])

  // Guardar de verdad. Antes vivía dentro del setTimeout del efecto: al
  // salir del editor React corría el cleanup, mataba el timer y el guardado
  // no ocurría nunca. Todo lo hecho en los últimos 800 ms se perdía.
  const guardar = async () => {
    if (!projectId || !piecesRef.current.length) return
    // ya avisamos del choque: seguir intentando sólo repite el aviso
    if (conflictoRef.current) return
    const liviano = await dehydrate(serialize()).catch(() => serialize())
    const next = upsertProject(liviano, { baseRev: revRef.current })
    if (next.conflict) {
      conflictoRef.current = true
      setConflicto(true)
      setProjects(next)
      showToast('⚠ Esta pieza se modificó en otra pestaña — no la pisamos',
        { label: 'Recargar', run: () => location.reload() })
      return
    }
    // quedamos parados en la versión que acaba de quedar guardada
    if (typeof next.rev === 'number') revRef.current = next.rev
    setProjects(next)
    if (next.saveOk === false) {
      setSaveFail(true)
      showToast('⚠ No se pudo guardar — mirá el aviso de abajo')
    } else {
      setSaveFail(false)
      setDirty(false)   // sin esto el chip decía "Guardando…" para siempre
      // `elementRefs()` NO es opcional: sin eso el recolector se lleva los
      // blobs de todo lo que esta en la biblioteca y no esta puesto en una
      // pieza guardada. Las fotos de "Mis elementos" quedaban en el indice
      // con el blob borrado — el recorte que tardaste en hacer, perdido.
      collectGarbage(next, elementRefs()).catch(() => {})
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
      // si la pieza cambió en otra pestaña, la copia de emergencia se
      // restauraría al arrancar y pisaría igual lo que hizo la otra
      if (conflictoRef.current) return
      try { localStorage.setItem('magoya_studio_pending_v1', JSON.stringify(serialize())) } catch {}
    }
    window.addEventListener('pagehide', alSalir)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') alSalir() })
    return () => window.removeEventListener('pagehide', alSalir)
  })
  const dirtyRef = useRef(dirty)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  // ---- iniciar desde template ----
  // `contenido` viene armado cuando la pieza sale del campo "¿qué querés
  // hacer?": el titular y la fecha ya son los que escribió la persona.
  function pickTemplate(template, chosenFormat, contenido) {
    const inicial = contenido || freshContent(template)
    setProjectId(newProjectId())
    revRef.current = 0; conflictoRef.current = false; setConflicto(false)
    namedByHand.current = false
    setProjectName(inicial.title || template.defaults?.title || template.name)
    setFormatId(chosenFormat?.id || galleryFormatId || DEFAULT_FORMAT)
    resetHistory()
    piecesRef.current = [{ template, content: inicial }]
    setPieces([{ template, content: inicial }])
    setActive(0)
    setCarousel(false)
    setDirty(false)
    navigate('editor')
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
    // Un formatId que ya no existe en el registro caía al default EN SILENCIO:
    // la pieza se abría con otras proporciones y nadie sabía por qué.
    const fmtOk = isKnownFormat(p.formatId)
    const avisos = []
    if (p.formatId && !fmtOk) avisos.push(`⚠ El formato «${p.formatId}» ya no existe — se abrió como ${formatLabel(DEFAULT_FORMAT)}`)
    if (faltantes) avisos.push(`⚠ ${faltantes} slide${faltantes > 1 ? 's usan' : ' usa'} una plantilla que no está en este navegador`)
    else if (p.__fotosFaltantes) avisos.push(`⚠ ${p.__fotosFaltantes} foto${p.__fotosFaltantes > 1 ? 's' : ''} ya no está${p.__fotosFaltantes > 1 ? 'n' : ''} en este navegador`)
    if (avisos.length) showToast(avisos.join(' · '))
    // Un link o un archivo abren una COPIA: reusar el id pisaba el proyecto
    // local que tuviera ese mismo id (y el del link viene sin fotos).
    const idExiste = p.id && loadProjects().some((x) => x.id === p.id)
    const id = (fuente !== 'local' && idExiste) ? newProjectId() : (p.id || newProjectId())
    setProjectId(id)
    // Desde qué versión venimos: la del objeto que ABRIMOS, no la que hay
    // ahora en localStorage. Si otra pestaña guardó mientras mirábamos la
    // home, la lista en pantalla ya es vieja: tomar la rev fresca nos dejaría
    // pisar ese trabajo sin darnos cuenta. Con id nuevo (copia de un link o
    // archivo) no hay nada que pisar.
    revRef.current = id === p.id ? (p.rev || 0) : projectRev(id)
    conflictoRef.current = false; setConflicto(false)
    namedByHand.current = true // el proyecto ya tiene su nombre elegido
    setProjectName(p.name || '')
    setFormatId(fmtOk ? p.formatId : DEFAULT_FORMAT)
    resetHistory()
    piecesRef.current = ps
    setPieces(ps)
    setActive(0)
    setCarousel(!!p.carousel)
    setDirty(false)
    navigate('editor')
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
  const activeRef = useRef(active)
  // El paso de historial guarda tambien EN QUE SLIDE estabas: si deshacés
  // el borrado de una slide, tiene que volver a aparecer y quedar elegida,
  // no dejarte parado en otra.
  const snapshot = () => ({ pieces: piecesRef.current, formatId: fmtRef.current, carousel: carRef.current, active: activeRef.current })
  const restore = (snap) => {
    if (!snap) return
    piecesRef.current = snap.pieces; setPieces(snap.pieces)
    fmtRef.current = snap.formatId; setFormatId(snap.formatId)
    carRef.current = snap.carousel; setCarousel(snap.carousel)
    const destino = typeof snap.active === 'number' ? snap.active : 0
    setActive(Math.max(0, Math.min(destino, snap.pieces.length - 1)))
  }
  const gestureRef = useRef(null)           // { tag, antes } del gesto abierto
  const idleRef = useRef(null)
  useEffect(() => { piecesRef.current = pieces }, [pieces])
  useEffect(() => { fmtRef.current = formatId }, [formatId])
  useEffect(() => { carRef.current = carousel }, [carousel])
  useEffect(() => { activeRef.current = active }, [active])

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
    revRef.current = 0; conflictoRef.current = false; setConflicto(false)
    namedByHand.current = false
    setProjectName('Pieza nueva')
    setFormatId(f.id)
    resetHistory()
    piecesRef.current = [{ template: BLANK_TEMPLATE, content: freshContent(BLANK_TEMPLATE) }]
    setPieces([{ template: BLANK_TEMPLATE, content: freshContent(BLANK_TEMPLATE) }])
    setActive(0); setCarousel(false); setDirty(false); navigate('editor')
  }
  // `preset` = carrusel armado (portada + internos + cierre). Sin preset,
  // las tres slides en blanco de siempre.
  function startBlankCarousel(fmt, preset) {
    const format = fmt && CAROUSEL_FORMATS.includes(fmt.id) ? fmt : FORMATS_BY_ID['li-carousel']
    const blank = () => ({ template: BLANK_TEMPLATE, content: freshContent(BLANK_TEMPLATE) })
    const slides = preset ? buildCarousel(preset) : [blank(), blank(), blank()]
    setProjectId(newProjectId())
    revRef.current = 0; conflictoRef.current = false; setConflicto(false)
    namedByHand.current = false
    setProjectName(preset ? preset.name : 'Carrusel')
    setFormatId(format.id)
    resetHistory()
    piecesRef.current = slides
    setPieces(slides)
    setActive(0)
    setCarousel(true)
    setDirty(false)
    navigate('editor')
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
    // Cambia el DISEÑO y conserva lo escrito. Antes se pasaba el content
    // entero y el diseño viejo le ganaba a la plantilla nueva: elegías otro
    // diseño y no cambiaba nada visible (lo vimos con Aye en vivo).
    let guardado = null
    mutatePieces((ps) => ps.map((p, i) => {
      if (i !== active) return p
      const content = applyDesign(template, p.content, { plantillaVieja: p.template })
      guardado = content.__guardado
      return { template, content }
    }))
    // Si el diseño nuevo tiene menos lugares que el viejo, algo de lo escrito
    // no entra. No se pierde (vuelve solo si cambiás a un diseño que lo
    // acepte), pero hay que decirlo: si no, ves desaparecer una frase.
    const faltan = guardado ? Object.keys(guardado).length : 0
    showToast(faltan
      ? (faltan === 1
        ? 'Diseño nuevo. Un texto no entra acá: queda guardado y vuelve si elegís un diseño que lo tenga.'
        : `Diseño nuevo. ${faltan} textos no entran acá: quedan guardados y vuelven si elegís un diseño que los tenga.`)
      : 'Listo: mismo texto, diseño nuevo')
  }
  // "quiero combinar diseños y no es muy claro cómo hacerlo" (Aye).
  // Combinar = que las slides se parezcan entre sí. Esto toma la slide en
  // la que estás y le pasa SU diseño al resto, sin tocarles el texto.
  function applyDesignToAll() {
    const src = pieces[active]
    if (!src || pieces.length < 2) return
    let conGuardado = 0
    mutatePieces((ps) => ps.map((p, i) => {
      if (i === active) return p
      const content = applyDesign(src.template, p.content, { disenoDe: src.content, plantillaVieja: p.template })
      if (content.__guardado) conGuardado++
      return { template: src.template, content }
    }))
    showToast(conGuardado
      ? `Diseño aplicado a las otras ${pieces.length - 1} slides. En ${conGuardado === 1 ? 'una' : conGuardado} hay texto que este diseño no tiene dónde poner: queda guardado.`
      : `Diseño aplicado a las otras ${pieces.length - 1} slides — los textos quedaron`, true)
  }
  function deleteSlide(i) {
    if (pieces.length <= 1) { showToast('Es la única slide: no se puede borrar'); return }
    mutatePieces((ps) => ps.filter((_, idx) => idx !== i))
    setActive((a) => Math.max(0, a - (i <= a ? 1 : 0)))
    showToast('Slide borrada', true)
  }
  // Vivía suelto en el JSX del Editor. Ahora también lo dispara el copiloto
  // ("ahora para Instagram"), y las dos puertas tienen que dejar el mismo
  // paso de historial: si no, ⌘Z deshace una y la otra no.
  // Y como el chat vive en la home, esta puerta se puede disparar con la
  // persona mirando otra pantalla. Un cambio que no se ve es un cambio que
  // no pidió: se la lleva a la pieza, igual que hace Aceptar. Desde el
  // Editor la línea no hace nada, que es lo que corresponde.
  function cambiarFormato(f) {
    if (!f || !FORMATS_BY_ID[f.id]) return
    endGesture(); pushHistory(snapshot())
    fmtRef.current = f.id; setFormatId(f.id); setDirty(true)
    if (view !== 'editor') navigate('editor')
  }

  // La foto del banco que pide el copiloto (poner_foto) entra por el MISMO
  // camino que el panel Detrás: changeContent sin tag = paso discreto de
  // historial, o sea ⌘Z la saca igual que si la hubiera puesto la persona.
  // No pasa por Aceptar porque acá no hay texto del modelo que revisar: es
  // una foto de la marca, elegida a pedido. Y rige la misma regla que
  // cambiarFormato: el chat vive en la home, un cambio que no se ve es un
  // cambio que no pidió — se la lleva a la pieza. Quién puede recibir foto
  // lo decide la capacidad ANTES de llamar acá (mismo criterio que
  // resolvePiece); esto sólo escribe.
  function ponerFotoDeFondo(foto) {
    const pieza = piecesRef.current[active]
    if (!pieza || !foto?.src) return
    // bg:'photo' explícito, como el ponerFondo del panel: si la persona había
    // pisado el fondo a color, la foto pedida tiene que verse, no quedar
    // guardada detrás de un fondo que la tapa.
    changeContent({ ...(pieza.content || {}), bg: 'photo', photo: foto })
    if (view !== 'editor') navigate('editor')
  }

  // ============================================================
  // EL COPILOTO — lo que ve y lo que puede tocar.
  //
  // Invariante 1: el texto que escribe el modelo NO llega acá. Llega una
  // PROPUESTA, que se guarda y espera. `aplicarPropuesta` es lo único de
  // este bloque que escribe en una pieza, y sólo lo llama Aceptar.
  // ============================================================
  const [propuesta, setPropuesta] = useState(null)
  // Por qué NO se pudo aplicar la propuesta del modal. Vive acá y no
  // adentro de `aplicarPropuesta` porque el que pide es el que muestra: la
  // card del chat dibuja su propio error, y un toast además sería el mismo
  // reto dos veces.
  const [propFalla, setPropFalla] = useState(null)

  // Poner los textos de una propuesta sobre un `content`. Devuelve el
  // contenido nuevo y QUÉ roles entraron: sin esa lista, quien llama no
  // tiene con qué decidir si decir "listo" o decir por qué no.
  //
  // Y "entraron" es literal: un rol que la plantilla no tiene NO se escribe
  // y NO se cuenta. Antes se escribía igual —`next[t.rol] = t.texto`, siempre—
  // y como el motor sólo dibuja los roles que la plantilla declara, ese texto
  // quedaba en el objeto sin aparecer en ningún lado: la card decía "Aceptada"
  // sobre una pieza que no cambió un píxel. Un puestos inflado es la forma
  // más barata de romper el invariante 1, porque nadie lo ve romperse.
  function escribirTextos(template, base, textos) {
    const next = { ...(base || {}) }
    const bloques = Array.isArray(next.textBlocks) ? [...next.textBlocks] : null
    const existe = new Set(rolesDePieza(template, next))
    const puestos = []
    const ignorados = []
    for (const t of textos) {
      // En una pieza libre el texto vive en un bloque suelto y el "rol" es
      // su estilo: escribir content[rol] ahí no se ve en ningún lado.
      const i = bloques ? bloques.findIndex((b) => (b.style || 'title') === t.rol) : -1
      if (i >= 0) { bloques[i] = { ...bloques[i], text: t.texto }; puestos.push(t.rol); continue }
      if (!existe.has(t.rol)) { ignorados.push(t.rol); continue }
      next[t.rol] = t.texto
      puestos.push(t.rol)
    }
    if (bloques) next.textBlocks = bloques
    return { content: next, puestos, ignorados }
  }

  // Los roles se nombran con las palabras del inspector, nunca con el id:
  // "Dato no tiene title" no le dice nada a nadie.
  const nombrarRoles = (roles) => roles.map((r) => (ROL_TEXTO[r] || r).toLowerCase()).join(', ')
  // Qué contarle a la persona cuando la plantilla se comió algo. Se arma acá
  // porque acá está el nombre de la plantilla; la card sólo lo muestra.
  const notaIgnorados = (tpl, ignorados) =>
    `«${tpl?.name || 'Esta pieza'}» no tiene ${nombrarRoles(ignorados)}: ${ignorados.length === 1 ? 'ese texto no se puso' : 'esos textos no se pusieron'}.`

  // El texto propuesto pisa el contenido de la slide en la que está parada
  // la persona, por el MISMO camino que el inspector (changeContent sin tag
  // = paso discreto de historial). O sea: se deshace con ⌘Z como cualquier
  // otra edición. Aceptar no es un modo especial, es escribir.
  //
  // EL CONTRATO: esto SIEMPRE devuelve un resultado. Nunca un `return`
  // mudo. Del otro lado la card del chat pone "Aceptada." sólo si acá
  // salió ok, así que un fallo callado le hace decir que aplicó un texto
  // que se perdió — y eso es exactamente lo que el invariante 1 promete
  // que no pasa.
  //   { ok: true,  puestos: ['title', …], ignorados?: ['quote'],
  //                nota?: 'frase para mostrar tal cual',
  //                abrio?: 'Nombre de la plantilla' }
  //   { ok: false, motivo: 'frase para mostrar tal cual',
  //                abrirCon?: { plantillaId, nombre } }
  // `abrirCon` es la salida del caso más común (la persona está en la home,
  // no hay ninguna pieza abierta): la propuesta trae plantilla, así que hay
  // dónde ponerla si alguien lo pide. Se pide con `{ abrir: true }` y no se
  // hace solo: aceptar un texto no puede crear un proyecto por su cuenta.
  //
  // Y `ok` es sobre lo que SE VE, no sobre lo que se ejecutó sin romperse.
  // Si de la propuesta no entró nada porque la plantilla no tiene esos
  // lugares, eso es un ok:false con el motivo en criollo: "«Dato / métrica»
  // no tiene titular". Si entró parte, es ok:true con la `nota` de lo que
  // quedó afuera — la card la muestra al lado del "Aceptada.", porque
  // aceptada a medias no es aceptada entera.
  function aplicarPropuesta(p, { abrir = false } = {}) {
    const textos = (p?.textos || [])
      .map((t) => ({ rol: t?.rol, texto: String(t?.texto ?? '').trim() }))
      .filter((t) => t.rol && t.texto)
    if (!textos.length) return { ok: false, motivo: 'Esa propuesta no trae ningún texto para poner.' }

    const pieza = piecesRef.current[active]
    if (!pieza) {
      const tpl = p?.plantillaId ? allById[p.plantillaId] : null
      if (!tpl) {
        return { ok: false, motivo: 'No hay ninguna pieza abierta donde poner ese texto. Abrí una plantilla desde Crear pieza y volvé a aceptar: la propuesta queda acá.' }
      }
      // Se escribe ANTES de decidir si ofrecer "Abrir y aplicar": es una
      // función pura, y ofrecer abrir una plantilla que no tiene dónde poner
      // el texto sería prometer el mismo Aceptar vacío con un paso más.
      const previo = escribirTextos(tpl, freshContent(tpl), textos)
      if (!previo.puestos.length) {
        return { ok: false, motivo: `${notaIgnorados(tpl, previo.ignorados)} Pedile al copiloto un texto para los lugares que sí tiene, o elegí otra plantilla.` }
      }
      if (!abrir) {
        return { ok: false, motivo: 'No hay ninguna pieza abierta donde poner ese texto.', abrirCon: { plantillaId: tpl.id, nombre: tpl.name } }
      }
      // Abrir y escribir en el mismo paso: si abriéramos primero y
      // aplicáramos después, `active` todavía sería el de la pieza anterior
      // y el texto caería en cualquier lado (o en ninguno).
      const { content, puestos, ignorados } = previo
      const nota = ignorados.length ? notaIgnorados(tpl, ignorados) : null
      setPropuesta(null); setPropFalla(null)
      // Si aceptar te muda al editor, el chat se va con vos: la card tiene
      // que poder decir "Aceptada." en la pantalla donde caés.
      setCopAbierto(true)
      pickTemplate(tpl, null, content)
      showToast(`Listo: abrimos «${tpl.name}» con ${puestos.length === 1 ? 'el texto' : 'los textos'} adentro${nota ? `. ${nota}` : ''}`)
      return { ok: true, puestos, ignorados, nota, abrio: tpl.name }
    }

    const { content, puestos, ignorados } = escribirTextos(pieza.template, pieza.content || {}, textos)
    // Nada entró: no se toca la pieza, no se cierra la propuesta y no se
    // dice "listo". El motivo nombra la plantilla y el rol con las palabras
    // del inspector, así la persona entiende que el problema es dónde iba a
    // caer el texto, no el texto.
    if (!puestos.length) {
      return { ok: false, motivo: `${notaIgnorados(pieza.template, ignorados)} Pedile al copiloto un texto para los lugares que sí tiene, o cambiá el diseño de la slide.` }
    }
    const nota = ignorados.length ? notaIgnorados(pieza.template, ignorados) : null
    changeContent(content)
    setPropuesta(null); setPropFalla(null)
    // El copiloto vive en la home: aceptar desde ahí escribiría en una pieza
    // que no está en pantalla. Si aceptás, te llevamos a verla — nadie
    // acepta un texto para que desaparezca.
    if (view !== 'editor') { setCopAbierto(true); navigate('editor') }
    const hecho = puestos.length === 1 ? 'Listo, texto aplicado' : `Listo, ${puestos.length} textos aplicados`
    showToast(`${hecho} — ⌘Z lo deshace${nota ? `. ${nota}` : ''}`)
    return { ok: true, puestos, ignorados, nota }
  }

  const ctxCopiloto = useMemo(() => ({
    plantillas: allTemplates,
    // La pieza que va acá es LA QUE VA A RECIBIR EL TEXTO, no la que se ve
    // en pantalla. Son dos cosas distintas y confundirlas dejaba muerto el
    // control más caro de todos: `aplicarPropuesta` escribe en
    // piecesRef.current[active] mire donde mire la persona, pero el chat
    // vive en la home, así que con el filtro `view === 'editor'` esto era
    // null SIEMPRE que el copiloto estaba a la vista. Consecuencias, todas
    // en silencio: el cruce de roles de proponer_textos —el que impide
    // encolar un titular para la plantilla Dato, que no tiene— no corría
    // nunca; la card no podía mostrar el "antes" de lo que iba a pisar; y
    // el modelo leía "no hay ninguna pieza abierta" mientras el Aceptar
    // escribía en una pieza de verdad.
    //
    // El miedo original era bueno y sigue en pie: no se puede hablar de "la
    // pieza que tenés abierta" con la persona parada en la home. Por eso
    // viaja `enPantalla`. El estado dice las dos cosas que son ciertas a la
    // vez: la pieza existe y va a recibir el texto, y ahora mismo no la
    // está mirando.
    proyecto: pieces.length
      ? {
        nombre: projectName,
        formatId,
        carousel,
        pieces: pieces.map((p) => ({ templateId: p.template.id, content: p.content })),
        slideActual: active,
        enPantalla: view === 'editor',
      }
      : null,
    // Lo que NO esté acá, para el copiloto no existe: estadoActual() le
    // lista exactamente estas claves como "lo que podés disparar".
    acciones: {
      abrirPlantilla: pickTemplate,
      abrirCarrusel: startBlankCarousel,
      abrirEnBlanco: startBlank,
      cambiarFormato,
      ponerFoto: ponerFotoDeFondo,
      proponer: (p) => { setPropuesta(p); setPropFalla(null); return { encolada: true } },
    },
    // Sólo las funciones de LECTURA, enumeradas a mano. Acá iba el
    // namespace entero de memoria.js, y eso dejaba registrarPieza,
    // registrarPublicacion, registrarMetricas e importarCSV —las cuatro
    // escriben en Supabase— al alcance de cualquier capacidad, hoy o la que
    // se agregue el mes que viene, sin pasar por `acciones`. Lo que no está
    // en `acciones` no se lista en el estado ni aparece en pantalla: sería
    // un efecto que la persona no pidió, no vio y no puede deshacer. Lo que
    // se escribe en la bitácora, se escribe desde la app.
    memoria: {
      listarBitacora: memoria.listarBitacora,
      resumenParaCopiloto: memoria.resumenParaCopiloto,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [customTemplates, view, pieces, projectName, formatId, carousel, active])

  // ============================================================
  // EL COPILOTO VIVE ACÁ, NO EN LA HOME.
  //
  // El chat estaba adentro de Gallery, o sea adentro de la vista
  // "gallery". Pero el flujo más común del copiloto TERMINA abriendo una
  // pieza: `abrir_plantilla` llama a pickTemplate, que navega al editor y
  // desmonta la home. Resultado, verificado: le pedías "quiero invitar a
  // algo", el copiloto abría la plantilla Evento y el chat se esfumaba en
  // el medio de su propia respuesta. El texto de cierre —el que explica
  // qué hizo y qué sigue— no se veía nunca, y lo que pasaba después del
  // desmontaje ni se guardaba (el efecto de sessionStorage no corre
  // desmontado): la sesión quedaba con agujeros.
  //
  // Ahora el hilo es estado de App, que no se desmonta nunca. Abajo se
  // dibuja en dos lugares —integrado en la home, y como panel lateral en
  // el editor— y es LA MISMA conversación: mismos turnos, mismas
  // propuestas pendientes, mismo fetch en curso.
  // ============================================================
  const [copAbierto, setCopAbierto] = useState(false)
  // Invariante 3, movido para arriba junto con el resto: el copiloto se
  // puede apagar con la persona editando, y el buscador de reglas tiene
  // que estar puesto cuando vuelva al inicio. Vacío significa "acá nunca
  // hubo copiloto": esa home es la de ayer y no tiene nada que explicar.
  const habiaCopRef = useRef(typeof copmotor.hayCopiloto === 'function' ? copmotor.hayCopiloto() : false)
  const [hayCop, setHayCop] = useState(habiaCopRef.current)
  const [avisoCaida, setAvisoCaida] = useState('')
  const [semillaPedido, setSemillaPedido] = useState('')
  const alCaerCopiloto = React.useCallback(({ texto, motivo, explicado } = {}) => {
    if (habiaCopRef.current) {
      const suyo = String(texto || '').trim()
      if (suyo) setSemillaPedido(suyo)
      // `explicado` = el chat quedó en pantalla con su propia línea; decir
      // lo mismo diez píxeles más abajo sería repetirse.
      setAvisoCaida(explicado ? '' : String(motivo || '').trim())
    }
    habiaCopRef.current = false
    setHayCop(false)
  }, [])
  const alVolverCopiloto = React.useCallback(() => {
    habiaCopRef.current = true
    setAvisoCaida(''); setSemillaPedido(''); setHayCop(true)
  }, [])

  const cop = useCopiloto({
    ctx: ctxCopiloto,
    onPropuesta: aplicarPropuesta,
    onSinCopiloto: alCaerCopiloto,
    onVuelveCopiloto: alVolverCopiloto,
  })

  // Cuando el copiloto se pone a trabajar, su panel se abre. Es la regla
  // que arregla el defecto: si el pedido termina abriendo una pieza, la
  // persona llega al editor con la conversación a la vista y lee el cierre
  // en vez de encontrarse con el chat desaparecido. Cerrarlo a mano gana
  // hasta el próximo pedido — mientras piensa no se reabre solo.
  const pensandoRef = useRef(cop.pensando)
  useEffect(() => {
    if (cop.pensando && !pensandoRef.current) setCopAbierto(true)
    pensandoRef.current = cop.pensando
  }, [cop.pensando])

  // Las frases de arranque del panel del editor. Salen de lo que el
  // copiloto PUEDE hacer, igual que las de la home: si mañana se cae una
  // capacidad, se cae su chip solo. Acá la persona ya tiene una pieza
  // abierta, así que hablan de esa pieza y no de cuál elegir.
  const chipsEditor = useMemo(() => {
    const puede = new Set(CAPACIDADES.map((c) => c.nombre))
    const out = []
    if (puede.has('proponer_textos')) out.push('Mejorá el titular de esta pieza', 'Dame una bajada más corta')
    if (puede.has('revisar_copy')) out.push('Revisá el texto de esta pieza')
    return out.slice(0, 3)
  }, [])

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
  async function addCustomElement({ name, src, kind, origin }) {
    // el `kind` se descartaba acá: las fotos subidas terminaban archivadas
    // como logos y "Mis fotos" quedaba siempre vacío. Lo mismo pasaba con
    // `origin`: sin él, la misma foto de la biblioteca traída una vez de
    // fondo (2048 px) y otra encima (1400 px) entraba dos veces.
    const { el, saved } = await addElement({ name, src, kind, origin })
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
      const lista = rememberShare({ id, name: projectName || 'Sin título', formatId })
      setShares(lista)
      // el portapapeles puede fallar (pestaña sin foco): la pieza YA se subió,
      // así que en ese caso mostramos el link en vez de mentir con un error.
      const ok = await copyToClipboard(link)
      // si la lista de compartidas no se pudo guardar, prometer
      // "lo tenés en Inicio › Compartidas" es mentira: al recargar no está.
      if (lista.saveOk === false) {
        setLinkToCopy(link)
        showToast('⚠ Se subió, pero no se pudo anotar en Compartidas — guardate el link')
      } else if (ok) showToast('✓ Link de revisión copiado — lo tenés en Inicio › Compartidas')
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
    // el carrusel se pasa entero: antes el que revisaba veía sólo la slide 1
    // y sin los puntos, o sea no podía revisar cómo encadena
    const pvSlides = multi ? pvPieces.map((x) => ({ template: allById[x.templateId], content: x.content })).filter((x) => x.template) : null
    const pvLock = pvSlides && pvSlides.length > 1 && pc?.content?.mismoTamano !== false ? tamanoComun(pvSlides, pfmt) : null
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
          <button className="brand" onClick={exitPreview}>
            <img src={WORDMARKS.cream.url} alt="Magoya" className="brand-mark" />
            <span className="brand-sub">Studio</span>
          </button>
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
              // pasar de slide no es dejar un comentario
              if (e.target.closest('.c-pin') || e.target.closest('.pin-form')) return
              if (e.target.closest('.mk-carrusel') || e.target.closest('.mkc-dot') || e.target.closest('.mk-story-top')) return
              const r = e.currentTarget.getBoundingClientRect()
              setPin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, slide: idx })
            }}>
            {t ? <MockupPreview template={t} content={pc.content} format={pfmt} mockup={preview.mockup || 'ig'} dark={!!preview.dark}
              slides={pvSlides} sizeLock={pvLock} slideIdx={idx} onSlide={setPvSlide} /> : <div className="center-note">No se pudo cargar la pieza compartida.</div>}
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
        <button className="brand" onClick={() => navigate('gallery')} title="Ir al inicio">
          <img src={WORDMARKS.cream.url} alt="Magoya" className="brand-mark" />
          <span className="brand-sub">Studio</span>
        </button>
        {view !== 'editor' && (
          <nav className="topnav">
            <button className={view === 'gallery' ? 'on' : ''} onClick={() => navigate('gallery')}>Crear pieza</button>
            <button className={view === 'brandkit' ? 'on' : ''} onClick={() => navigate('brandkit')}>Kit de marca</button>
            {/* Sin Pulso el copiloto no tiene qué leer: es la puerta por
                donde entran los datos que después cita. */}
            <button className={view === 'pulso' ? 'on' : ''} onClick={() => navigate('pulso')}>Pulso</button>
          </nav>
        )}
        {view === 'editor' && current && (
          <nav className="crumbs" aria-label="Ubicación">
            <button className="crumb-link" onClick={() => navigate('gallery')}>Inicio</button>
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
            <span className={'save-status' + (saveFail || conflicto ? ' fail' : '')}
              title={conflicto ? 'La misma pieza se guardó desde otra pestaña. Para no pisar ese trabajo dejamos de guardar acá: bajá esta versión o recargá para quedarte con la otra.'
                : saveFail ? 'No se pudo guardar: el navegador está lleno' : 'Tu trabajo se guarda solo'}>
              {conflicto ? '⚠ Cambió en otra pestaña' : saveFail ? '⚠ No se pudo guardar' : dirty ? '• Guardando…' : '✓ Guardado'}
            </span>
            {conflicto && <button className="btn ghost-light" onClick={() => exportProjectFile(serialize())}>Bajar esta versión</button>}
            {conflicto && <button className="btn ghost-light" onClick={() => location.reload()}>Recargar</button>}
            {saveFail && <button className="btn ghost-light" onClick={() => exportProjectFile(serialize())}>Descargar ahora</button>}
            {/* El copiloto también acá. Es un panel más del editor, no un
                widget flotante: se abre y se cierra desde la barra, como
                cualquier otra cosa de esta app. Si no está disponible, el
                botón no existe — no se ofrece lo que no anda. */}
            {hayCop && (
              <button className={'btn ghost-light cop-toggle' + (copAbierto ? ' on' : '')}
                aria-pressed={copAbierto}
                onClick={() => setCopAbierto((v) => !v)}
                title={copAbierto ? 'Cerrar el copiloto' : 'Abrir el copiloto'}>
                <Icon n="sparkle" size={14} /> Copiloto
              </button>
            )}
            <button className="btn ghost-light" onClick={() => navigate('gallery')}>‹ Volver al inicio</button>
          </>
        )}
      </div>

      {view === 'brandkit' ? (
        <BrandKit onToast={showToast} />
      ) : view === 'pulso' ? (
        <Pulso onVolver={() => navigate('gallery')} />
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
          thumbs={thumbs}
          onImport={importFile}
          shares={shares}
          shareCounts={shareCounts}
          shareVerdicts={shareVerdicts}
          onOpenShare={openShare}
          onCopyShare={copyShareLink}
          onForgetShare={removeShare}
          cop={cop}
          hayCop={hayCop}
          avisoCaida={avisoCaida}
          semillaPedido={semillaPedido}
          onVerPieza={pieces.length ? () => navigate('editor') : null}
        />
      ) : current ? (
        <div className="ed-wrap">
        <Editor
          template={current.template}
          content={current.content}
          format={format}
          slides={carousel ? pieces : null}
          activeSlide={active}
          onChangeContent={changeContent}
          onChangeFormat={cambiarFormato}
          onSelectSlide={setActive}
          onAddSlide={addSlide}
          onDuplicateSlide={duplicateSlide}
          onReorderSlides={reorderSlides}
          onUndo={undo} onRedo={redo}
          canUndo={undoRef.current.length > 0} canRedo={redoRef.current.length > 0}
          onConvertToCarousel={convertToCarousel}
          onBackToSingle={backToSingle}
          onChangeSlideTemplate={changeSlideTemplate}
          onApplyDesignToAll={applyDesignToAll}
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
        {/* El panel del copiloto es una columna más, hermana del lienzo:
            el stage es flex:1, así que la pieza se reacomoda y se sigue
            pudiendo trabajar con el chat abierto. No tapa nada. */}
        {/* Si el copiloto se apagó no se OFRECE (el botón de la barra
            desaparece), pero un hilo que ya está en pantalla no se evapora
            con el pedido adentro: se queda hasta que lo cierren, con su
            línea de qué pasó. Sin conversación, el componente devuelve
            null solo y acá no queda una columna vacía. */}
        {(hayCop || cop.turnos.length > 0) && copAbierto && (
          <aside className="cop-lateral" aria-label="Copiloto">
            <Copiloto cop={cop} sugerenciasIniciales={chipsEditor} onCerrar={() => setCopAbierto(false)} />
          </aside>
        )}
        </div>
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

      {/* Una propuesta que llegó por fuera del chat (el chat dibuja la suya
          adentro del hilo). Se muestra igual y con las mismas dos salidas:
          nada del modelo entra a una pieza sin que alguien apriete Aceptar. */}
      {propuesta && (
        <div className="mk-modal-ov" onClick={() => { setPropuesta(null); setPropFalla(null) }}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-head">
              <strong>El copiloto propone un texto</strong>
              <button className="btn" onClick={() => { setPropuesta(null); setPropFalla(null) }}>Cerrar</button>
            </div>
            <div className="cop-prop">
              {propuesta.motivo && <p className="cop-prop-why">{propuesta.motivo}</p>}
              {(propuesta.textos || []).map((t, i) => (
                <div key={i} className="cop-campo">
                  <div className="cop-campo-rol">{ROL_TEXTO[t.rol] || t.rol}</div>
                  {t.antes && <p className="cop-antes">{t.antes}</p>}
                  <p className="cop-despues">{t.texto}</p>
                </div>
              ))}
              {/* Si no se pudo aplicar, el modal NO se cierra: se dice por
                  qué y los botones siguen ahí. Cerrarlo callado sería tirar
                  el texto y hacer de cuenta que entró. */}
              {propFalla && <p className="cop-warn">{propFalla.motivo}</p>}
              <div className="cop-prop-acts">
                {propFalla?.abrirCon && (
                  <button className="btn primary" onClick={() => {
                    const r = aplicarPropuesta(propuesta, { abrir: true })
                    if (!r.ok) setPropFalla(r)
                  }}>Abrir «{propFalla.abrirCon.nombre}» y aplicar</button>
                )}
                <button className={'btn' + (propFalla?.abrirCon ? '' : ' primary')} onClick={() => {
                  const r = aplicarPropuesta(propuesta)
                  setPropFalla(r.ok ? null : r)
                }}>{propFalla ? 'Reintentar' : 'Aceptar'}</button>
                <button className="btn" onClick={() => { setPropuesta(null); setPropFalla(null) }}>Descartar</button>
              </div>
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
          <button className="btn ghost-light" onClick={() => navigate('gallery')}>Hacer lugar</button>
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
          {/* aviso con su propio botón (ej: "Recargar" del choque de pestañas) */}
          {toastAct && (
            <button className="toast-act" onClick={() => { const r = toastAct.run; setToastAct(null); r && r() }}>{toastAct.label}</button>
          )}
          {/* Una sola regla: TODO lo que se borra ofrece Deshacer acá mismo.
              Si no hay nada guardado aparte (un objeto, una slide), el botón
              usa el historial normal. */}
          {!toastAct && (undoDelete || toastUndo) && (
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
