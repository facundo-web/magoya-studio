import React, { useState, useRef, useEffect } from 'react'
import PiecePreview from './PiecePreview.jsx'
import { TEMPLATES, MAXCHARS } from '../templates/index.js'
import { variantsFor, activeVariantId } from '../templates/variants.js'
import { tamanoComun } from '../engine/layouts.js'
import { checkCopy, checkPiece, checkContrast } from '../lib/copyCheck.js'
import MockupPreview, { MOCKUPS, mockupsPara } from './MockupPreview.jsx'
import Icon from '../ui/Icon.jsx'
import { FORMATS_BY_ID, formatsByNetwork, CAROUSEL_FORMATS } from '../formats/registry.js'
import { COLOR_SCHEMES, ACCENTS, WORDMARKS, GRADIENTS, HIGHLIGHTS, TEXT_COLORS } from '../brand/brandKit.js'
import { ALL_OBJECTS, ICONS_BY_ID, ICON_CATEGORIES, LIGHT_TILE, TILE_GRADIENT, TILE_SHAPE } from '../brand/iconLibrary.js'
import { PHOTOS } from '../brand/photoLibrary.js'

// colores para teñir logos "sin fondo" y marcas
const TINTS = [
  { k: 'accent', label: 'Acento', value: 'accent', sw: '#00DE68' },
  { k: 'ink', label: 'Negro', value: '#0D0C0C', sw: '#0D0C0C' },
  { k: 'white', label: 'Blanco', value: '#FFFFFF', sw: '#FFFFFF' },
  { k: 'emerald', label: 'Verde', value: '#00DE68', sw: '#00DE68' },
  { k: 'blue', label: 'Azul', value: '#2E7DD1', sw: '#2E7DD1' },
  { k: 'yellow', label: 'Amarillo', value: '#F2C14E', sw: '#F2C14E' },
]
import { imageSize, getAsset, compressImage, removeBackground } from '../engine/assets.js'
import { measure, wrapText } from '../engine/textLayout.js'
import { exportPiece, exportCarousel } from '../engine/export.js'

// Todo lo que entra como foto se comprime primero. OBJ_MAX es más chico que
// el fondo a propósito: una foto dentro de un celular se ve a ~1/4 de la
// pieza, guardarla en 2048px es 4× de peso que nadie va a ver.
const OBJ_MAX = 1400
const blobToCompressed = (blob, maxSide = OBJ_MAX) => compressImage(blob, maxSide)
async function fetchCompressed(url, maxSide = OBJ_MAX) {
  const blob = await (await fetch(url)).blob()
  return compressImage(blob, maxSide)
}

// ============================================================
// R1 · TODO LO QUE ENTRA QUEDA EN EL BANCO
//
// La biblioteca guardaba sólo lo que subías por el panel Fotos. Todo lo que
// la persona PRODUCÍA adentro de la herramienta se perdía al cerrar: el
// recorte de "Quitar fondo" (que baja un modelo de ~5 MB y tarda) y las
// fotos de la biblioteca Magoya que traías a la pieza. Ahora cualquier
// imagen que entra o que sale de la herramienta queda también en la
// biblioteca, con un nombre que se entiende.
//
// Se guarda EXACTAMENTE el mismo data-URL que va a la pieza, no una copia
// recomprimida: putPhoto() hashea el contenido, así que los bytes quedan una
// sola vez en IndexedDB y los comparten la pieza y la biblioteca.
// ============================================================
const DONDE = { photo: 'Mis fotos', element: 'Mis elementos' }

// Devuelve el elemento de la biblioteca — el que se acaba de guardar o el
// que YA estaba (marcado con `dup`). Siempre devuelve el elemento, aunque
// fuera duplicado: el `id` es lo que enlaza el objeto de la pieza con su
// entrada en la biblioteca, y perderlo por haber traído dos veces la misma
// foto era romper el vínculo justo cuando ya la teníamos.
async function alBanco(onAddElement, { name, src, kind = 'element', origin }) {
  if (!onAddElement || !src) return null
  try {
    return await onAddElement({ name, src, kind, origin })
  } catch (e) {
    console.warn('[biblioteca] no se pudo guardar', e)
    return null
  }
}

// Guarda y avisa en una línea. Sin drama: si ya estaba, no dice nada.
async function guardarYAvisar(onAddElement, onToast, item) {
  const el = await alBanco(onAddElement, item)
  if (el && !el.dup && onToast) onToast(`Guardado en ${DONDE[item.kind || 'element']}: «${el.name}»`)
  return el
}

// "recorte de <lo que era>" — el nombre tiene que decir de dónde salió, si
// no la biblioteca se llena de "Elemento", "Elemento", "Elemento".
const nombreRecorte = (n) => (String(n || '').trim() ? `Recorte de ${String(n).trim()}` : 'Recorte')

const ROLE_LABELS = {
  kicker: 'Etiqueta',
  title: 'Título',
  subtitle: 'Subtítulo',
  body: 'Cuerpo',
  metric: 'Dato / número',
  metricLabel: 'Descripción del dato',
  quote: 'Cita',
  author: 'Autor / fuente',
}

// grilla de posiciones (para ubicar objetos rápido)
const SHAPE_NAMES = { arrow: 'Flecha gruesa', handArrow: 'Flecha a mano', sparkle: 'Destello', badge: 'Etiqueta', bars: 'Barras', sparkline: 'Curva', callout: 'Bocadillo', window: 'Captura de pantalla' }
// formas dibujadas con trazo (tienen grosor ajustable)
const STROKE_SHAPES = ['handArrow', 'sparkline']

const POS_GRID = [
  [0.22, 0.2], [0.5, 0.2], [0.78, 0.2],
  [0.22, 0.5], [0.5, 0.5], [0.78, 0.5],
  [0.22, 0.8], [0.5, 0.8], [0.78, 0.8],
]

// Caja real de cada forma — tiene que dar lo MISMO que drawShape() en
// layouts.js, si no el marco de selección no coincide con el dibujo.
function shapeBox(o, ref) {
  const size = ref * (o.scale || 0.3)
  switch (o.shape) {
    case 'arrow': case 'handArrow': case 'sparkline': return { w: size, h: size * 0.5 }
    case 'bars': return { w: size, h: size * 0.62 }
    case 'window': return { w: size, h: size * (o.ratio || 0.62) }
    case 'panel': { const w = ref * (o.scale || 0.34); return { w, h: w * (o.ratio || 0.7) } }
    case 'badge': {
      const px = size * 0.26
      const w = measure(String(o.text || 'NUEVO').toUpperCase(), { px, weight: 800, tracking: 0.06 }) + px * 1.5
      return { w, h: px * 2 }
    }
    case 'callout': {
      const w = size
      const px = w * 0.115
      const padX = w * 0.09, padY = w * 0.075
      const lh = 1.28
      const txt = String(o.text || '').trim()
      const lines = txt ? wrapText(txt, { px, weight: 600, maxWidth: w - padX * 2 }) : []
      return { w, h: Math.max(w * 0.42, lines.length * px * lh + padY * 2 - px * (lh - 1) * 0.5) }
    }
    default: return { w: size, h: size }
  }
}

const clampScale = (v) => Math.min(1.2, Math.max(0.05, v))

// Cerrar tiene que funcionar igual en todos lados. Los menús sólo cerraban
// con `mouseleave`: en touch ese evento no existe, así que quedaban abiertos
// tapando la barra hasta volver a tocar el botón que los abrió.
function useCerrar(abierto, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const afuera = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', afuera, true)
    document.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('pointerdown', afuera, true)
      document.removeEventListener('keydown', esc, true)
    }
  }, [abierto, onClose])
  return ref
}

// Overlay de modal: Escape cierra, click afuera cierra, el foco entra y
// vuelve. Antes cada modal lo resolvía distinto (o no lo resolvía).
function ModalOverlay({ onClose, clase, overlay = 'mk-modal-ov', etiqueta, children }) {
  const ref = useModal(onClose)
  return (
    <div className={overlay} onClick={onClose}>
      <div className={clase} ref={ref} role="dialog" aria-modal="true" aria-label={etiqueta}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// Escape cierra el modal, el foco entra al abrirlo y vuelve al cerrar.
function useModal(onClose) {
  const ref = useRef(null)
  const antes = useRef(null)
  useEffect(() => {
    antes.current = document.activeElement
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', esc, true)
    const primero = ref.current?.querySelector('input, button, select, textarea')
    primero?.focus()
    return () => {
      document.removeEventListener('keydown', esc, true)
      try { antes.current?.focus() } catch {}
    }
  }, [onClose])
  return ref
}

// Cada elemento nuevo cae un poquito corrido del anterior. Si todos caen en
// el mismo punto quedan perfectamente apilados y sólo se puede agarrar el
// último — hay que acordarse de mover cada uno apenas lo ponés.
function enCascada(objects, base) {
  const n = objects.length
  const paso = 0.075
  const i = n % 6
  return { ...base, x: Math.min(0.92, (base.x ?? 0.5) + i * paso), y: Math.min(0.92, (base.y ?? 0.5) + i * paso) }
}

// El formato es "dónde lo publico": el paso final del flujo. Vive arriba
// del lienzo, que es donde la gente hace click, no escondido en un panel.
function FormatPicker({ format, onChangeFormat }) {
  const groups = formatsByNetwork()
  return (
    <label className="fmt-picker" title="Dónde se publica: la pieza se re-acomoda sola">
      <span className="fmt-cur">{format.network} · {format.label}</span>
      <span className="fmt-dim">{format.w}×{format.h}</span>
      <select value={format.id} onChange={(e) => onChangeFormat(FORMATS_BY_ID[e.target.value])}>
        {Object.entries(groups).map(([net, list]) => (
          <optgroup key={net} label={net}>
            {list.map((f) => <option key={f.id} value={f.id}>{f.label} · {f.w}×{f.h}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

// H1 · control de zoom. "Ajustar" es el default y siempre se puede volver.
function ZoomCtl({ zoom, setZoom, fit }) {
  const pct = Math.round((zoom || fit()) * 100)
  return (
    <span className="zoom-ctl" title="⌘ + rueda para acercar · ⌘0 para ajustar">
      <button className="zbtn" onClick={() => setZoom((z) => Math.max(0.1, (z || fit()) * 0.83))} aria-label="Alejar">−</button>
      <button className={'zval' + (zoom ? '' : ' fit')} onClick={() => setZoom(zoom ? 0 : 1)}>
        {zoom ? pct + '%' : 'Ajustar'}
      </button>
      <button className="zbtn" onClick={() => setZoom((z) => Math.min(4, (z || fit()) * 1.2))} aria-label="Acercar">+</button>
    </span>
  )
}


/* ---------------- Estilo: variantes de la plantilla (Bloque B) ----------------
   Las miniaturas se renderizan CON TU CONTENIDO REAL (patrón Canva Layouts):
   ves tu propio texto y tu propia foto en cada composición antes de elegir. */
function VariantsBody({ template, content, format, variants, active, set }) {
  // formato chico para las miniaturas: mismo ratio, menos píxeles
  const thumbFmt = React.useMemo(() => {
    const k = 380 / Math.max(format.w, format.h)
    return { ...format, w: Math.round(format.w * k), h: Math.round(format.h * k) }
  }, [format.w, format.h, format.id])
  return (
    <div className="var-grid">
      {variants.map((v) => (
        <button key={v.id} className={'var-card' + (active === v.id ? ' on' : '')}
          onClick={() => set(v.set)} title={v.label}>
          <div className="var-thumb">
            <PiecePreview template={template} content={{ ...content, ...v.set }} format={thumbFmt} />
          </div>
          <span className="var-label">{v.label}</span>
        </button>
      ))}
    </div>
  )
}

export default function Editor({
  template, format, content, slides, activeSlide,
  onChangeContent, onChangeFormat, onSelectSlide, onAddSlide, onDuplicateSlide, onReorderSlides, onConvertToCarousel, onBackToSingle, onChangeSlideTemplate, onApplyDesignToAll, onDeleteSlide, onToast,
  elements = [], onAddElement, onDeleteElement,
  templates = TEMPLATES, onSaveTemplate, onShare, onShareReview, onExportFile, onUndo, onRedo, canUndo, canRedo,
}) {
  const [busy, setBusy] = useState(false)
  const [selObj, setSelObj] = useState(null)
  // Multiselección: `selObj` sigue siendo el "primario" (el que muestra los
  // tiradores de resize y el panel de propiedades de a uno), y `multiSel`
  // son los demás objetos que también están agarrados en el grupo. Se
  // arman con Shift+click, sin tocar ninguno de los flujos de selección
  // simple que ya existían.
  const [multiSel, setMultiSel] = useState(() => new Set())
  const seleccion = React.useMemo(
    () => [...new Set([selObj, ...multiSel])].filter((x) => x != null),
    [selObj, multiSel],
  )
  const clipboardRef = useRef(null)
  const deselectAll = () => { setSelObj(null); setMultiSel(new Set()) }
  const toggleMultiSel = (idx) => {
    if (selObj === idx) {
      // el primario sale del grupo: si queda alguien más, ese pasa a ser el nuevo primario
      const resto = [...multiSel]
      setSelObj(resto.shift() ?? null)
      setMultiSel(new Set(resto))
      return
    }
    if (multiSel.has(idx)) { const next = new Set(multiSel); next.delete(idx); setMultiSel(next); return }
    if (selObj == null) { setSelObj(idx); return }
    setMultiSel(new Set(multiSel).add(idx))
  }
  const [selText, setSelText] = useState(null) // eid del texto seleccionado
  // "Cuando es texto no me permite selección múltiple" — mismo modelo que
  // los objetos (primario + resto del grupo), aplicado a textos. Es un
  // grupo APARTE del de objetos a propósito: mezclar un texto y un logo
  // en un mismo grupo no tiene una acción de conjunto clara (¿el borrado
  // qué hace con cada uno?), así que se puede armar un grupo de varios
  // objetos O de varios textos, no los dos mezclados.
  const [multiSelText, setMultiSelText] = useState(() => new Set())
  const textSeleccion = React.useMemo(
    () => [...new Set([selText, ...multiSelText])].filter(Boolean),
    [selText, multiSelText],
  )
  const toggleMultiSelText = (eid) => {
    if (selText === eid) {
      const resto = [...multiSelText]
      setSelText(resto.shift() ?? null)
      setMultiSelText(new Set(resto))
      return
    }
    if (multiSelText.has(eid)) { const next = new Set(multiSelText); next.delete(eid); setMultiSelText(next); return }
    if (selText == null) { setSelText(eid); return }
    setMultiSelText(new Set(multiSelText).add(eid))
  }
  // El fondo es la tercera cosa editable de la pieza, y sus ajustes vivian en
  // el panel IZQUIERDO — al lado de la biblioteca de fotos, a pantalla y media
  // de scroll. Rompia la unica regla del editor: a la izquierda elegis, a la
  // derecha editas. Ahora es una fila seleccionable como los textos y los
  // elementos, y sus propiedades salen a la derecha con todo lo demas.
  const [selBg, setSelBg] = useState(false)
  const [hoverObj, setHoverObj] = useState(null)
  const [editing, setEditing] = useState(null) // edición de texto in-place
  const [showSafe, setShowSafe] = useState(false)
  const [panelW, setPanelW] = useState(() => {
    // Aye: "tenía corrido, está escondido eso, no estaba viendo". El ancho
    // guardado podía dejar el panel casi cerrado y no había forma de saber
    // que ahí había algo. Nunca por debajo de un ancho usable.
    const MIN = 240
    try {
      const g = JSON.parse(localStorage.getItem('magoya_panels_v1')) || {}
      return { left: Math.max(MIN, g.left || 300), right: Math.max(MIN, g.right || 320) }
    } catch { return { left: 300, right: 320 } }
  })
  const startResize = (side, e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = panelW[side]
    const move = (ev) => {
      const dx = ev.clientX - startX
      const w = Math.max(240, Math.min(480, side === 'left' ? startW + dx : startW - dx))
      setPanelW((p) => ({ ...p, [side]: w }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      setPanelW((p) => { try { localStorage.setItem('magoya_panels_v1', JSON.stringify(p)) } catch {} return p })
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const [chooser, setChooser] = useState(null) // null | 'add' | 'change'
  const [mockupOpen, setMockupOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [mockup, setMockup] = useState('ig')
  // si cambiás el formato, el mockup elegido puede dejar de tener sentido
  useEffect(() => {
    const ok = mockupsPara(format)
    if (ok.length && !ok.some((m) => m.k === mockup)) setMockup(ok[0].k)
  }, [format.id])
  const [mkSafe, setMkSafe] = useState(false)
  const [mkDark, setMkDark] = useState(false)
  const [panel, setPanel] = useState('text')
  const [dragSlide, setDragSlide] = useState(null) // rail de inserción: un panel a la vez
  // G2 · en celular los paneles son hojas que suben desde abajo
  const [sheet, setSheet] = useState(false)
  // H1 · Zoom. Sin esto, una story 1080×1920 entra al ~35% en una notebook
  // y ajustar el borde de un recorte es imposible: la única salida era
  // exportar, mirar y volver.
  const [zoom, setZoom] = useState(0)   // 0 = ajustar a la pantalla
  const stageRef = useRef(null)
  const frameRef = useRef(null)
  const photoInputRef = useRef(null)
  const dragRef = useRef({ i: null })
  const textDragRef = useRef(null)

  // cuánto entra en el lienzo (lo que hace hoy el CSS), para arrancar el
  // zoom manual desde el valor que ya estabas viendo
  const fitZoom = () => {
    const el = stageRef.current
    if (!el) return 1
    const pad = 48
    return Math.min((el.clientWidth - pad) / format.w, (el.clientHeight - pad) / format.h, 1)
  }
  // al cambiar de formato se vuelve a ajustar: es lo que espera cualquiera
  useEffect(() => { setZoom(0) }, [format.id])

  const isCarousel = slides && slides.length > 0
  // Feedback de Aye: "en un mismo campo el tamaño del texto cambia de slide
  // en slide porque la cantidad de texto que lleva es diferente". Es cierto:
  // el auto-ajuste achica cada slide por separado. Con esto todas usan el
  // tamaño de la que más texto tiene, que es el único que entra en todas.
  const mismoTamano = content.mismoTamano !== false
  const sizeLock = React.useMemo(
    () => (isCarousel && slides.length > 1 && mismoTamano ? tamanoComun(slides, format) : null),
    [isCarousel, slides, format, mismoTamano],
  )
  const canCarousel = CAROUSEL_FORMATS.includes(format.id)
  // podías quedar con 5 slides en formato "Miniatura de YouTube" y nadie
  // avisaba: se exportaba un ZIP de 5 miniaturas sin sentido
  const carruselIncompatible = isCarousel && slides.length > 1 && !canCarousel

  // `tag` = nombre de la interacción en curso; agrupa todo el gesto en un
  // solo paso de deshacer (ver changeContent en App.jsx).
  const set = (patch, tag) => onChangeContent({ ...content, ...patch }, tag)
  const objects = content.objects || []
  const setObjects = (next, tag) => set({ objects: next }, tag)
  const updateObject = (i, patch, tag) => setObjects(objects.map((o, idx) => (idx === i ? { ...o, ...patch } : o)), tag)
  const objRemove = (i) => {
    const nombre = objectName(objects[i], ICONS_BY_ID[objects[i]?.iconId || objects[i]?.deviceId])
    setObjects(objects.filter((_, idx) => idx !== i)); deselectAll()
    // misma regla para TODO lo que se borra: aviso con Deshacer
    onToast('Se quitó «' + nombre + '»', true)
  }
  const objDuplicate = (i) => {
    const o = objects[i]
    if (!o) return
    setObjects([...objects, enCascada(objects, { ...JSON.parse(JSON.stringify(o)) })])
    setSelObj(objects.length); setMultiSel(new Set())
  }
  const objBringFront = (i) => { const a = [...objects]; const [it] = a.splice(i, 1); a.push(it); setObjects(a); setSelObj(a.length - 1) }
  const objSendBack = (i) => { const a = [...objects]; const [it] = a.splice(i, 1); a.unshift(it); setObjects(a); setSelObj(0) }
  // ---- acciones de GRUPO: sobre toda la selección, no sólo el primario ----
  const objRemoveMany = (idxs) => {
    if (!idxs.length) return
    if (idxs.length === 1) { objRemove(idxs[0]); return }
    const set = new Set(idxs)
    setObjects(objects.filter((_, idx) => !set.has(idx))); deselectAll()
    onToast(`Se quitaron ${idxs.length} elementos`, true)
  }
  // Duplicar y pegar hacen lo mismo (una copia en cascada de cada uno,
  // encadenadas para que no queden todas exactamente superpuestas) — por
  // eso comparten esta función; sólo cambia de dónde sale la lista de origen.
  const clonarEnCascada = (fuente) => {
    let working = objects
    const nuevos = []
    for (const o of fuente) {
      if (!o) continue
      const copia = enCascada(working, JSON.parse(JSON.stringify(o)))
      nuevos.push(copia)
      working = [...working, copia]
    }
    const base = objects.length
    setObjects(working)
    setSelObj(nuevos.length ? base : null)
    setMultiSel(new Set(nuevos.slice(1).map((_, k) => base + 1 + k)))
    return nuevos.length
  }
  const objDuplicateMany = (idxs) => {
    if (idxs.length <= 1) { if (idxs.length) objDuplicate(idxs[0]); return }
    clonarEnCascada(idxs.map((i) => objects[i]))
  }
  // Ctrl/Cmd+C y Ctrl/Cmd+V — "sumar control C control V como parte de las
  // funciones que puede realizar". El portapapeles es interno (un ref, no
  // el del sistema): copiar un objeto de Magoya no tiene sentido fuera de
  // Magoya, y así también funciona pegar entre formatos o entre slides.
  const copySelection = (idxs) => {
    const items = idxs.map((i) => objects[i]).filter(Boolean)
    if (!items.length) return
    clipboardRef.current = items.map((o) => JSON.parse(JSON.stringify(o)))
    onToast(items.length > 1 ? `Copiados ${items.length} elementos` : 'Copiado')
  }
  const pasteClipboard = () => {
    const src = clipboardRef.current
    if (!src?.length) return
    const n = clonarEnCascada(src)
    if (n) onToast(n > 1 ? `Pegados ${n} elementos` : 'Pegado')
  }

  // foto: subir → dataURL (compartido entre panel y overlay)
  const onPhotoFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return onToast('Ese archivo no es una imagen')
    // el aviso salía por PESO del archivo, que no es lo que dispara el
    // achique: una foto de 3 MB y 4000 px se achicaba en silencio
    let info = null
    const src = await compressImage(file, 2048, 0.85, (i) => { info = i })
    if (info?.achicada) onToast(`Foto achicada de ${info.deW}×${info.deH} a ${info.aW}×${info.aH} — entra igual en alta calidad`)
    const natural = await imageSize(src)
    set({ photo: { src, natural, focal: content.photo?.focal || { x: 0.5, y: 0.5 } } })
  }

  // ---- interacción directa sobre la pieza (hover / seleccionar / arrastrar) ----
  const posFromEvent = (e) => {
    const r = frameRef.current.getBoundingClientRect()
    // se permite salir un poco del borde: recortar a 0..1 no protegía de
    // nada (con el slider de tamaño el objeto igual queda medio afuera) y
    // sí impedía sangrar un elemento, que es algo que se hace todo el tiempo
    const c = (v) => Math.min(1.25, Math.max(-0.25, v))
    return { x: c((e.clientX - r.left) / r.width), y: c((e.clientY - r.top) / r.height) }
  }
  // caja aprox del objeto en % de la pieza (para el área de selección)
  const refDim = Math.min(format.w, format.h)
  const objBox = (o) => {
    let w, h
    if (o.kind === 'device') {
      const dev = ICONS_BY_ID[o.deviceId]
      w = refDim * (o.scale || 0.5); h = w / (dev?.screen?.ratio || 1)
    } else if (o.kind === 'mockup') { w = refDim * (o.scale || 0.72); h = w * (o.ratio || 0.75) }
    else if (o.kind === 'image' && o.frame) { w = refDim * (o.scale || 0.4); h = w * (o.ratio || 0.6) }
    else if (o.kind === 'shape') {
      // cada forma tiene su propia proporción; si la caja no la respeta,
      // el marco de selección no coincide con lo que se ve dibujado.
      ;({ w, h } = shapeBox(o, refDim))
    }
    else { w = refDim * (o.scale || 0.3); h = w }
    const cx = format.w * (o.x ?? 0.72), cy = format.h * (o.y ?? 0.5)
    return { left: ((cx - w / 2) / format.w) * 100, top: ((cy - h / 2) / format.h) * 100, w: (w / format.w) * 100, h: (h / format.h) * 100, rot: o.rotation || 0 }
  }
  // drop desde el picker (drag & drop) → agregar el objeto donde cayó
  const addObjectAt = async (data, pos) => {
    if (data.type === 'biblioteca') {
      const src = await fetchCompressed(data.url, OBJ_MAX)
      const natural = await imageSize(src)
      // arrastrada o tocada, es la misma foto entrando a la pieza: queda en
      // "Mis fotos" por los dos caminos, no sólo por el del click
      const el = await guardarYAvisar(onAddElement, onToast, { name: data.label, src, kind: 'photo', origin: data.slug ? 'magoya:' + data.slug : undefined })
      setObjects([...objects, { kind: 'image', src, elementId: el?.id, label: data.label, natural, ...pos, scale: 0.4, rotation: 0, shadow: false, opacity: 1 }])
      setSelObj(objects.length)
      return
    }
    if (data.type === 'element') {
      const el = elements.find((x) => x.id === data.id)
      if (!el) return
      const natural = await imageSize(el.src)
      setObjects([...objects, { kind: 'image', src: el.src, elementId: el.id, natural, ...pos, scale: 0.34, rotation: 0, shadow: true, opacity: 1 }])
      setSelObj(objects.length)
      return
    }
    const icon = ICONS_BY_ID[data.id]
    if (!icon) return
    if (icon.isShape) {
      // Acá SÍ existe `pos` (viene del drop): la forma tiene que caer donde
      // la soltaste, como cualquier otro elemento. Estaba hardcodeada al
      // centro, y llamaba a closePicker(), que no existe en este scope.
      setObjects([...objects, { kind: 'shape', shape: icon.shape, tint: 'accent', ...pos, scale: 0.34, rotation: 0, shadow: false, opacity: 1,
        ...(icon.shape === 'badge' ? { text: 'NUEVO' } : {}),
        ...(icon.shape === 'callout' ? { text: '¿Y si el dato ya lo tenías?', tint: '#FFFFFF', shadow: true } : {}),
        ...(icon.shape === 'window' ? { scale: 0.62, ratio: 0.62, shadow: true, text: 'panel.magoya.com', tint: '#FFFFFF', front: true } : {}),
        ...(icon.shape === 'panel' ? { scale: 0.34, ratio: 0.7, radius: 0.06 } : {}) }])
      setSelObj(objects.length); return
    }
    if (icon.isMockup) {
      setObjects([...objects, { kind: 'mockup', ...pos, scale: 0.72, ratio: 0.75, rotation: 0, opacity: 1, screen: { a: [0.33, 0.24], b: [0.67, 0.22], d: [0.35, 0.78] }, focal: { x: 0.5, y: 0.5 } }])
      setSelObj(objects.length); return
    }
    if (icon.isDevice) {
      setObjects([...objects, { kind: 'device', deviceId: icon.id, ...pos, scale: 0.55, rotation: 0, shadow: true, opacity: 1, focal: { x: 0.5, y: 0.5 }, zoom: 1 }])
      setSelObj(objects.length)
      return
    }
    if (icon.category === 'magoya' && !icon.isMark) {
      const src = getAsset(icon.url) || icon.url
      const natural = await imageSize(src)
      setObjects([...objects, { kind: 'image', src, natural, ...pos, scale: icon.isDevice ? 0.5 : 0.34, rotation: 0, shadow: true, opacity: 1 }])
    } else {
      const isMark = !!icon.isMark
      // mismos valores que al tocarlo: antes el drop lo creaba rotado -8° y
      // con sombra, así que el mismo ícono se veía distinto según cómo lo pusiste
      setObjects([...objects, { kind: 'icon', iconId: icon.id, style: isMark ? 'plain' : 'tile', tint: isMark ? 'accent' : undefined, ...pos, scale: icon.category === 'agro' ? 0.16 : isMark ? 0.34 : 0.3, rotation: 0, shadow: false, opacity: 1 }])
    }
    setSelObj(objects.length)
  }
  const onFrameDrop = (e) => {
    const raw = e.dataTransfer.getData('application/x-magoya')
    if (!raw) return
    e.preventDefault()
    try { addObjectAt(JSON.parse(raw), posFromEvent(e)) } catch {}
  }

  // atajos de teclado sobre el canvas (no cuando escribís en un input)
  React.useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // con un modal abierto los atajos del lienzo no tienen que responder
      if (document.querySelector('.mk-modal-ov, .chooser-ov')) return
      if (e.key === 'Escape') { setCtxMenu(null); deselectAll(); setSelText(null); setMultiSelText(new Set()); setEditing(null); return }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '0') { e.preventDefault(); setZoom(0); return }
        if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom((z) => Math.min(4, (z || fitZoom()) * 1.2)); return }
        if (e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(0.1, (z || fitZoom()) * 0.83)); return }
        // Copiar/pegar: si no hay nada que copiar o nada pegado todavía,
        // no se hace preventDefault — así el copy/paste normal del
        // navegador (por ej. texto seleccionado en un panel) sigue andando.
        // Objetos y textos son grupos aparte (ver arriba): gana el que
        // tenga algo seleccionado ahora mismo.
        if (e.key.toLowerCase() === 'c') {
          if (seleccion.length) { e.preventDefault(); copySelection(seleccion); return }
          if (textSeleccion.length) { e.preventDefault(); textCopySelection(textSeleccion); return }
        }
        if (e.key.toLowerCase() === 'v') {
          if (clipboardRef.current?.length) { e.preventDefault(); pasteClipboard(); return }
          if (textClipboardRef.current?.length) { e.preventDefault(); textPasteClipboard(); return }
        }
      }
      if (!seleccion.length && !textSeleccion.length) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (seleccion.length) objRemoveMany(seleccion)
        else textRemoveMany(textSeleccion)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (seleccion.length) objDuplicateMany(seleccion)
        else textDuplicateMany(textSeleccion)
        return
      }
      // El nudge con flechas sigue siendo sólo para objetos: un texto
      // suelto de la pieza (rol) no tiene x/y propio salvo que ya lo
      // hayas sacado del stack arrastrándolo — mezclar ambos casos en un
      // solo grupo queda para una vuelta aparte.
      if (!seleccion.length) return
      const step = e.shiftKey ? 0.05 : 0.01
      const mv = { ArrowLeft: { x: -step }, ArrowRight: { x: step }, ArrowUp: { y: -step }, ArrowDown: { y: step } }[e.key]
      if (mv) {
        e.preventDefault()
        const set = new Set(seleccion)
        setObjects(objects.map((o, idx) => (set.has(idx) ? {
          ...o,
          x: Math.min(1, Math.max(0, (o.x ?? 0.5) + (mv.x || 0))),
          y: Math.min(1, Math.max(0, (o.y ?? 0.5) + (mv.y || 0))),
        } : o)), 'nudge')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // handles de resize: arrastrás una esquina y cambia la escala
  // Resize como en Figma/Canva/Keynote: la esquina OPUESTA queda clavada y
  // la que agarrás sigue al cursor. Antes escalaba desde el centro y la
  // esquina se te escapaba de la mano. Con Alt vuelve a ser desde el centro.
  const startHandleResize = (e, i, corner) => {
    e.stopPropagation()
    e.preventDefault()
    const o = objects[i]
    if (!o) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    const fr = frameRef.current.getBoundingClientRect()
    const box = objBox(o)                       // en % de la pieza
    const cx0 = (o.x ?? 0.5), cy0 = (o.y ?? 0.5)
    const halfW = box.w / 200, halfH = box.h / 200
    // ancla = la esquina de enfrente a la que agarraste
    const ax = corner.includes('w') ? cx0 + halfW : cx0 - halfW
    const ay = corner.includes('n') ? cy0 + halfH : cy0 - halfH
    const d0 = Math.hypot(e.clientX - (fr.left + fr.width * ax), e.clientY - (fr.top + fr.height * ay)) || 1
    const s0 = o.scale || 0.3
    const move = (ev) => {
      const desdeCentro = ev.altKey
      const px = (ev.clientX - fr.left) / fr.width, py = (ev.clientY - fr.top) / fr.height
      if (desdeCentro) {
        const d = Math.hypot(ev.clientX - (fr.left + fr.width * cx0), ev.clientY - (fr.top + fr.height * cy0))
        const d0c = Math.hypot(halfW * fr.width, halfH * fr.height) || 1
        updateObject(i, { scale: clampScale(s0 * (d / d0c)) }, 'resize')
        return
      }
      const d = Math.hypot(ev.clientX - (fr.left + fr.width * ax), ev.clientY - (fr.top + fr.height * ay))
      const k = d / d0
      // el ancla no se mueve: el centro se recalcula a mitad de camino
      updateObject(i, { scale: clampScale(s0 * k), x: ax + (px - ax) / 2, y: ay + (py - ay) / 2 }, 'resize')
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // H2 · girar agarrando, que es el gesto de todos los editores. El slider
  // del panel queda como control fino.
  const startRotate = (e, i) => {
    e.stopPropagation(); e.preventDefault()
    const o = objects[i]
    if (!o) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    const fr = frameRef.current.getBoundingClientRect()
    const cx = fr.left + fr.width * (o.x ?? 0.5)
    const cy = fr.top + fr.height * (o.y ?? 0.5)
    const ang = (ev) => (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90
    const a0 = ang(e)
    const r0 = o.rotation || 0
    const move = (ev) => {
      let r = r0 + (ang(ev) - a0)
      if (ev.shiftKey) r = Math.round(r / 15) * 15
      r = ((r + 180) % 360 + 360) % 360 - 180
      updateObject(i, { rotation: Math.round(r) }, 'rotate')
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onSelectText = (eid) => { setSelText(eid); setMultiSelText(new Set()); setSelObj(null); setMultiSel(new Set()); setSelBg(false) }
  // posición libre de un bloque de texto. Arrastrar es un solo gesto, así
  // que Deshacer vuelve al lugar de antes de arrastrar, no píxel por píxel.
  const moverTexto = (eid, pt) => set({ pos: { ...(content.pos || {}), [eid]: pt } }, 'movetext:' + eid)
  const volverAlStack = (eid) => {
    const pos = { ...(content.pos || {}) }
    delete pos[eid]
    set({ pos: Object.keys(pos).length ? pos : undefined })
  }
  // ---- acciones de GRUPO sobre texto ----
  // Sólo tienen sentido sobre los bloques SUELTOS (tb:N, los que agregás
  // vos con "+ Agregar texto"). Un rol como "Título" no se puede duplicar
  // ni borrar — es parte fija de la plantilla, no un elemento que se
  // agregó. Si el grupo mezcla rol y sueltos, se actúa sobre los sueltos
  // y se avisa qué quedó afuera, en vez de fallar en silencio.
  const textBlockIdx = (eid) => (eid.startsWith('tb:') ? +eid.slice(3) : null)
  const textClipboardRef = useRef(null)
  const textRemoveMany = (eids) => {
    const idxs = eids.map(textBlockIdx).filter((i) => i != null)
    if (!idxs.length) { onToast('Esos textos son parte de la plantilla: no se pueden quitar'); return }
    const idxSet = new Set(idxs)
    set({ textBlocks: (content.textBlocks || []).filter((_, i) => !idxSet.has(i)) })
    setSelText(null); setMultiSelText(new Set())
    const saltados = eids.length - idxs.length
    onToast((idxs.length > 1 ? `Se quitaron ${idxs.length} textos` : 'Se quitó el texto') + (saltados ? ` · ${saltados} de la plantilla no se tocaron` : ''))
  }
  const textDuplicateMany = (eids) => {
    const idxs = eids.map(textBlockIdx).filter((i) => i != null)
    if (!idxs.length) { onToast('Esos textos son parte de la plantilla: no se pueden duplicar'); return }
    const blocks = content.textBlocks || []
    const nuevos = idxs.map((i) => ({ ...blocks[i] }))
    const base = blocks.length
    set({ textBlocks: [...blocks, ...nuevos] })
    setSelText('tb:' + base)
    setMultiSelText(new Set(nuevos.slice(1).map((_, k) => 'tb:' + (base + 1 + k))))
  }
  const textCopySelection = (eids) => {
    const idxs = eids.map(textBlockIdx).filter((i) => i != null)
    if (!idxs.length) { onToast('Esos textos son parte de la plantilla: no se pueden copiar'); return }
    const blocks = content.textBlocks || []
    textClipboardRef.current = idxs.map((i) => ({ ...blocks[i] }))
    onToast(idxs.length > 1 ? `Copiados ${idxs.length} textos` : 'Copiado')
  }
  const textPasteClipboard = () => {
    const src = textClipboardRef.current
    if (!src?.length) return
    const blocks = content.textBlocks || []
    const base = blocks.length
    set({ textBlocks: [...blocks, ...src.map((b) => ({ ...b }))] })
    setSelText('tb:' + base)
    setMultiSelText(new Set(src.slice(1).map((_, k) => 'tb:' + (base + 1 + k))))
    onToast(src.length > 1 ? `Pegados ${src.length} textos` : 'Pegado')
  }
  const [guides, setGuides] = useState({ v: false, h: false })
  // Un texto seleccionado no se veía seleccionado EN LA PIEZA: cambiaba el
  // panel de la derecha y en el lienzo no pasaba nada, así que no sabías si
  // le habías pegado al título o al subtítulo.
  const [ctxMenu, setCtxMenu] = useState(null)   // menú de click derecho
  // Una caja por cada texto seleccionado — antes era una sola (`textBox`),
  // alcanzaba porque sólo se podía seleccionar uno.
  const [textBoxes, setTextBoxes] = useState([])
  useEffect(() => {
    if (!textSeleccion.length || !frameRef.current) { setTextBoxes([]); return }
    const fr = frameRef.current.getBoundingClientRect()
    const pad = 6
    const cajas = textSeleccion.map((eid) => {
      const t = frameRef.current.querySelector(`text[data-eid="${CSS.escape(eid)}"]`)
      if (!t) return null
      const r = t.getBoundingClientRect()
      return {
        eid, primaria: eid === selText,
        left: r.left - fr.left - pad, top: r.top - fr.top - pad,
        width: r.width + pad * 2, height: r.height + pad * 2,
      }
    }).filter(Boolean)
    setTextBoxes(cajas)
  }, [textSeleccion, selText, content, format.id, panelW.left, panelW.right, zoom])
  const startDrag = (e, i) => {
    e.stopPropagation()
    // Alt+click cicla hacia lo que está DEBAJO: si dos objetos se pisan,
    // sin esto sólo se puede agarrar el de arriba.
    let idx = i
    if (e.altKey) {
      const r = frameRef.current.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
      const bajo = objects.map((o, k) => [k, objBox(o)])
        .filter(([, b]) => px * 100 >= b.left && px * 100 <= b.left + b.w && py * 100 >= b.top && py * 100 <= b.top + b.h)
        .map(([k]) => k)
      if (bajo.length > 1) {
        const pos = bajo.indexOf(selObj)
        idx = bajo[(pos + bajo.length - 1) % bajo.length]   // el siguiente hacia abajo
      }
    }
    // Shift+click arma o achica el grupo — nunca arrastra en el mismo
    // gesto, para no mover algo sin querer mientras estás eligiendo.
    if (e.shiftKey) { toggleMultiSel(idx); return }
    // Un click normal sobre algo que YA es parte del grupo arrastra el
    // GRUPO entero (como Figma/Canva); si es algo nuevo, lo aísla —
    // exactamente el comportamiento de antes cuando no había grupo.
    const yaEnGrupo = selObj === idx || multiSel.has(idx)
    if (!yaEnGrupo) { setSelObj(idx); setMultiSel(new Set()) }
    setSelText(null); setMultiSelText(new Set()); setSelBg(false)
    dragRef.current.i = idx
    const grupo = yaEnGrupo ? seleccion : [idx]
    dragRef.current.group = grupo.length > 1
      ? { start: posFromEvent(e), orig: new Map(grupo.map((k) => [k, { x: objects[k]?.x ?? 0.5, y: objects[k]?.y ?? 0.5 }])) }
      : null
    // sin capturar el puntero, arrastrar rápido hacia el borde soltaba el
    // objeto a mitad de camino (en cualquier editor podés salir y volver)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }
  const onFrameMove = (e) => {
    // Arrastrar un texto lo saca del stack y lo deja donde lo soltás.
    // "el CTA está acá abajo y yo lo quería acá arriba, pero no me
    // dejaba" — antes esto sólo mostraba un aviso de que no se podía.
    const td = textDragRef.current
    if (td) {
      const d = Math.hypot(e.clientX - td.x, e.clientY - td.y)
      if (d > 6 || td.moved) {
        td.moved = true
        const g = posFromEvent(e)
        let x = g.x - td.dx, y = g.y - td.dy
        const snapV = Math.abs(x + td.wRel / 2 - 0.5) < 0.02
        if (snapV) x = 0.5 - td.wRel / 2
        setGuides({ v: snapV, h: false })
        moverTexto(td.eid, { x, y })
        return
      }
    }
    if (dragRef.current.i == null) return
    let pos = posFromEvent(e)
    // snapping al centro (guías)
    const snapV = Math.abs(pos.x - 0.5) < 0.02
    const snapH = Math.abs(pos.y - 0.5) < 0.02
    if (snapV) pos.x = 0.5
    if (snapH) pos.y = 0.5
    setGuides({ v: snapV, h: snapH })
    const grp = dragRef.current.group
    if (grp) {
      // grupo: se mueve por DELTA desde donde arrancó cada uno, no a la
      // posición absoluta del cursor (eso los hubiera apilado a todos en
      // el mismo punto).
      const dx = pos.x - grp.start.x, dy = pos.y - grp.start.y
      setObjects(objects.map((o, idx) => {
        const base = grp.orig.get(idx)
        if (!base) return o
        return { ...o, x: Math.min(1, Math.max(0, base.x + dx)), y: Math.min(1, Math.max(0, base.y + dy)) }
      }), 'drag')
    } else {
      updateObject(dragRef.current.i, pos, 'drag')
    }
  }
  const endDrag = () => { dragRef.current.i = null; dragRef.current.group = null; textDragRef.current = null; setGuides({ v: false, h: false }) }
  const onFrameDown = (e) => {
    const t = e.target.closest && e.target.closest('text[data-eid]')
    if (t) {
      const eid = t.getAttribute('data-eid')
      // Shift+click arma el grupo de textos — igual que en los objetos,
      // nunca arrastra ni edita en el mismo gesto.
      if (e.shiftKey) { toggleMultiSelText(eid); return }
      // segundo tap/click sobre el texto ya seleccionado → editar (touch-friendly).
      // Si era parte de un grupo, el primer click sólo lo aísla — evita
      // que un click para "soltar el grupo" te mande derecho a editar.
      if (selText === eid && !multiSelText.size) { openTextEditor(t) }
      else { setSelText(eid); setMultiSelText(new Set()); setSelObj(null); setMultiSel(new Set()); setSelBg(false) }
      // el primer reflejo de cualquiera es arrastrar el texto. Se guarda
      // dónde lo agarraste DENTRO del bloque para que no salte al soltar.
      const fr = frameRef.current.getBoundingClientRect()
      const r = t.getBoundingClientRect()
      const g = posFromEvent(e)
      textDragRef.current = {
        x: e.clientX, y: e.clientY, eid, moved: false,
        dx: g.x - (r.left - fr.left) / fr.width,
        dy: g.y - (r.top - fr.top) / fr.height,
        wRel: r.width / fr.width,
      }
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
      return
    }
    // cualquier click que no caiga sobre un objeto o un texto DESELECCIONA:
    // sin esto nunca se ve la pieza limpia, siempre queda un marco encima.
    setCtxMenu(null)
    if (!e.target.closest('.obj-hit') && !e.target.closest('.rs-handle')) { setSelObj(null); setMultiSel(new Set()); setSelText(null); setMultiSelText(new Set()); setSelBg(false) }
  }
  const onStageDown = (e) => {
    if (e.target.closest('.piece-frame') || e.target.closest('.stage-tools') || e.target.closest('.strip')) return
    setSelObj(null); setMultiSel(new Set()); setSelText(null); setMultiSelText(new Set()); setSelBg(false); setEditing(null)
  }

  // ---- editar texto tocándolo sobre la pieza ----
  // Los pasos numerados (plantilla "Método") se podían SELECCIONAR en la
  // pieza pero no leer ni escribir: el editor abría vacío y lo que
  // tipeabas no iba a ningún lado. Sólo se podían editar desde el panel.
  const pasos = () => content.steps || template.defaults?.steps || []
  const getText = (eid) => {
    if (eid.startsWith('role:')) { const k = eid.slice(5); return content[k] ?? template.defaults?.[k] ?? '' }
    if (eid.startsWith('tb:')) { const i = +eid.slice(3); return (content.textBlocks || [])[i]?.text ?? '' }
    if (eid.startsWith('step:')) { const i = +eid.slice(5); return pasos()[i] ?? '' }
    return ''
  }
  const setText = (eid, val) => {
    // escribir es un gesto: una palabra entera es un solo Deshacer
    if (eid.startsWith('role:')) set({ [eid.slice(5)]: val }, 'txt:' + eid)
    else if (eid.startsWith('tb:')) { const i = +eid.slice(3); set({ textBlocks: (content.textBlocks || []).map((b, idx) => (idx === i ? { ...b, text: val } : b)) }, 'txt:' + eid) }
    else if (eid.startsWith('step:')) { const i = +eid.slice(5); set({ steps: pasos().map((s, idx) => (idx === i ? val : s)) }, 'txt:' + eid) }
  }
  const openTextEditor = (t) => {
    const eid = t.getAttribute('data-eid')
    const fr = frameRef.current.getBoundingClientRect()
    const r = t.getBoundingClientRect()
    const scale = fr.width / format.w
    const fontPx = parseFloat(getComputedStyle(t).fontSize) * scale || 18
    setEditing({
      eid, value: getText(eid), original: getText(eid),
      left: r.left - fr.left, top: r.top - fr.top,
      width: Math.max(r.width + fontPx, 90), fontPx,
      align: (t.getAttribute('text-anchor') === 'middle') ? 'center' : 'left',
    })
  }
  const onFrameDblClick = (e) => {
    const t = e.target.closest && e.target.closest('text[data-eid]')
    if (t) openTextEditor(t)
  }

  // Cambiar de slide (o de diseño) con algo seleccionado hacía que el
  // inspector editara el objeto del MISMO índice en la slide nueva.
  useEffect(() => { setSelObj(null); setMultiSel(new Set()); setSelText(null); setMultiSelText(new Set()); setSelBg(false); setEditing(null) }, [activeSlide, template.id])

  // sólo reclama la foto si la pieza HOY es de foto: si sacaste la foto de
  // fondo a propósito (bg: 'color') no tiene que seguir pidiéndola
  // ¿lo que hay DETRÁS es una foto? Es el fondo efectivo, no lo que trae la
  // plantilla: `bg` manda desde que cualquier plantilla acepta foto.
  const hayFotoDetras = (content.bg || (template.surface === 'photo' || template.defaults?.hasPhoto ? 'photo' : 'color')) === 'photo'
  const needsPhoto = template.surface === 'photo' && (content.bg || 'photo') !== 'color' && !content.photo?.src
  // Bloque B — variantes: misma plantilla, otra composición
  const variants = React.useMemo(() => variantsFor(template), [template])
  const activeVar = activeVariantId(template, content)
  // si la plantilla no tiene variantes (chat), el panel no existe

  return (
    <div className={'editor' + (selObj != null || selText ? ' has-sel' : '') + (sheet ? ' sheet-open' : '') + (seleccion.length > 1 || textSeleccion.length > 1 ? ' multi-sel' : '')}>
      <nav className="insert-rail">
        {/* El rail se reparte por POSICION, no por material. Antes había
            "Fotos" y "Fondo" como dos entradas distintas, y una foto podía
            ir de fondo o encima: había que aprender la distinción para
            saber a cuál entrar. Facu: "lo que confunde es que foto sea
            fondo y los fondos también es fondo".
            Ahora la pregunta es la que la cabeza ya se hace mirando la
            pieza: ¿esto va DETRÁS o ENCIMA? */}
        {[
          ['style', 'grid', 'Estilo'],
          ['text', 'text', 'Texto'],
          ['settings', 'layers', 'Detrás'],
          ['elements', 'sparkle', 'Encima'],
          ['brand', 'brand', 'Marca'],
        ].map(([k, ico, label]) => (
          <button key={k} className={'rail-btn' + (panel === k ? ' on' : '')}
            onClick={() => { if (panel === k) setSheet((v) => !v); else { setPanel(k); setSheet(true) } }} title={label}>
            <span className="rail-ico"><Icon n={ico} size={21} /></span>
            <span className="rail-label">{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar" style={{ width: panelW.left }}>
        <button className="sheet-close" onClick={() => setSheet(false)} aria-label="Cerrar panel"><Icon n="down" size={18} /></button>
        {/* la tarjeta negra con nombre + propósito + formato era redundante:
            el formato ya está en la barra del lienzo y el nombre en el breadcrumb.
            Queda una línea silenciosa, y el espacio se lo lleva el panel. */}
        <div className="side-head">
          <span className="sh-name" title={template.purpose}>{template.name}</span>
        </div>

        {panel === 'style' && (
          <>
            <div className="panel-title">Estilo de la pieza</div>
            <p className="panel-help">La misma pieza, compuesta distinto. Cambia el diseño — nunca tus textos, tu foto ni los elementos que sumaste.</p>
            {variants.length
              ? <VariantsBody template={template} content={content} format={format} variants={variants} active={activeVar} set={set} />
              : <div className="hint">Esta plantilla no tiene variantes de composición: el chat se arma con los mensajes.</div>}
          </>
        )}

        {panel === 'text' && (
          template.category === 'chat' ? (
            <>
              <div className="panel-title">Chat</div>
              <div className="field"><label>Nombre</label><input type="text" value={content.chatName ?? template.defaults?.chatName ?? 'Magoya'} onChange={(e) => set({ chatName: e.target.value })} /></div>
              <div className="field"><label>Estado</label><input type="text" value={content.chatStatus ?? template.defaults?.chatStatus ?? 'en línea'} onChange={(e) => set({ chatStatus: e.target.value })} /></div>
              <div className="panel-title">Mensajes</div>
              <ChatBody content={content} template={template} set={set} />
            </>
          ) : template.freeform ? (
            <>
              <div className="panel-title">Textos</div>
              <p className="panel-help">Sumá textos y tocalos para ajustarlos a la derecha.</p>
              <TextBlocksBody content={content} set={set} onSelectText={onSelectText} selText={selText} multiSelText={multiSelText} toggleMultiSelText={toggleMultiSelText} />
              <div className="panel-title" style={{ marginTop: 16 }}>Posición del bloque</div>
              <AnchorBody content={content} template={template} set={set} />
            </>
          ) : (
            <>
              <div className="panel-title">Textos</div>
              <p className="panel-help">Tocá un texto (acá o en la pieza) para editarlo a la derecha.</p>
              <ContentBody template={template} content={content} onSelectText={onSelectText} selText={selText} multiSelText={multiSelText} toggleMultiSelText={toggleMultiSelText} />
              {(content.steps || template.defaults?.steps) && (
                <>
                  <div className="panel-title" style={{ marginTop: 16 }}>Pasos</div>
                  <StepsBody content={content} template={template} set={set} />
                </>
              )}
              {/* Sumar una línea suelta se podía sólo en las piezas libres:
                  en una cita o en un titular no había forma, y no hay razón
                  — el motor dibuja los bloques igual en cualquier plantilla.
                  "quiero agregar un texto y moverlo" (Aye). */}
              <div className="panel-title" style={{ marginTop: 16 }}>Textos sueltos</div>
              <p className="panel-help">Los que sumás vos. Arrastralos en la pieza para ubicarlos donde quieras.</p>
              <TextBlocksBody content={content} set={set} onSelectText={onSelectText} selText={selText} multiSelText={multiSelText} toggleMultiSelText={toggleMultiSelText} />
            </>
          )
        )}

        {panel === 'elements' && (
          <>
            <div className="panel-title">Encima de la pieza</div>
            <p className="panel-help">Todo lo que se apoya arriba: logos, trazos, formas, dispositivos y fotos sueltas.</p>
            <ObjectsBody objects={objects} setObjects={setObjects}
              // envuelto: elegir un objeto de a uno (fila, biblioteca, foto
              // nueva) suelta cualquier grupo que hubiera quedado armado
              selObj={selObj} setSelObj={(i) => { setSelObj(i); setMultiSel(new Set()) }}
              multiSel={multiSel} toggleMultiSel={toggleMultiSel} objRemove={objRemove} onToast={onToast}
              elements={elements} onAddElement={onAddElement} onDeleteElement={onDeleteElement}
              alwaysOpen />
            <div className="panel-title" style={{ marginTop: 18 }}>Una foto encima</div>
            <FotosBody destinoFijo="encima" content={content} template={template} set={set}
              inputRef={photoInputRef}
              objects={objects} setObjects={setObjects} setSelObj={setSelObj}
              elements={elements} onAddElement={onAddElement} onDeleteElement={onDeleteElement} onToast={onToast} />
          </>
        )}

        {panel === 'brand' && (
          <>
            <div className="panel-title">Marca</div>
            <BrandBody content={content} template={template} set={set} soloLogo={template.freeform && (content.bg || 'color') === 'photo'} />
          </>
        )}

        {panel === 'settings' && (
          <>
            {/* DETRÁS es dueño de todo lo que está atrás de la pieza. Primero
                la única decisión que importa —color o foto—, después lo que
                corresponda. Los ajustes de la foto viven en el inspector de
                la derecha, como los de cualquier otra cosa. */}
            <div className="chips" style={{ marginBottom: 14 }}>
              <button className={'chip' + (!hayFotoDetras ? ' on' : '')}
                onClick={() => set({ bg: 'color' })}>Un color</button>
              <button className={'chip' + (hayFotoDetras ? ' on' : '')}
                onClick={() => { if (content.photo?.src) set({ bg: 'photo' }) }}
                title={content.photo?.src ? 'Volver a la foto' : 'Elegí una foto abajo'}>Una foto</button>
            </div>
            {hayFotoDetras ? (
              <FotosBody destinoFijo="fondo" selBg={selBg}
                onSelectBg={() => { setSelBg(true); setSelObj(null); setMultiSel(new Set()); setSelText(null); setMultiSelText(new Set()) }}
                content={content} template={template} set={set}
                inputRef={photoInputRef}
                objects={objects} setObjects={setObjects} setSelObj={setSelObj}
                elements={elements} onAddElement={onAddElement} onDeleteElement={onDeleteElement} onToast={onToast} />
            ) : (
              <>
                <div className="panel-title">Color</div>
                <FondoBody content={content} template={template} set={set} />
                <div className="panel-title" style={{ marginTop: 18 }}>Una foto detrás</div>
                <FotosBody destinoFijo="fondo" content={content} template={template} set={set}
                  inputRef={photoInputRef}
                  objects={objects} setObjects={setObjects} setSelObj={setSelObj}
                  elements={elements} onAddElement={onAddElement} onDeleteElement={onDeleteElement} onToast={onToast} />
              </>
            )}
            <div className="panel-title" style={{ marginTop: 18 }}>Tono encima</div>
            <p className="panel-help">Un velo de color sobre lo que hay detrás, para dar profundidad.</p>
            <GradientBody content={content} set={set} />
            <Ctl label="Oscurecer los bordes" value={Math.round((content.vignette ?? 0) * 100)} min={0} max={80} onChange={(v) => set({ vignette: v / 100 })} />
          </>
        )}
      </div>

      <div className="col-resize" onPointerDown={(e) => startResize('left', e)} title="Arrastrá para ajustar el panel" />

      <div className="stage">
        <div className="stage-tools">
          {/* era texto muerto y es el lugar donde todos hacen click */}
          <FormatPicker format={format} onChangeFormat={onChangeFormat} />
          {onUndo && (
            <span className="undo-group">
              <button className="btn icon-btn" onClick={onUndo} disabled={!canUndo} title="Deshacer (⌘Z)"><Icon n="undo" size={16} /></button>
              <button className="btn icon-btn" onClick={onRedo} disabled={!canRedo} title="Rehacer (⇧⌘Z)"><Icon n="redo" size={16} /></button>
            </span>
          )}
          <ZoomCtl zoom={zoom} setZoom={setZoom} fit={fitZoom} />
          <label className="safe-toggle"><input type="checkbox" checked={showSafe} onChange={(e) => setShowSafe(e.target.checked)} /> Ver zona segura</label>
          <div style={{ flex: 1 }} />
          {canCarousel && !isCarousel && <button className="btn" onClick={onConvertToCarousel}>+ Convertir en carrusel</button>}
          {carruselIncompatible && (
            <span className="warn-pill" title="Instagram y LinkedIn aceptan carrusel en cuadrado y 4:5">
              Este tamaño no admite carrusel: se publica sólo la slide 1
            </span>
          )}
          {isCarousel && (
            <span className="mode-pill"><Icon n="grid" size={14} /> Carrusel · {slides.length} {slides.length === 1 ? 'slide' : 'slides'}
              {slides.length === 1 && onBackToSingle && <button className="linklike" onClick={onBackToSingle}>Volver a pieza simple</button>}
            </span>
          )}
          <button className="btn" onClick={() => setMockupOpen(true)}><Icon n="eye" size={16} /> Ver en mockup</button>
          <button className="btn" onClick={() => setShareOpen(true)}><Icon n="share" size={16} /> Compartir</button>
          <MoreMenu onSaveTemplate={onSaveTemplate} onExportFile={onExportFile} />
          <DownloadMenu template={template} content={content} format={format} slides={slides} sizeLock={sizeLock} busy={busy} setBusy={setBusy} onToast={onToast} />
        </div>

        <div className="stage-canvas" onPointerDown={onStageDown} ref={stageRef}
          onWheel={(e) => {
            if (!(e.ctrlKey || e.metaKey)) return   // ⌘/ctrl + rueda, como en todos lados
            e.preventDefault()
            setZoom((z) => {
              const base = z || fitZoom()
              return Math.min(4, Math.max(0.1, base * (e.deltaY > 0 ? 0.9 : 1.1)))
            })
          }}>
          <div
            className={'piece-frame' + (selObj != null ? ' dragging-ready' : '') + (zoom ? ' zoomed' : '')}
            style={zoom ? { width: format.w * zoom, height: format.h * zoom } : undefined}
            ref={frameRef}
            onPointerDown={onFrameDown}
            onPointerMove={onFrameMove}
            onPointerUp={endDrag}
            onDoubleClick={onFrameDblClick}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onFrameDrop}
            onContextMenu={(e) => {
              const hit = e.target.closest && e.target.closest('.obj-hit')
              if (!hit) return
              e.preventDefault()
              const fr = frameRef.current.getBoundingClientRect()
              setCtxMenu({ x: e.clientX - fr.left, y: e.clientY - fr.top })
            }}
          >
            <PiecePreview template={template} content={content} format={format} sizeLock={sizeLock} />
            {editing && (
              <textarea
                className="inline-edit"
                autoFocus
                value={editing.value}
                style={{ left: editing.left + 'px', top: editing.top + 'px', width: editing.width + 'px', fontSize: editing.fontPx + 'px', textAlign: editing.align }}
                onChange={(e) => { setEditing({ ...editing, value: e.target.value }); setText(editing.eid, e.target.value) }}
                onBlur={() => setEditing(null)}
                onKeyDown={(e) => {
                  // Escape = "dejalo como estaba", en todos lados. Antes
                  // sólo cerraba el cuadro: el texto ya había cambiado.
                  if (e.key === 'Escape') { e.preventDefault(); setText(editing.eid, editing.original); setEditing(null); return }
                  // Enter hace salto de línea (igual que en el panel);
                  // se cierra con ⌘Enter o tocando afuera.
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setEditing(null) }
                }}
              />
            )}
            {/* áreas de selección/arrastre de objetos (hover marca, click selecciona) */}
            {objects.map((o, i) => {
              const bx = objBox(o)
              return (
                <div key={i}
                  className={'obj-hit' + (selObj === i ? ' sel' : multiSel.has(i) ? ' sel-extra' : '') + (hoverObj === i ? ' hover' : '')}
                  style={{ left: bx.left + '%', top: bx.top + '%', width: bx.w + '%', height: bx.h + '%', transform: `rotate(${bx.rot}deg)` }}
                  onMouseEnter={() => setHoverObj(i)} onMouseLeave={() => setHoverObj(null)}
                  onPointerDown={(e) => startDrag(e, i)}>
                  {selObj === i && ['nw', 'ne', 'sw', 'se'].map((c) => (
                    <span key={c} className={'rs-handle ' + c} role="button" tabIndex={-1}
                      aria-label={{ nw: 'Redimensionar desde arriba a la izquierda', ne: 'Redimensionar desde arriba a la derecha', sw: 'Redimensionar desde abajo a la izquierda', se: 'Redimensionar desde abajo a la derecha' }[c]}
                      onPointerDown={(e) => startHandleResize(e, i, c)} />
                  ))}
                  {selObj === i && (
                    <span className="rot-handle" title="Girar · con Shift salta de 15 en 15"
                      onPointerDown={(e) => startRotate(e, i)}><Icon n="rotate" size={13} /></span>
                  )}
                </div>
              )
            })}
            {ctxMenu && selObj != null && (
              <div className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}
                onPointerDown={(e) => e.stopPropagation()}>
                {seleccion.length > 1 && (
                  <button onClick={() => { copySelection(seleccion); setCtxMenu(null) }}><Icon n="copy" size={14} /> Copiar {seleccion.length}</button>
                )}
                <button onClick={() => { seleccion.length > 1 ? objDuplicateMany(seleccion) : objDuplicate(selObj); setCtxMenu(null) }}>
                  <Icon n="copy" size={14} /> Duplicar{seleccion.length > 1 ? ` ${seleccion.length}` : ''}
                </button>
                {seleccion.length <= 1 && (<>
                  <button onClick={() => { objBringFront(selObj); setCtxMenu(null) }}><Icon n="up" size={14} /> Subir</button>
                  <button onClick={() => { objSendBack(selObj); setCtxMenu(null) }}><Icon n="down" size={14} /> Bajar</button>
                </>)}
                <button className="del" onClick={() => { seleccion.length > 1 ? objRemoveMany(seleccion) : objRemove(selObj); setCtxMenu(null) }}>
                  <Icon n="close" size={14} /> Quitar{seleccion.length > 1 ? ` ${seleccion.length}` : ''}
                </button>
              </div>
            )}
            {textBoxes.map((b) => (
              <div key={b.eid} className={'text-sel' + (b.primaria ? '' : ' extra')}
                style={{ left: b.left, top: b.top, width: b.width, height: b.height }} />
            ))}
            {guides.v && <div className="guide-v" />}
            {guides.h && <div className="guide-h" />}
            {showSafe && (
              <div className="safe-ov" style={{
                top: `${format.safe.top * 100}%`, bottom: `${format.safe.bottom * 100}%`,
                left: `${format.safe.left * 100}%`, right: `${format.safe.right * 100}%`,
              }} />
            )}
            {needsPhoto && (
              // Si ya hay algo puesto en la pieza, el cartel grande estorba
              // (tapa justo lo que acabás de colocar): pasa a ser un chip.
              // Y lleva al panel Fondo, que es donde vive la foto de FONDO
              // — no al file picker, así también podés usar la biblioteca.
              <button className={'photo-cta' + (objects.length ? ' mini' : '')}
                onClick={() => { setPanel('photos'); setSheet(true) }}>
                <span className="pc-ic"><Icon n="plus" size={objects.length ? 14 : 20} /></span>
                <span>{objects.length ? 'Falta la foto de fondo' : 'Elegí la foto de fondo para empezar'}</span>
              </button>
            )}
            {seleccion.length > 1 ? (
              // "El shift no me muestra que seleccioné más de un objeto" —
              // el panel derecho SÍ decía "2 elementos seleccionados", pero
              // ahí no es donde mirás mientras trabajás en el lienzo. Con
              // un objeto chico (un destello, un ícono) el contorno
              // punteado del segundo también pasaba desapercibido. Este
              // aviso vive en el mismo lugar donde ya confiás que algo se
              // seleccionó — el cartel de "Arrastrá para ubicar".
              <div className="drag-hint group-hint">{seleccion.length} elementos seleccionados</div>
            ) : textSeleccion.length > 1 ? (
              // Mismo cartel, mismo motivo: shift+click en un segundo texto
              // tampoco se notaba en el lienzo.
              <div className="drag-hint group-hint">{textSeleccion.length} textos seleccionados</div>
            ) : selObj != null && objects[selObj] && (
              <div className="drag-hint">Arrastrá para ubicar el objeto</div>
            )}
            {selObj == null && selText && !multiSelText.size && (
              <div className="drag-hint">Arrastrá para moverlo · doble clic para escribir</div>
            )}
          </div>
        </div>

        {isCarousel && (
          <div className="strip">
            {slides.map((s, i) => (
              <button key={i} className={'slide-thumb' + (i === activeSlide ? ' on' : '') + (dragSlide === i ? ' dragging' : '')}
                onClick={() => onSelectSlide(i)} title={`Slide ${i + 1} — arrastrá para reordenar`}
                draggable onDragStart={() => setDragSlide(i)} onDragEnd={() => setDragSlide(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (dragSlide != null && dragSlide !== i && onReorderSlides) onReorderSlides(dragSlide, i); setDragSlide(null) }}>
                <PiecePreview template={s.template} content={s.content} format={format} sizeLock={sizeLock} />
                <span className="sn">{i + 1}</span>
              </button>
            ))}
            <button className="add" onClick={() => onAddSlide()} title="Slide en blanco, para componer con bloques">+</button>
            {/* "desde plantilla y cambiar diseño no se entiende": una fila
                agrega slides, la otra actúa sobre la slide en la que estás */}
            <span className="strip-group">
              <button className="btn" onClick={() => setChooser('add')} title="Elegís un diseño y se suma como slide nueva">Sumar slide…</button>
              {onDuplicateSlide && <button className="btn" onClick={onDuplicateSlide} title="Copia esta slide con todo: sirve para continuar la historia"><Icon n="copy" size={15} /> Duplicar</button>}
            </span>
            <span className="strip-group">
              <button className="btn" onClick={() => setChooser('change')} title="Otro diseño para esta misma slide. El texto que escribiste se conserva.">Cambiar el diseño…</button>
              {slides.length > 1 && onApplyDesignToAll && (
                <button className="btn" onClick={onApplyDesignToAll}
                  title="Le pasa el diseño de esta slide a todas las demás, sin tocarles el texto. Para que el carrusel combine.">Usar en todas</button>
              )}
            </span>
            <label className="safe-toggle" title="Que el título y el texto midan igual en todas las slides, aunque una tenga más letras">
              <input type="checkbox" checked={mismoTamano} onChange={(e) => set({ mismoTamano: e.target.checked })} /> Mismo tamaño de texto
            </label>
            {slides.length > 1 && <button className="btn" onClick={() => onDeleteSlide(activeSlide)}>Borrar slide</button>}
          </div>
        )}

        {chooser && (
          <ModalOverlay onClose={() => setChooser(null)} clase="chooser" overlay="chooser-ov" etiqueta="Elegir diseño">
              <div className="chooser-head">
                <strong>{chooser === 'add' ? 'Elegí el diseño de la nueva slide' : 'Cambiá el diseño de esta slide'}</strong>
                <button className="btn" onClick={() => setChooser(null)}>Cerrar</button>
              </div>
              <div className="chooser-grid">
                {templates.filter((t) => !t.hidden).map((t) => (
                  <button key={t.id} className="tcard" onClick={() => { chooser === 'add' ? onAddSlide(t) : onChangeSlideTemplate(t); setChooser(null) }}>
                    <div className="thumb fixed"><PiecePreview template={t} content={t.defaults} format={format} /></div>
                    <div className="meta"><div className="n">{t.name}</div><div className="purpose">{t.purpose}</div></div>
                  </button>
                ))}
              </div>
          </ModalOverlay>
        )}
      </div>

      {shareOpen && (
        <ShareModal onClose={() => setShareOpen(false)} onShare={onShare} onShareReview={onShareReview}
          onExportFile={onExportFile} mockup={mockup} setMockup={setMockup} />
      )}

      {mockupOpen && (
        <ModalOverlay onClose={() => setMockupOpen(false)} clase="mk-modal" etiqueta="Ver en mockup">
            <div className="mk-modal-head">
              <div className="mk-tabs">
                {(mockupsPara(format).length ? mockupsPara(format) : MOCKUPS).map((m) => (
                  <button key={m.k} className={mockup === m.k ? 'on' : ''} onClick={() => setMockup(m.k)}>{m.label}</button>
                ))}
                {!mockupsPara(format).length && (
                  <span className="mk-nota">{format.label} no es una medida de estas redes — se ve aproximado.</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {mockup === 'phone' && (
                  <label className="dk-toggle" title="Marca lo que tapan el header y la barra de respuesta de la app">
                    <input type="checkbox" checked={mkSafe} onChange={(e) => setMkSafe(e.target.checked)} /> Ver qué tapa la app
                  </label>
                )}
                <label className="dk-toggle"><input type="checkbox" checked={mkDark} onChange={(e) => setMkDark(e.target.checked)} /> Modo oscuro</label>
                <button className="btn" onClick={() => { setMockupOpen(false); setShareOpen(true) }}><Icon n="share" size={15} /> Compartir</button>
                <button className="btn" onClick={() => setMockupOpen(false)}>Cerrar</button>
              </div>
            </div>
            <div className="mk-stage"><MockupPreview template={template} content={content} format={format} mockup={mockup} dark={mkDark} safeZones={mkSafe} slides={slides} sizeLock={sizeLock} /></div>
        </ModalOverlay>
      )}

      <div className="col-resize" onPointerDown={(e) => startResize('right', e)} title="Arrastrá para ajustar el panel" />

      <aside className="inspector" style={{ width: panelW.right }}>
        <button className="sheet-close" onClick={() => { setSelObj(null); setMultiSel(new Set()); setSelText(null); setMultiSelText(new Set()) }} aria-label="Cerrar propiedades"><Icon n="down" size={18} /></button>
        {seleccion.length > 1 ? (
          <MultiSelProps count={seleccion.length}
            onCopy={() => copySelection(seleccion)}
            onDuplicate={() => objDuplicateMany(seleccion)}
            onRemove={() => objRemoveMany(seleccion)} />
        ) : textSeleccion.length > 1 ? (
          <MultiSelProps count={textSeleccion.length} kind="textos"
            onCopy={() => textCopySelection(textSeleccion)}
            onDuplicate={() => textDuplicateMany(textSeleccion)}
            onRemove={() => textRemoveMany(textSeleccion)} />
        ) : selObj != null && objects[selObj] ? (
          <>
            <div className="insp-kicker">Propiedades del elemento</div>
            <ObjectProps o={objects[selObj]} i={selObj} updateObject={updateObject} objRemove={objRemove} objDuplicate={objDuplicate} objBringFront={objBringFront} objSendBack={objSendBack} onToast={onToast}
              onAddElement={onAddElement}
              goToBg={() => { setSelObj(null); setMultiSel(new Set()); setPanel('photos'); setSheet(true) }} />
          </>
        ) : selText ? (
          <>
            <div className="insp-kicker">Propiedades del texto</div>
            <TextProps eid={selText} template={template} content={content} set={set} getText={getText} setText={setText} onVolverAlStack={volverAlStack} />
          </>
        ) : selBg && content.photo?.src ? (
          <>
            <div className="insp-kicker">Propiedades de la foto</div>
            <FondoProps content={content} set={set} onToast={onToast} onAddElement={onAddElement} />
          </>
        ) : (
          <div className="insp-empty">
            <div className="insp-empty-ic"><Icon n="cursor" size={22} /></div>
            Tocá un elemento o un texto en la pieza para editar sus propiedades acá.
            <span className="insp-empty-sub">Doble-click en un texto para escribir directo.</span>
          </div>
        )}
      </aside>
    </div>
  )
}

/* ---------------- Format ---------------- */
function FormatBody({ format, onChangeFormat }) {
  const groups = formatsByNetwork()
  return (
    <div className="field">
      <select value={format.id} onChange={(e) => onChangeFormat(FORMATS_BY_ID[e.target.value])}>
        {Object.entries(groups).map(([net, list]) => (
          <optgroup key={net} label={net}>
            {list.map((f) => (
              <option key={f.id} value={f.id}>{f.label} — {f.w}×{f.h}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

/* ---------------- Content: lista de textos (selecciona → edita a la derecha) ---------------- */
function ContentBody({ template, content, onSelectText, selText, multiSelText, toggleMultiSelText }) {
  const roles = template.roles || []
  return (
    <>
      <div className="obj-list">
        {roles.map((role) => {
          const eid = `role:${role}`
          const val = content[role] ?? template.defaults?.[role] ?? ''
          return (
            <button key={role} className={'obj-row txt-row' + (selText === eid ? ' sel' : multiSelText?.has(eid) ? ' sel-extra' : '')}
              onClick={(e) => (e.shiftKey && toggleMultiSelText ? toggleMultiSelText(eid) : onSelectText(eid))}>
              <span className="row-role">{ROLE_LABELS[role] || role}</span>
              <span className="row-preview">{String(val).trim() || '—'}</span>
            </button>
          )
        })}
      </div>
      <CopySummary content={content} />
      <div className="hint">Tocá un texto (acá o en la pieza) → lo editás a la derecha.</div>
    </>
  )
}

// F3 · resumen de las reglas editoriales de la pieza entera
function CopySummary({ content }) {
  const issues = checkPiece(content)
  if (!issues.length) return null
  return (
    <div className="copy-sum">
      <b>{issues.length === 1 ? 'Un detalle de redacción' : `${issues.length} detalles de redacción`}</b>
      <ul>{issues.slice(0, 4).map((it, i) => <li key={i}>{it.msg}</li>)}</ul>
    </div>
  )
}

// J2 · el logo se elige VIÉNDOLO sobre su fondo, no deduciendo cuál
// contrasta a partir de una lista de texto. "Automático" es el default:
// es la regla de marca que menos debería depender del criterio de cada uno.
// cada versión se muestra sobre el fondo donde SÍ funciona: si la ponés
// sobre el fondo actual, la negra sobre oscuro se ve como un cuadrado vacío
const FONDO_LOGO = { cream: '#20302A', green: '#0D0C0C', black: '#F6F1EB', deep: '#F6F1EB' }
function LogoSwatches({ content, template, set, logo }) {
  const auto = !content.logo
  return (
    <div className="logo-sw">
      <button className={'lsw auto' + (auto ? ' on' : '')} onClick={() => set({ logo: null })} title="Elige solo el que contrasta con el fondo">
        <span>Automático</span>
      </button>
      {Object.entries(WORDMARKS).map(([k, w]) => (
        <button key={k} className={'lsw' + (!auto && logo === k ? ' on' : '')} title={w.label}
          style={{ background: FONDO_LOGO[k] || '#20302A' }} onClick={() => set({ logo: k })}>
          <img src={getAsset(w.url) || w.url} alt={w.label} />
        </button>
      ))}
    </div>
  )
}

/* ---------------- I1 · Fotos: un solo panel ----------------
   "Poner una foto" es UNA intención. La app no puede pedir que primero
   entiendas la diferencia entre fondo y objeto para elegir el panel: la
   pregunta se hace al elegir la foto, con el default correcto según la
   plantilla. */
function FotosBody({ content, template, set, inputRef, objects, setObjects, setSelObj, elements, onAddElement, onDeleteElement, onToast, selBg, onSelectBg, destinoFijo = 'fondo' }) {
  // toda plantilla admite foto de fondo (el motor la promueve con bg)
  const admiteFondo = true
  // El destino ya no se pregunta: lo dice el panel en el que estás. Detrás
  // pone fondo, Encima pone objeto. Era una pregunta que había que contestar
  // ANTES de haber elegido la foto, o sea en el peor momento.
  const destino = destinoFijo
  const misFotos = (elements || []).filter((e) => e.kind === 'photo')

  // el nombre de la foto de fondo viaja CON la foto: sin esto, al recortarla
  // el recorte iba a la biblioteca llamándose "Recorte (fondo quitado)" y no
  // había manera de saber de cuál de las cinco salió
  const ponerFondo = async (src, name) => {
    const natural = await imageSize(src)
    set({ bg: 'photo', photo: { src, natural, name: name || content.photo?.name, focal: content.photo?.focal || { x: 0.5, y: 0.5 } } })
  }
  const ponerEncima = async (src, elementId, label) => {
    const natural = await imageSize(src)
    setObjects([...objects, enCascada(objects, { kind: 'image', src, elementId, label, natural, x: 0.5, y: 0.5, scale: 0.5, rotation: 0, shadow: false, opacity: 1 })])
    setSelObj(objects.length)
  }
  const usar = (src, elementId, label) => (destino === 'fondo' && admiteFondo ? ponerFondo(src, label) : ponerEncima(src, elementId, label))
  const subir = async (file) => {
    if (!file || !file.type.startsWith('image/')) return onToast('Ese archivo no es una imagen')
    // Achicar la foto es una decisión nuestra (si no, el guardado del
    // navegador se llena de una). Decirlo evita que después no se entienda
    // por qué al ampliar mucho se ve blanda.
    let info = null
    const src = await compressImage(file, destino === 'fondo' ? 2048 : OBJ_MAX, 0.85, (i) => { info = i })
    if (info?.achicada) onToast(`Foto achicada de ${info.deW}×${info.deH} a ${info.aW}×${info.aH} — entra igual en alta calidad`)
    const nice = file.name.replace(/\.[^.]+$/, '')
    // si ya avisamos del achique, no encimamos dos avisos: el guardado se ve
    // solo en "Mis fotos", que está ahí abajo
    const el = info?.achicada
      ? await alBanco(onAddElement, { name: nice, src, kind: 'photo' })
      : await guardarYAvisar(onAddElement, onToast, { name: nice, src, kind: 'photo' })
    usar(src, el?.id, nice)
  }
  // Una foto de la biblioteca Magoya que traés a la pieza también es tuya:
  // la próxima vez la tenés a mano en "Mis fotos" sin volver a buscarla.
  // Se guarda el MISMO data-URL que va a la pieza, así los bytes quedan una
  // sola vez en IndexedDB. `origin` la identificaría aunque el fondo
  // (2048 px) y el objeto (1400 px) den bytes distintos — hoy no llega
  // (App.jsx lo descarta, ver store.js), así que traer la misma foto una vez
  // de fondo y otra encima deja dos entradas. No rompe nada, sólo repite.
  const usarDeMagoya = async (p) => {
    const src = await fetchCompressed(p.url, destino === 'fondo' ? 2048 : OBJ_MAX)
    const el = await guardarYAvisar(onAddElement, onToast, { name: p.label, src, kind: 'photo', origin: 'magoya:' + p.slug })
    usar(src, el?.id, p.label)
  }

  return (
    <>
      <div className="dropzone" onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && subir(e.dataTransfer.files[0]) }}>
        Subí una foto o arrastrala acá
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && subir(e.target.files[0])} />

      {misFotos.length > 0 && (
        <>
          <label style={{ marginTop: 12 }}>Mis fotos</label>
          <div className="photo-lib">
            {misFotos.map((el) => (
              <div key={el.id} className="photo-lib-item wrap" title={el.name}>
                {/* se podía arrastrar (el cursor lo prometía) y al soltar no
                    pasaba nada: faltaba declarar qué se arrastra */}
                <img src={el.src} alt={el.name} onClick={() => usar(el.src, el.id, el.name)}
                  draggable onDragStart={(e) => e.dataTransfer.setData('application/x-magoya', JSON.stringify({ type: 'element', id: el.id }))} />
                <button className="el-del" title="Quitar de mis fotos" onClick={(e) => { e.stopPropagation(); onDeleteElement && onDeleteElement(el.id) }}><Icon n="close" size={11} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      <label style={{ marginTop: 12 }}>Biblioteca Magoya</label>
      <div className="photo-lib">
        {PHOTOS.map((p) => (
          <button key={p.slug} className="photo-lib-item" title={p.label}
            onClick={() => usarDeMagoya(p)}
            draggable onDragStart={(e) => e.dataTransfer.setData('application/x-magoya', JSON.stringify({ type: 'biblioteca', url: p.url, label: p.label, slug: p.slug }))}>
            <img src={p.url} alt={p.label} loading="lazy" draggable={false} />
          </button>
        ))}
      </div>

      {/* ajustes de la foto de FONDO, sólo si hay una puesta */}
      {/* la fila de la foto de atrás vive sólo en Detrás: en Encima sería
          una cosa de otro panel */}
      {destinoFijo === 'fondo' && content.photo?.src && admiteFondo && (
        <>
          {/* La foto de fondo es una fila, como un texto o un elemento:
              se toca acá y se edita a la derecha. Antes los ajustes estaban
              acá abajo, después de las 28 miniaturas de la biblioteca. */}
          <div className="panel-title" style={{ marginTop: 18 }}>Lo que hay en la pieza</div>
          <div className="obj-list">
            <div className={'obj-row' + (selBg ? ' sel' : '')}>
              <button className="obj-row-name" onClick={() => onSelectBg && onSelectBg()}>
                <span className={'row-dot' + (selBg ? ' on' : '')} />La foto
              </button>
              <button className="obj-row-del" onClick={() => set({ photo: null, bg: 'color' })} title="Sacar la foto"><Icon n="close" size={13} /></button>
            </div>
          </div>
          <div className="hint">Tocala para ajustarla a la derecha: color, desenfoque, encuadre.</div>
        </>
      )}
    </>
  )
}

/* ---------------- Photo ---------------- */

/* ---------------- Quitar fondo (recorte IA, 100% en el navegador) ------------- */
// `nombre` = de qué foto salió el recorte, para poder nombrarlo en la
// biblioteca. `onAddElement` es lo que hace que el recorte SOBREVIVA: es lo
// más caro de producir de toda la app y hasta ahora se perdía al cerrar.
function CutoutButton({ src, onDone, onToast, nombre, onAddElement }) {
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const run = async () => {
    setBusy(true); setPct(0)
    onToast && onToast('Recortando… la primera vez tarda un poco')
    try {
      const out = await removeBackground(src, setPct)
      const natural = await imageSize(out)
      onDone(out, natural)
      // Un solo aviso, no dos: el recorte y su guardado son el mismo gesto.
      const el = await alBanco(onAddElement, { name: nombreRecorte(nombre), src: out, kind: 'element' })
      onToast && onToast(el && !el.dup ? '✓ Recortada — te queda en Mis elementos' : '✓ Recortada')
    } catch (e) {
      console.error(e)
      onToast && onToast('⚠ No se pudo recortar')
    } finally { setBusy(false) }
  }
  return (
    <button className="btn" style={{ marginTop: 8, width: '100%' }} onClick={run} disabled={busy}
      title="Deja sólo la persona o el objeto, sin lo que tenía atrás">
      {busy ? `Recortando… ${pct}%` : <><Icon n="scissors" size={15} /> Recortar la persona</>}
    </button>
  )
}

/* ---------------- Gradient ---------------- */
function GradientBody({ content, set }) {
  const g = content.gradient || null
  const on = !!g?.preset
  const setPreset = (preset) => set({ gradient: preset ? { preset, opacity: g?.opacity ?? 1 } : null })
  return (
    <>
      <div className="chips">
        <button className={'chip' + (!on ? ' on' : '')} onClick={() => setPreset(null)}>Sin degradé</button>
        {Object.entries(GRADIENTS).map(([k, gr]) => (
          <button key={k} className={'chip' + (g?.preset === k ? ' on' : '')} onClick={() => setPreset(k)}>{gr.label}</button>
        ))}
      </div>
      {on && (
        <>
          <div className="field" style={{ marginTop: 10 }}><label>Intensidad</label>
            <input className="range" type="range" min="0.2" max="1" step="0.05" value={g.opacity ?? 1}
              onChange={(e) => set({ gradient: { ...g, opacity: +e.target.value } })} /></div>
          {/* el motor ya giraba el degradé; no había de dónde agarrarlo */}
          <div className="field"><label>Desde dónde cae</label>
            <div className="chips">
              {[[null, 'Como viene'], [180, 'Arriba'], [0, 'Abajo'], [90, 'Izquierda'], [270, 'Derecha']].map(([v, l]) => (
                <button key={l} className={'chip' + ((g.angle ?? null) === v ? ' on' : '')}
                  onClick={() => set({ gradient: { ...g, angle: v === null ? undefined : v } })}>{l}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}

/* ---------------- Objects: insertar + lista (izquierda) ---------------- */
function ObjectsBody({ objects, setObjects, selObj, setSelObj, multiSel, toggleMultiSel, objRemove, onToast, elements = [], onAddElement, onDeleteElement, alwaysOpen = false }) {
  const [picking, setPicking] = useState(alwaysOpen)
  const [cat, setCat] = useState('ai')
  const fileRef = useRef(null)
  const CATS = { ...ICON_CATEGORIES, custom: 'Mis elementos' }

  // `label` = cómo se llama en el inspector (antes todo decía "Logo")
  const placeImage = async (src, elementId, label) => {
    const natural = await imageSize(src)
    setObjects([...objects, enCascada(objects, { kind: 'image', src, elementId, label, natural, x: 0.72, y: 0.42, scale: 0.34, rotation: 0, shadow: true, opacity: 1 })])
    setSelObj(objects.length)
  }
  // el picker sólo se cierra si vive dentro de una sección colapsable
  const closePicker = () => { if (!alwaysOpen) setPicking(false) }
  const addIcon = (icon) => {
    // dispositivo: objeto con PANTALLA (la foto va adentro automáticamente)
    if (icon.isShape) {
      // `pos` no existe acá (venía copiado del drop): sin x/y explícitos esto
      // tiraba ReferenceError y NINGUNA forma se podía agregar tocándola.
      setObjects([...objects, enCascada(objects, { kind: 'shape', shape: icon.shape, tint: 'accent', x: 0.5, y: 0.42, scale: 0.34, rotation: 0, shadow: false, opacity: 1,
        ...(icon.shape === 'badge' ? { text: 'NUEVO' } : {}),
        ...(icon.shape === 'callout' ? { text: '¿Y si el dato ya lo tenías?', tint: '#FFFFFF', shadow: true } : {}),
        ...(icon.shape === 'window' ? { scale: 0.62, ratio: 0.62, shadow: true, text: 'panel.magoya.com', tint: '#FFFFFF', front: true } : {}),
        ...(icon.shape === 'panel' ? { scale: 0.34, ratio: 0.7, radius: 0.06 } : {}) })])
      setSelObj(objects.length); closePicker(); return
    }
    if (icon.isMockup) {
      setObjects([...objects, enCascada(objects, { kind: 'mockup', x: 0.5, y: 0.5, scale: 0.72, ratio: 0.75, rotation: 0, opacity: 1, screen: { a: [0.33, 0.24], b: [0.67, 0.22], d: [0.35, 0.78] }, focal: { x: 0.5, y: 0.5 } })])
      setSelObj(objects.length); closePicker(); return
    }
    if (icon.isDevice) {
      setObjects([...objects, enCascada(objects, { kind: 'device', deviceId: icon.id, x: 0.5, y: 0.5, scale: 0.55, rotation: 0, shadow: true, opacity: 1, focal: { x: 0.5, y: 0.5 }, zoom: 1 })])
      setSelObj(objects.length)
      closePicker()
      return
    }
    if (icon.category === 'magoya' && !icon.isMark) { placeImage(getAsset(icon.url) || icon.url, undefined, icon.label); closePicker(); return }
    const isMark = !!icon.isMark
    setObjects([...objects, enCascada(objects, { kind: 'icon', iconId: icon.id, style: isMark ? 'plain' : 'tile', tint: isMark ? 'accent' : undefined, x: 0.72, y: 0.42, scale: icon.category === 'agro' ? 0.16 : isMark ? 0.34 : 0.3, rotation: 0, shadow: false, opacity: 1 })])
    setSelObj(objects.length)
    closePicker()
  }
  const addImage = async (file) => {
    if (!file || !file.type.startsWith('image/')) return onToast('No es una imagen')
    // Este camino achica MÁS que el de fondo (1400 px contra 2048) y era el
    // único que no avisaba nada.
    let info = null
    const src = await compressImage(file, OBJ_MAX, 0.85, (i) => { info = i })
    if (info?.achicada) onToast(`Foto achicada de ${info.deW}×${info.deH} a ${info.aW}×${info.aH} — entra igual en alta calidad`)
    const nice = file.name.replace(/\.[^.]+$/, '')
    // esto YA se guardaba en la biblioteca, pero en silencio: nadie se
    // enteraba de que el PNG quedaba a mano para la próxima pieza
    const el = info?.achicada
      ? await alBanco(onAddElement, { name: nice, src, kind: 'element' })
      : await guardarYAvisar(onAddElement, onToast, { name: nice, src, kind: 'element' })
    placeImage(src, el?.id, nice)
  }
  const iconsInCat = cat === 'custom' ? [] : ALL_OBJECTS.filter((i) => i.category === cat)

  return (
    <>
      {objects.length > 0 && (
        <div className="obj-list">
          {objects.map((o, i) => {
            const oi = (o.kind === 'icon' || o.kind === 'device') ? ICONS_BY_ID[o.iconId || o.deviceId] : null
            return (
              <div key={i} className={'obj-row' + (selObj === i ? ' sel' : multiSel?.has(i) ? ' sel-extra' : '')}>
                {/* Shift+click acá arma el mismo grupo que Shift+click en el
                    lienzo — es la otra puerta a lo mismo, no una cosa aparte. */}
                <button className="obj-row-name"
                  onClick={(e) => (e.shiftKey && toggleMultiSel ? toggleMultiSel(i) : setSelObj(i))}>
                  <span className={'row-dot' + (selObj === i || multiSel?.has(i) ? ' on' : '')} />{objectName(o, oi)}
                </button>
                <button className="obj-row-del" onClick={() => objRemove(i)} title="Quitar"><Icon n="close" size={13} /></button>
              </div>
            )
          })}
          <div className="hint">Tocá un elemento (acá o en la pieza) → editás sus propiedades a la derecha.</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: objects.length ? 8 : 0 }}>
        {!alwaysOpen && <button className="btn" onClick={() => setPicking((v) => !v)}>+ Elemento (logos, trazos…)</button>}
        <button className="btn" onClick={() => fileRef.current?.click()}>+ Subir PNG</button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && addImage(e.target.files[0])} />
      </div>

      {picking && (
        <div style={{ marginTop: 10 }}>
          <div className="chips" style={{ marginBottom: 8 }}>
            {Object.entries(CATS).map(([k, label]) => (
              <button key={k} className={'chip' + (cat === k ? ' on' : '')} onClick={() => setCat(k)}>{label}</button>
            ))}
          </div>
          {cat === 'custom' ? (
            <>
              <div className="icon-grid">
                <button className="icon-pick upload" title="Subir un elemento" onClick={() => fileRef.current?.click()}><span><Icon n="plus" size={18} /></span></button>
                {elements.filter((e) => e.kind !== 'photo').map((el) => (
                  <div key={el.id} className="icon-pick custom" title={el.name + ' — tocá o arrastrá a la pieza'}
                    draggable onDragStart={(e) => e.dataTransfer.setData('application/x-magoya', JSON.stringify({ type: 'element', id: el.id }))}>
                    <img src={el.src} alt={el.name} onClick={() => placeImage(el.src, el.id)} />
                    <button className="el-del" title="Quitar de la biblioteca" onClick={(e) => { e.stopPropagation(); onDeleteElement && onDeleteElement(el.id) }}><Icon n="close" size={11} /></button>
                  </div>
                ))}
              </div>
              {elements.filter((e) => e.kind !== 'photo').length === 0 && <div className="hint">Subí logos o elementos (PNG/SVG). Las fotos van en el panel <b>Fotos</b>.</div>}
            </>
          ) : (
            <>
              <div className="icon-grid">
                {iconsInCat.map((icon) => {
                  // los trazos (agro, marcas) NO llevan tile de color: se colocan
                  // como trazo suelto, y la miniatura tiene que mostrarlo así.
                  const asset = icon.isDevice || icon.category === 'magoya' || icon.isMark
                  return (
                    <button key={icon.id} title={icon.label + ' — tocá o arrastrá a la pieza'} onClick={() => addIcon(icon)}
                      className={'icon-pick' + (asset ? ' asset' : '') + (icon.isShape ? ' shape' : '') + (icon.isMark ? ' mark' : '')}
                      style={(asset || icon.isShape) ? undefined : {
                        // la miniatura tiene que mostrar lo que se va a dibujar:
                        // degradé, círculo o cuadradito, según la marca
                        background: TILE_GRADIENT[icon.slug]
                          ? `linear-gradient(${TILE_GRADIENT[icon.slug].angle ?? 135}deg, ${TILE_GRADIENT[icon.slug].stops.map((st) => st.c).join(', ')})`
                          : LIGHT_TILE[icon.slug] ? '#FFFFFF' : icon.color,
                        borderRadius: TILE_SHAPE[icon.slug] === 'circle' ? '50%' : undefined,
                      }}
                      draggable onDragStart={(e) => e.dataTransfer.setData('application/x-magoya', JSON.stringify({ type: 'icon', id: icon.id }))}>
                      {icon.isShape ? <ShapeGlyph shape={icon.shape} /> : <img src={icon.url} alt={icon.label} />}
                    </button>
                  )
                })}
              </div>
              <div className="hint">Tocá para agregar o <b>arrastrá directo a la pieza</b>. ¿Falta un logo? Subilo en <b>Mis elementos</b>.</div>
            </>
          )}
        </div>
      )}
    </>
  )
}

/* ---------------- Controles del inspector (spec: slider + valor numérico) ------- */
function Ctl({ label, value, min, max, step = 1, suffix = '', onChange }) {
  const pct = ((value - min) / (max - min)) * 100
  const clamp = (v) => Math.min(max, Math.max(min, v))
  // borrar el número para reescribirlo no funcionaba: el input es controlado
  // y al quedar vacío rebotaba al valor viejo. Se edita en local y se
  // confirma al salir o con Enter.
  const [txt, setTxt] = useState(null)
  return (
    <div className="ictl">
      <div className="ictl-top">
        <label>{label}</label>
        <span className="ictl-numwrap">
          <input className="ictl-num" type="number" min={min} max={max} step={step}
            value={txt ?? Math.round(value)}
            onChange={(e) => { setTxt(e.target.value); if (e.target.value !== '') onChange(clamp(+e.target.value)) }}
            onBlur={() => setTxt(null)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setTxt(null); e.currentTarget.blur() } }} />
          {suffix && <span className="ictl-unit">{suffix}</span>}
        </span>
      </div>
      <input className="rng" type="range" min={min} max={max} step={step} value={value}
        style={{ '--p': pct + '%' }} onChange={(e) => onChange(+e.target.value)} />
    </div>
  )
}

function Pad2D({ x = 0.5, y = 0.5, onChange }) {
  const ref = useRef(null)
  const move = (e) => {
    const r = ref.current.getBoundingClientRect()
    onChange({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) })
  }
  return (
    <div ref={ref} className="pad2d" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e) }}
      onPointerMove={(e) => e.buttons === 1 && move(e)}>
      <div className="pad2d-dot" style={{ left: x * 100 + '%', top: y * 100 + '%' }} />
    </div>
  )
}

/* ---------------- Preview de forma en el picker ---------------- */
function ShapeGlyph({ shape }) {
  const C = 'var(--ui-accent)'
  const p = {
    arrow: <path d="M2,9 H14 V5 L22,12 L14,19 V15 H2 Z" fill={C} />,
    handArrow: <g fill="none" stroke={C} strokeWidth="2.2" strokeLinecap="round"><path d="M3,5 C10,3 18,8 20,19" /><path d="M14,15 L21,20 L22,12" /></g>,
    sparkle: <path d="M12,2 C13,9 15,11 22,12 C15,13 13,15 12,22 C11,15 9,13 2,12 C9,11 11,9 12,2 Z" fill={C} />,
    badge: <g><rect x="2" y="8" width="20" height="8" rx="4" fill={C} /></g>,
    bars: <g fill={C}><rect x="3" y="14" width="3.6" height="7" rx="1" opacity=".45" /><rect x="8" y="10" width="3.6" height="11" rx="1" opacity=".45" /><rect x="13" y="12" width="3.6" height="9" rx="1" opacity=".45" /><rect x="18" y="5" width="3.6" height="16" rx="1" /></g>,
    sparkline: <g fill="none" stroke={C} strokeWidth="2.2" strokeLinecap="round"><path d="M3,17 C7,17 8,12 12,12 C16,12 16,6 21,5" /></g>,
    callout: <path d="M3,4 H21 V15 H9 L5,19 V15 H3 Z" fill={C} />,
    window: <g><rect x="2.5" y="4" width="19" height="16" rx="2.5" fill="none" stroke={C} strokeWidth="1.9" /><path d="M2.5,8.5 H21.5" stroke={C} strokeWidth="1.9" /><g fill={C}><circle cx="5.4" cy="6.2" r=".9" /><circle cx="8" cy="6.2" r=".9" /><circle cx="10.6" cy="6.2" r=".9" /></g></g>,
    dots: <g fill={C}><circle cx="4" cy="12" r="2" /><circle cx="10" cy="12" r="2" opacity=".35" /><circle cx="16" cy="12" r="2" opacity=".35" /><circle cx="22" cy="12" r="2" opacity=".35" /></g>,
    panel: <rect x="3" y="5" width="18" height="14" rx="2.5" fill={C} />,
  }[shape]
  return <svg viewBox="0 0 24 24" width="70%" height="70%">{p}</svg>
}

/* ---------------- Pasos numerados (plantilla método) ---------------- */
function StepsBody({ content, template, set }) {
  const steps = content.steps || template.defaults?.steps || []
  const upd = (i, v) => set({ steps: steps.map((s, idx) => (idx === i ? v : s)) })
  return (
    <div className="steps-list">
      {steps.map((s, i) => (
        <div key={i} className="step-row">
          <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
          <input type="text" value={s} onChange={(e) => upd(i, e.target.value)} maxLength={60} />
          <button className="obj-row-del" onClick={() => set({ steps: steps.filter((_, idx) => idx !== i) })} title="Quitar">✕</button>
        </div>
      ))}
      {steps.length < 6 && <button className="btn" onClick={() => set({ steps: [...steps, 'Nuevo paso'] })}>+ Agregar paso</button>}
    </div>
  )
}


// Los seis puntos de posición decían todos "Ubicar acá": con lector de
// pantalla (o con el tooltip) eran seis botones idénticos.
function nombrePos(x, y) {
  const v = y < 0.34 ? 'arriba' : y > 0.66 ? 'abajo' : 'al centro'
  const h = x < 0.34 ? 'a la izquierda' : x > 0.66 ? 'a la derecha' : ''
  return [v, h].filter(Boolean).join(' ')
}

/* Valores del gráfico. Se edita como TEXTO y recién al salir se traduce a
   números: antes cada tecla se parseaba en vivo, así que borrar un dígito
   dejaba el campo en 0 y una letra suelta hundía la barra a cero. */
function ValoresInput({ valores, onChange }) {
  const [txt, setTxt] = useState(valores.join(', '))
  const [tocado, setTocado] = useState(false)
  useEffect(() => { if (!tocado) setTxt(valores.join(', ')) }, [valores, tocado])
  const parsear = (s) => s.split(',').map((v) => v.trim())
    .filter((v) => v !== '' && Number.isFinite(Number(v)))
    .map(Number).filter((v) => v >= 0)
  const confirmar = () => {
    setTocado(false)
    const nums = parsear(txt)
    if (nums.length >= 2) { onChange(nums); setTxt(nums.join(', ')) }
    else setTxt(valores.join(', '))   // no se entendió: se deja lo que había
  }
  const invalido = tocado && parsear(txt).length < 2
  return (
    <div className="field">
      <label>Valores (separados por coma)</label>
      <input type="text" value={txt} inputMode="numeric"
        onChange={(e) => { setTocado(true); setTxt(e.target.value) }}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }} />
      {invalido && <div className="hint">Van al menos dos números, separados por coma. Ej: 3, 5, 4, 9</div>}
    </div>
  )
}

/* ---------------- Object properties (panel derecho / inspector) ---------------- */
// Con más de un elemento agarrado no tiene sentido mostrar el panel de
// propiedades de UNO solo (¿de cuál?) — esto reemplaza a ObjectProps
// mientras dure la multiselección: las acciones son de grupo.
function MultiSelProps({ count, kind = 'elementos', onCopy, onDuplicate, onRemove }) {
  // Los objetos se arrastran juntos; los textos todavía no (cada uno
  // sigue atado a su lugar en el stack o a su propia posición libre) —
  // el texto de acá no puede prometer lo mismo para los dos casos.
  const puedeMover = kind === 'elementos'
  return (
    <>
      <div className="insp-kicker">{count} {kind} seleccionados</div>
      <p className="panel-help">
        {puedeMover ? 'Se mueven, se copian y se borran juntos.' : 'Se copian y se borran juntos.'}
        {' '}Shift+click suma o saca uno del grupo; Escape lo suelta.
      </p>
      <div className="insp-head">
        <span className="insp-acts">
          <button className="btn" onClick={onCopy} title="Copiar (⌘C)"><Icon n="copy" size={13} /> Copiar</button>
          <button className="btn" onClick={onDuplicate} title="Duplicar (⌘D)"><Icon n="copy" size={13} /> Duplicar</button>
          <button className="btn" onClick={onRemove}>Quitar</button>
        </span>
      </div>
    </>
  )
}

function ObjectProps({ o, i, updateObject, objRemove, objDuplicate, objBringFront, objSendBack, onToast, goToBg, onAddElement }) {
  const objIcon = (o.kind === 'icon' || o.kind === 'device') ? ICONS_BY_ID[o.iconId || o.deviceId] : null
  const isMark = !!objIcon?.isMark
  const showTint = o.kind === 'icon' && (isMark || o.style === 'plain')
  const devPhotoRef = useRef(null)
  const mockFotoRef = useRef(null)
  // la foto base del mockup va a 2048: es el fondo del objeto, se ve grande
  const onMockFoto = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const foto = await compressImage(file, 2048)
    const fotoNatural = await imageSize(foto)
    updateObject(i, { foto, fotoNatural })
  }
  const setDevPhoto = async (src) => {
    const natural = await imageSize(src)
    updateObject(i, { src, natural })
  }
  // la captura que ponés en una pantalla o en un marco también es una foto
  // que entró a la herramienta: queda en Mis fotos como cualquier otra
  const onDevFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const src = await blobToCompressed(file)
    guardarYAvisar(onAddElement, onToast, { name: file.name.replace(/\.[^.]+$/, ''), src, kind: 'photo' })
    setDevPhoto(src)
  }
  const useLibPhoto = async (p) => {
    const src = await fetchCompressed(p.url)
    guardarYAvisar(onAddElement, onToast, { name: p.label, src, kind: 'photo', origin: 'magoya:' + p.slug })
    setDevPhoto(src)
  }
  return (
    <>
      <div className="insp-head">
        <span className="insp-name">{objectName(o, objIcon)}</span>
        <span className="insp-acts">
          <button className="btn" style={{ padding: '2px 8px' }} onClick={() => objDuplicate(i)} title="Duplicar (⌘D)"><Icon n="copy" size={13} /></button>
          <button className="btn" style={{ padding: '2px 8px' }} onClick={() => objRemove(i)}>Quitar</button>
        </span>
      </div>
      {o.kind === 'mockup' && (
        <>
          {/* Dos fotos: la de la mano con el dispositivo, y lo que va
              adentro de la pantalla. Las esquinas se marcan una vez. */}
          <label>La foto (alguien con el dispositivo)</label>
          <div className={'dropzone' + (o.foto ? ' has' : '')} onClick={() => mockFotoRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && onMockFoto(e.dataTransfer.files[0]) }}>
            {o.foto ? '✓ Foto puesta — click para cambiarla' : 'Subí una foto de alguien sosteniendo un celular o tablet'}
          </div>
          <input ref={mockFotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && onMockFoto(e.target.files[0])} />
          {o.foto && (
            <>
              <label style={{ marginTop: 10 }}>Lo que va en la pantalla</label>
              <div className={'dropzone' + (o.src ? ' has' : '')} onClick={() => devPhotoRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && onDevFile(e.dataTransfer.files[0]) }}>
                {o.src ? '✓ Captura puesta — click para cambiarla' : 'Subí la captura que va adentro'}
              </div>
              <input ref={devPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && onDevFile(e.target.files[0])} />
              <div className="hint" style={{ marginTop: 10 }}>
                Marcá las tres esquinas de la pantalla en la foto. Con esas tres la captura entra
                con la misma inclinación que el dispositivo.
              </div>
              {[['a', 'Esquina de arriba a la izquierda'], ['b', 'Esquina de arriba a la derecha'], ['d', 'Esquina de abajo a la izquierda']].map(([k, etiqueta]) => (
                <div key={k}>
                  <label>{etiqueta}</label>
                  <Pad2D x={o.screen?.[k]?.[0] ?? 0.5} y={o.screen?.[k]?.[1] ?? 0.5}
                    onChange={(pt) => updateObject(i, { screen: { ...o.screen, [k]: [pt.x, pt.y] } })} />
                </div>
              ))}
              <Ctl label="Reflejo de la pantalla" value={Math.round((o.glare ?? 0.14) * 100)} min={0} max={45} suffix="%"
                onChange={(v) => updateObject(i, { glare: v / 100 }, 'glare')} />
              <label>Encuadre de la captura</label>
              <Pad2D x={o.focal?.x ?? 0.5} y={o.focal?.y ?? 0.5} onChange={(f) => updateObject(i, { focal: f })} />
            </>
          )}
          <Ctl label="Proporción" value={Math.round((o.ratio ?? 0.75) * 100)} min={40} max={180} suffix="%"
            onChange={(v) => updateObject(i, { ratio: v / 100 }, 'ratio')} />
        </>
      )}
      {o.kind === 'device' && (
        <>
          <label>Foto en la pantalla</label>
          <div className={'dropzone' + (o.src ? ' has' : '')} onClick={() => devPhotoRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && onDevFile(e.dataTransfer.files[0]) }}>
            {o.src ? '✓ Foto en pantalla — click para cambiar' : 'Subí una foto (entra sola en la pantalla)'}
          </div>
          <input ref={devPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && onDevFile(e.target.files[0])} />
          <label style={{ marginTop: 8 }}>o elegí de la biblioteca</label>
          <div className="photo-lib">
            {PHOTOS.slice(0, 9).map((p) => (
              <button key={p.slug} className="photo-lib-item" title={p.label} onClick={() => useLibPhoto(p)}>
                <img src={p.url} alt={p.label} loading="lazy" />
              </button>
            ))}
          </div>
          {o.src && (
            <>
              <Ctl label="Zoom de la foto" value={Math.round((o.zoom || 1) * 100)} min={100} max={300} step={5} onChange={(v) => updateObject(i, { zoom: v / 100 })} />
              <label>Encuadre (arrastrá el punto)</label>
              <Pad2D x={o.focal?.x ?? 0.5} y={o.focal?.y ?? 0.5} onChange={(f) => updateObject(i, { focal: f })} />
            </>
          )}
          {/* el reflejo de pantalla es lo que saca al celular de "ícono",
              pero a veces tapa la captura. Ya era regulable en el motor. */}
          <Ctl label="Reflejo de la pantalla" value={Math.round((o.glare ?? 1) * 100)} min={0} max={100} step={5} suffix="%"
            onChange={(v) => updateObject(i, { glare: v / 100 }, 'glare')} />
        </>
      )}
      {o.kind === 'icon' && !isMark && (
        <div className="chips" style={{ marginBottom: 8 }}>
          <button className={'chip' + (o.style !== 'plain' ? ' on' : '')} onClick={() => updateObject(i, { style: 'tile' })}>En cuadradito</button>
          <button className={'chip' + (o.style === 'plain' ? ' on' : '')} onClick={() => updateObject(i, { style: 'plain' })}>Suelto</button>
        </div>
      )}
      {o.kind === 'image' && o.src && (
        <>
          <CutoutButton src={o.src} onToast={onToast}
            nombre={o.label} onAddElement={onAddElement}
            onDone={(src, natural) => updateObject(i, { src, natural, shadow: false, cutout: true })} />
          {o.cutout && goToBg && (
            <div className="cutout-next">
              Recortado ✓ — ahora ponele un fondo
              <button className="btn" onClick={goToBg}>Poner una foto detrás →</button>
            </div>
          )}
        </>
      )}
      {o.kind === 'device' && o.src && (
        <CutoutButton src={o.src} onToast={onToast}
          nombre={o.label || objIcon?.label} onAddElement={onAddElement}
          onDone={(src, natural) => updateObject(i, { src, natural })} />
      )}
      {o.kind === 'image' && !o.frame && (
        <>
          <label>Efecto (para fotos recortadas)</label>
          <div className="chips" style={{ marginBottom: 8 }}>
            {[['none', 'Ninguno'], ['outline', 'Contorno blanco'], ['glow', 'Resplandor'], ['hard', 'Sombra recortada']].map(([k, l]) => (
              <button key={k} className={'chip' + ((o.fx || 'none') === k ? ' on' : '')}
                onClick={() => updateObject(i, { fx: k === 'none' ? null : k })}>{l}</button>
            ))}
          </div>
          {o.fx && (
            <div className="swatches" style={{ marginBottom: 8 }}>
              {[['#FFFFFF', 'Blanco'], ['#00DE68', 'Verde'], ['#0D0C0C', 'Negro'], ['#CBF06E', 'Lime']].map(([c, t]) => (
                <button key={c} className={'sw' + ((o.fxColor || (o.fx === 'outline' ? '#FFFFFF' : '#00DE68')) === c ? ' on' : '')}
                  title={t} style={{ background: c }} onClick={() => updateObject(i, { fxColor: c })} />
              ))}
            </div>
          )}
        </>
      )}
      {o.kind === 'image' && (
        <>
          <div className="chips" style={{ marginBottom: 8, marginTop: 8 }}>
            <button className={'chip' + (!o.frame ? ' on' : '')} onClick={() => updateObject(i, { frame: false })}>Foto entera</button>
            <button className={'chip' + (o.frame ? ' on' : '')} onClick={() => updateObject(i, { frame: true, ratio: o.ratio || 0.62 })} title="Recortá la imagen en un marco, ej: dentro de una pantalla">Foto en un marco</button>
          </div>
          {o.frame && (
            <>
              {/* un panel de foto puede venir vacío desde la plantilla
                  (ej: los dos retratos de "Quiénes hablan") */}
              <div className={'dropzone' + (o.src ? ' has' : '')} onClick={() => devPhotoRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && onDevFile(e.dataTransfer.files[0]) }}>
                {o.src ? '✓ Foto cargada — click para cambiarla' : 'Poné la foto acá (entra sola en el panel)'}
              </div>
              <input ref={devPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && onDevFile(e.target.files[0])} />
              <Ctl label="Proporción" value={Math.round((o.ratio || 0.62) * 100)} min={30} max={180} suffix="%" onChange={(v) => updateObject(i, { ratio: v / 100 })} />
              <Ctl label="Esquinas redondeadas" value={Math.round((o.radius || 0) * 100)} min={0} max={30} suffix="%" onChange={(v) => updateObject(i, { radius: v / 100 })} />
              <Ctl label="Zoom de la imagen" value={Math.round((o.zoom || 1) * 100)} min={100} max={300} step={5} suffix="%" onChange={(v) => updateObject(i, { zoom: v / 100 })} />
              <label>Encuadre (arrastrá el punto)</label>
              <Pad2D x={o.focal?.x ?? 0.5} y={o.focal?.y ?? 0.5} onChange={(f) => updateObject(i, { focal: f })} />
            </>
          )}
        </>
      )}
      {showTint && (
        <>
          <label>Color</label>
          <div className="swatches" style={{ marginBottom: 8 }}>
            {TINTS.map((t) => (
              <button key={t.k} className={'sw' + ((o.tint || 'accent') === t.value ? ' on' : '')} title={t.label} style={{ background: t.sw }} onClick={() => updateObject(i, { tint: t.value })} />
            ))}
          </div>
        </>
      )}
      {/* logo con tile: el fondo del cuadradito ya se podía cambiar en el
          motor (`tileColor`) y no había swatch. Sirve para que un logo de
          marca no rompa una pieza donde su color no entra. */}
      {o.kind === 'icon' && !isMark && o.style !== 'plain' && (
        <>
          <label>Color del cuadradito</label>
          <div className="swatches" style={{ marginBottom: 8 }}>
            <button className={'sw' + (!o.tileColor ? ' on' : '')} title="El de la marca"
              style={{ background: objIcon?.color || '#0D0C0C' }} onClick={() => updateObject(i, { tileColor: undefined })} />
            {TINTS.filter((t) => t.value !== 'accent').map((t) => (
              <button key={t.k} className={'sw' + (o.tileColor === t.value ? ' on' : '')} title={t.label}
                style={{ background: t.sw }} onClick={() => updateObject(i, { tileColor: t.value })} />
            ))}
          </div>
        </>
      )}
      {o.kind === 'shape' && (
        <>
          {o.shape === 'window' && (
            <>
              {/* "supuestamente vos acá podés ponerle texto… te lo pone
                  dentro de la cajita, como una ventana de Windows" */}
              <div className="field"><label>Texto adentro</label>
                <textarea rows={3} value={o.body || ''} placeholder="Dejalo vacío si vas a poner una captura"
                  onChange={(e) => updateObject(i, { body: e.target.value })} /></div>
              <label>Captura</label>
              <div className={'dropzone' + (o.src ? ' has' : '')} onClick={() => devPhotoRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && onDevFile(e.dataTransfer.files[0]) }}>
                {o.src ? '✓ Captura cargada — click para cambiar' : 'Subí la captura (entra sola en la ventana)'}
              </div>
              <input ref={devPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && onDevFile(e.target.files[0])} />
              <Ctl label="Proporción" value={Math.round((o.ratio || 0.62) * 100)} min={40} max={120} suffix="%" onChange={(v) => updateObject(i, { ratio: v / 100 }, 'ratio')} />
              {/* la captura ya se podía acercar y reencuadrar; no había control */}
              {o.src && (
                <>
                  <Ctl label="Zoom de la captura" value={Math.round((o.zoom || 1) * 100)} min={100} max={300} step={5} suffix="%" onChange={(v) => updateObject(i, { zoom: v / 100 }, 'zoom')} />
                  <label>Encuadre (arrastrá el punto)</label>
                  <Pad2D x={o.focal?.x ?? 0.5} y={o.focal?.y ?? 0.5} onChange={(f) => updateObject(i, { focal: f })} />
                </>
              )}
            </>
          )}
          {(o.shape === 'badge' || o.shape === 'callout' || o.shape === 'window') && (
            <div className="field"><label>{o.shape === 'window' ? 'Barra de la ventana' : 'Texto'}</label>
              <input type="text" value={o.text || ''} onChange={(e) => updateObject(i, { text: e.target.value })} /></div>
          )}
          {/* la etiqueta ya sabía dibujarse en contorno; faltaba el control */}
          {o.shape === 'badge' && (
            <div className="chips" style={{ marginBottom: 8 }}>
              <button className={'chip' + (o.style !== 'outline' ? ' on' : '')} onClick={() => updateObject(i, { style: 'solid' })}>Rellena</button>
              <button className={'chip' + (o.style === 'outline' ? ' on' : '')} onClick={() => updateObject(i, { style: 'outline' })}>Sólo contorno</button>
            </div>
          )}
          {(o.shape === 'bars' || o.shape === 'sparkline') && (
            <ValoresInput valores={o.values || [3, 5, 4, 7, 9]} onChange={(vals) => updateObject(i, { values: vals })} />
          )}
          {o.shape === 'dots' && (
            <>
              <Ctl label="Cuántos puntos" value={o.count ?? 5} min={2} max={12} step={1}
                onChange={(v) => updateObject(i, { count: v, active: Math.min(o.active ?? 0, v - 1) })} />
              <Ctl label="Cuál está lleno" value={(o.active ?? 0) + 1} min={1} max={o.count ?? 5} step={1}
                onChange={(v) => updateObject(i, { active: v - 1 })} />
            </>
          )}
          {o.shape === 'panel' && (
            <>
              <Ctl label="Proporción" value={Math.round((o.ratio ?? 0.7) * 100)} min={20} max={200} suffix="%"
                onChange={(v) => updateObject(i, { ratio: v / 100 }, 'ratio')} />
              <Ctl label="Esquinas redondeadas" value={Math.round((o.radius ?? 0.06) * 100)} min={0} max={50} suffix="%"
                onChange={(v) => updateObject(i, { radius: v / 100 }, 'radius')} />
            </>
          )}
          <label>Color</label>
          <div className="swatches" style={{ marginBottom: 8 }}>
            {TINTS.map((t) => (
              <button key={t.k} className={'sw' + ((o.tint || 'accent') === t.value ? ' on' : '')} title={t.label}
                style={{ background: t.sw }} onClick={() => updateObject(i, { tint: t.value })} />
            ))}
          </div>
          {STROKE_SHAPES.includes(o.shape) && (
            <Ctl label="Grosor del trazo" value={Math.round((o.sw || 1) * 100)} min={40} max={300} step={10} suffix="%"
              onChange={(v) => updateObject(i, { sw: v / 100 }, 'sw')} />
          )}
        </>
      )}
      {o.kind === 'icon' && (objIcon?.category === 'agro' || objIcon?.isMark) && (
        <Ctl label="Grosor del trazo" value={Math.round((o.sw || 1) * 100)} min={40} max={300} step={10} suffix="%"
          onChange={(v) => updateObject(i, { sw: v / 100 }, 'sw')} />
      )}
      {/* Un solo control de capas. Antes había dos sistemas distintos con
          el mismo nombre: "Traer al frente" no hacía nada visible si el
          objeto estaba en la capa de atrás. */}
      <label>Capa</label>
      <div className="chips" style={{ marginBottom: 6 }}>
        <button className={'chip' + (!o.front ? ' on' : '')} onClick={() => updateObject(i, { front: false })}>Detrás del texto</button>
        <button className={'chip' + (o.front ? ' on' : '')} onClick={() => updateObject(i, { front: true })}>Delante del texto</button>
      </div>
      <div className="chips" style={{ marginBottom: 4 }}>
        <button className="chip" onClick={() => objBringFront(i)}><Icon n="up" size={13} /> Subir</button>
        <button className="chip" onClick={() => objSendBack(i)}><Icon n="down" size={13} /> Bajar</button>
      </div>
      <div className="hint" style={{ marginBottom: 10 }}>Subir y bajar ordenan dentro de esta capa.</div>
      <label>Posición</label>
      <div className="posgrid">
        {POS_GRID.map(([px, py], k) => (
          <button key={k} className={'posdot' + (Math.abs((o.x ?? 0.5) - px) < 0.02 && Math.abs((o.y ?? 0.5) - py) < 0.02 ? ' on' : '')}
            onClick={() => updateObject(i, { x: px, y: py })}
            title={`Ubicar ${nombrePos(px, py)}`} aria-label={`Ubicar ${nombrePos(px, py)}`} />
        ))}
      </div>
      <Ctl label="Tamaño" value={Math.round((o.scale ?? 0.3) * 100)} min={5} max={120} suffix="%" onChange={(v) => updateObject(i, { scale: v / 100 }, 'scale')} />
      <Ctl label="Rotación" value={Math.round(o.rotation || 0)} min={-180} max={180} step={1} suffix="°"
        onChange={(v) => updateObject(i, { rotation: v }, 'rot')} />
      <div className="chips" style={{ marginTop: -4, marginBottom: 10 }}>
        {[-90, -15, 0, 15, 90].map((d) => (
          <button key={d} className={'chip' + ((o.rotation || 0) === d ? ' on' : '')} onClick={() => updateObject(i, { rotation: d })}>{d > 0 ? `+${d}°` : `${d}°`}</button>
        ))}
      </div>
      {/* "Vertical" no reflejaba: rotaba 180°, que no es lo mismo. Ahora se
          llama como lo que hace. Y en las formas simétricas (etiqueta,
          destello) espejar no cambia un píxel, así que no se ofrece. */}
      {!['badge', 'sparkle'].includes(o.shape) && (
        <>
          <label>Reflejar</label>
          <div className="chips" style={{ marginBottom: 10 }}>
            <button className={'chip' + (o.flipX ? ' on' : '')} onClick={() => updateObject(i, { flipX: !o.flipX })} title="Espeja el elemento (útil para que una flecha apunte al otro lado)"><Icon n="flipH" size={14} /> Espejar</button>
            <button className="chip" onClick={() => updateObject(i, { rotation: ((o.rotation || 0) + 180) % 360 > 180 ? ((o.rotation || 0) + 180) - 360 : (o.rotation || 0) + 180 })} title="Gira media vuelta"><Icon n="flipV" size={14} /> Girar 180°</button>
          </div>
        </>
      )}
      {/* la gente piensa en "cuánto se transparenta", no en "cuánta opacidad" */}
      <Ctl label="Transparencia" value={Math.round((1 - (o.opacity ?? 1)) * 100)} min={0} max={90} step={5} suffix="%"
        onChange={(v) => updateObject(i, { opacity: 1 - v / 100 }, 'op')} />
      {/* El motor unificó el criterio: sin la propiedad NO hay sombra. Los
          chips seguían con el viejo (`!== false`), así que un objeto de un
          proyecto guardado mostraba "Con sombra" prendido y se dibujaba sin
          sombra. El control tiene que decir lo que pasa. */}
      <label>Sombra</label>
      <div className="chips">
        <button className={'chip' + (o.shadow === true ? ' on' : '')} onClick={() => updateObject(i, { shadow: true })}>Con sombra</button>
        <button className={'chip' + (o.shadow !== true ? ' on' : '')} onClick={() => updateObject(i, { shadow: false })}>Sin sombra</button>
      </div>
    </>
  )
}

// Nombre exacto de lo que hay seleccionado: antes casi todo decía "Logo".
function objectName(o, icon) {
  if (o.kind === 'mockup') return o.foto ? 'Mockup con foto' : 'Mockup (falta la foto)'
  if (!o) return 'Elemento'
  if (o.kind === 'shape') return SHAPE_NAMES[o.shape] || 'Forma'
  if (o.kind === 'device') return icon?.label ? `Dispositivo · ${icon.label}` : 'Dispositivo'
  if (o.kind === 'image') {
    if (o.cutout) return o.label ? `Recorte · ${o.label}` : 'Recorte'
    if (o.label) return o.label
    if (o.frame) return 'Imagen en marco'
    return o.elementId ? 'Elemento propio' : 'Imagen'
  }
  if (!icon) return 'Elemento'
  if (icon.isIsotipo) return `Isotipo Magoya · ${icon.label}`
  if (icon.isWordmark) return icon.label
  if (icon.category === 'ai') return `Logo de IA · ${icon.label}`
  if (icon.category === 'social') return `Logo de red · ${icon.label}`
  if (icon.category === 'trazos') return `Trazo · ${icon.label}`
  if (icon.category === 'misc') return `Misceláneo · ${icon.label}`
  return icon.label || 'Elemento'
}

// El color de fondo, donde la gente lo busca. En las piezas en blanco
// también decide si el fondo es color o foto.
function FondoBody({ content, template, set }) {
  const scheme = content.scheme || template.defaults?.scheme || 'deep'
  // el fondo efectivo: `bg` manda sobre lo que trae la plantilla
  const bg = content.bg || template.defaults?.bg || null
  const propia = template.surface === 'photo' || template.defaults?.hasPhoto
  const esFoto = bg === 'photo' || (bg !== 'color' && !template.freeform && propia)
  if (esFoto) {
    return (
      <p className="panel-help">
        Esta pieza usa una foto de fondo. Cambiala, ajustala o sacala desde <b>Fotos</b>.
      </p>
    )
  }
  return (
    <div className="swatches">
      {Object.entries(COLOR_SCHEMES).map(([k, s2]) => (
        <button key={k} className={'sw named' + (scheme === k ? ' on' : '')} onClick={() => set({ scheme: k })}>
          <span className="sw-dot" style={{ background: s2.surface }} /><span className="sw-name">{s2.label}</span>
        </button>
      ))}
    </div>
  )
}

/* ---------------- Brand ---------------- */
function BrandBody({ content, template, set, onlyColors = false, soloLogo = false }) {
  const scheme = content.scheme || template.defaults?.scheme || 'deep'
  const accent = content.accent || template.defaults?.accent || 'emerald'
  const logo = content.logo || template.defaults?.logo || 'cream'
  // en las piezas en blanco con fondo de color, el color vive acá (los
  // colores son marca); antes estaba en un panel "Fondo" aparte
  const mostrarLogo = content.showLogo !== undefined ? content.showLogo : template.defaults?.showLogo !== false
  if (soloLogo) return <LogoBody content={content} template={template} set={set} />
  if (onlyColors) {
    return (
      <>
        <div className="field"><label>Color de la pieza</label>
          <div className="swatches">
            {Object.entries(COLOR_SCHEMES).map(([k, s]) => (
              <button key={k} className={'sw named' + (scheme === k ? ' on' : '')} onClick={() => set({ scheme: k })}><span className="sw-dot" style={{ background: s.surface }} /><span className="sw-name">{s.label}</span></button>
            ))}
          </div>
        </div>
        <div className="field"><label>Color de acento</label>
          <div className="swatches">
            {Object.entries(ACCENTS).map(([k, a]) => (
              <button key={k} className={'sw named' + (accent === k ? ' on' : '')} onClick={() => set({ accent: k })}><span className="sw-dot" style={{ background: a.value }} /><span className="sw-name">{a.label}</span></button>
            ))}
          </div>
        </div>
      </>
    )
  }
  return (
    <>
      <div className="field"><label>Color de acento</label>
        <div className="swatches">
          {Object.entries(ACCENTS).map(([k, a]) => (
            <button key={k} className={'sw named' + (accent === k ? ' on' : '')} onClick={() => set({ accent: k })}><span className="sw-dot" style={{ background: a.value }} /><span className="sw-name">{a.label}</span></button>
          ))}
        </div>
      </div>
      {/* prender/apagar el logo estaba sólo en las piezas en blanco: en el
          chat no había forma de ponerlo aunque la plantilla venga sin él */}
      <div className="field"><label>Logo Magoya</label>
        <div className="chips" style={{ marginBottom: 8 }}>
          <button className={'chip' + (mostrarLogo ? ' on' : '')} onClick={() => set({ showLogo: true })}>Con logo</button>
          <button className={'chip' + (!mostrarLogo ? ' on' : '')} onClick={() => set({ showLogo: false })}>Sin logo</button>
        </div>
        {mostrarLogo && <LogoSwatches content={content} template={template} set={set} logo={logo} />}
      </div>
      {mostrarLogo && <LogoPosition content={content} template={template} set={set} />}
    </>
  )
}

function LogoPosition({ content, template, set }) {
  const pos = content.logoPos || template.defaults?.logoPos || 'left'
  const scale = content.logoScale || template.defaults?.logoScale || 1
  return (
    <>
      <div className="field"><label>Posición del logo</label>
        <div className="chips">
          <button className={'chip' + (pos === 'left' ? ' on' : '')} onClick={() => set({ logoPos: 'left' })}>Izquierda</button>
          <button className={'chip' + (pos === 'right' ? ' on' : '')} onClick={() => set({ logoPos: 'right' })}>Derecha</button>
        </div>
      </div>
      <div className="field"><label>Tamaño del logo</label>
        <div className="chips">
          {[1, 2, 3, 4].map((s) => (
            <button key={s} className={'chip' + (scale === s ? ' on' : '')} onClick={() => set({ logoScale: s })}>{s}×</button>
          ))}
        </div>
      </div>
    </>
  )
}

/* ---------------- Freeform: Fondo / Textos / Posición / Logo ---------------- */
const TEXT_STYLE_OPTS = [
  { k: 'title', label: 'Título' },
  { k: 'subtitle', label: 'Bajada' },
  { k: 'kicker', label: 'Etiqueta' },
  { k: 'metric', label: 'Dato (número grande)' },
  { k: 'metricLabel', label: 'Descripción del dato' },
  { k: 'quote', label: 'Cita' },
  { k: 'cta', label: 'Botón / CTA' },
]


function TextBlocksBody({ content, set, onSelectText, selText, multiSelText, toggleMultiSelText }) {
  const blocks = content.textBlocks || []
  const add = () => { const n = blocks.length; set({ textBlocks: [...blocks, { style: 'title', text: 'Nuevo texto' }] }); onSelectText && onSelectText('tb:' + n) }
  const remove = (i) => set({ textBlocks: blocks.filter((_, idx) => idx !== i) })
  const move = (i, dir) => { const a = [...blocks]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set({ textBlocks: a }) }
  return (
    <>
      <div className="obj-list">
        {blocks.map((b, i) => {
          const eid = 'tb:' + i
          const styleLabel = TEXT_STYLE_OPTS.find((o) => o.k === b.style)?.label || 'Texto'
          return (
            <div key={i} className={'obj-row' + (selText === eid ? ' sel' : multiSelText?.has(eid) ? ' sel-extra' : '')}>
              <button className="obj-row-name txt-row"
                onClick={(e) => (e.shiftKey && toggleMultiSelText ? toggleMultiSelText(eid) : onSelectText && onSelectText(eid))}>
                <span className="row-role">{styleLabel}</span>
                <span className="row-preview">{String(b.text).trim() || '—'}</span>
              </button>
              <span style={{ display: 'flex' }}>
                <button className="obj-row-del" onClick={() => move(i, -1)} title="Subir"><Icon n="up" size={13} /></button>
                <button className="obj-row-del" onClick={() => move(i, 1)} title="Bajar"><Icon n="down" size={13} /></button>
                <button className="obj-row-del" onClick={() => remove(i)} title="Quitar"><Icon n="close" size={13} /></button>
              </span>
            </div>
          )
        })}
      </div>
      <button className="btn" onClick={add} style={{ marginTop: 8 }}>+ Agregar texto</button>
    </>
  )
}

function AnchorBody({ content, template, set }) {
  const cur = content.anchor || template.anchor || 'bottom-left'
  const [v, h] = cur.split('-')
  const setA = (nv, nh) => set({ anchor: `${nv}-${nh}` })
  return (
    <>
      <label style={{ fontSize: 11, color: '#4A554D' }}>Vertical</label>
      <div className="chips" style={{ marginBottom: 8 }}>
        {[['top', 'Arriba'], ['center', 'Centro'], ['bottom', 'Abajo']].map(([k, l]) => (
          <button key={k} className={'chip' + (v === k ? ' on' : '')} onClick={() => setA(k, h)}>{l}</button>
        ))}
      </div>
      <label style={{ fontSize: 11, color: '#4A554D' }}>Horizontal</label>
      <div className="chips">
        {[['left', 'Izquierda'], ['center', 'Centro']].map(([k, l]) => (
          <button key={k} className={'chip' + (h === k ? ' on' : '')} onClick={() => setA(v, k)}>{l}</button>
        ))}
      </div>
    </>
  )
}

function LogoBody({ content, template, set }) {
  const showLogo = content.showLogo !== false
  const logo = content.logo || template.defaults?.logo || 'cream'
  return (
    <>
      <div className="chips" style={{ marginBottom: 10 }}>
        <button className={'chip' + (showLogo ? ' on' : '')} onClick={() => set({ showLogo: true })}>Con logo</button>
        <button className={'chip' + (!showLogo ? ' on' : '')} onClick={() => set({ showLogo: false })}>Sin logo</button>
      </div>
      {showLogo && (
        <>
          <div className="field"><label>Logo Magoya</label>
            <select value={logo} onChange={(e) => set({ logo: e.target.value })}>
              {Object.entries(WORDMARKS).map(([k, w]) => (<option key={k} value={k}>{w.label}</option>))}
            </select>
          </div>
          <LogoPosition content={content} template={template} set={set} />
        </>
      )}
    </>
  )
}


/* ---------------- La foto de fondo, en el inspector de la derecha ---------------- */
function FondoProps({ content, set, onToast, onAddElement }) {
  const foto = content.photo
  if (!foto?.src) return null
  return (
    <>
      <div className="insp-head"><span className="insp-name">Foto de fondo</span>
        <span className="insp-acts">
          <button className="btn" style={{ padding: '2px 8px' }} onClick={() => set({ photo: null, bg: 'color' })}>Quitar</button>
        </span>
      </div>
      <div className="field">
        <label>Color de la foto</label>
        <div className="chips">
          <button className={'chip' + ((content.treatment || 'bw') === 'bw' ? ' on' : '')} onClick={() => set({ treatment: 'bw' })}>Blanco y negro</button>
          <button className={'chip' + (content.treatment === 'color' ? ' on' : '')} onClick={() => set({ treatment: 'color' })}>Color</button>
        </div>
      </div>
      {/* "le faltaría también esto de si querés que sea en blanco y negro,
          o querés que sea más blureada" */}
      <Ctl label="Desenfoque" value={Math.round(content.photoBlur ?? 0)} min={0} max={24} suffix="px"
        onChange={(v) => set({ photoBlur: v }, 'blur')} />
      <Ctl label="Oscurecer" value={Math.round((content.photoDim ?? 0) * 100)} min={0} max={80} suffix="%"
        onChange={(v) => set({ photoDim: v / 100 }, 'dim')} />
      <label>Encuadre (arrastrá el punto)</label>
      <Pad2D x={foto.focal?.x ?? 0.5} y={foto.focal?.y ?? 0.5}
        onChange={(f) => set({ photo: { ...foto, focal: f } })} />
      <CutoutButton src={foto.src} onToast={onToast} nombre={foto.name} onAddElement={onAddElement}
        onDone={(src, natural) => set({ photo: { ...foto, src, natural } })} />
    </>
  )
}

/* ---------------- Text properties (panel derecho / inspector) ---------------- */
function TextProps({ eid, template, content, set, getText, setText, onVolverAlStack }) {
  const isTb = eid.startsWith('tb:')
  const idx = isTb ? +eid.slice(3) : -1
  const block = isTb ? (content.textBlocks || [])[idx] : null
  // el rol para el contador y el tamaño. Un paso numerado es `step:0`, no
  // un rol: recortando por posición salía ':0' y se rompían los dos.
  const rolDeEid = eid.startsWith('step:') ? 'step' : eid.startsWith('role:') ? eid.slice(5) : null
  const val = getText(eid)
  const updateBlock = (patch) => set({ textBlocks: (content.textBlocks || []).map((b, i) => (i === idx ? { ...b, ...patch } : b)) })
  return (
    <>
      <div className="insp-head"><span className="insp-name">Texto</span></div>
      <label>Contenido</label>
      <textarea value={val} onChange={(e) => setText(eid, e.target.value)} rows={2} />
      {(() => {
        const role = isTb ? (block?.style || 'title') : rolDeEid
        const max = MAXCHARS[role]
        if (!max) return null
        const n = String(val || '').length
        const elegido = isTb ? block?.size : content.sizes?.[role]
        // el aviso tiene que decir la verdad: si elegiste un tamaño a mano
        // el texto NO se achica, baja de línea
        const nota = n <= max ? '' : elegido ? '· más largo de lo recomendado' : '· va a entrar más chico'
        return <div className={'charcount' + (n > max ? ' over' : '')}>{n}/{max} {nota}</div>
      })()}
      {/* F3 · reglas editoriales: avisa, no bloquea.
          Y en la misma lista, el contraste: es otro "che, ojo con esto",
          no una alerta aparte. Si la pieza está bien, no aparece nada. */}
      {(() => {
        const role = isTb ? (block?.style || 'title') : rolDeEid
        const notes = [
          ...checkCopy(role, val, content),
          ...(String(val ?? '').trim() ? checkContrast({ role, template, content, block }) : []),
        ]
        if (!notes.length) return null
        return <ul className="copy-notes">{notes.map((m, i) => <li key={i}>{m}</li>)}</ul>
      })()}
      {/* "no me deja elegir el tamaño de la tipografía" — ahora sí, con
          Automático como default (el que entra solo) */}
      {/* si lo moviste a mano, la forma de volver atrás tiene que estar acá */}
      {content.pos?.[eid] && (
        <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <span>Lo moviste a mano.</span>
          <button className="btn" onClick={() => onVolverAlStack && onVolverAlStack(eid)}>Volver a su lugar</button>
        </div>
      )}
      <label>Tamaño</label>
      <div className="chips" style={{ marginBottom: 10 }}>
        {[[null, 'Automático'], [0.75, 'Chico'], [1, 'Normal'], [1.3, 'Grande'], [1.7, 'Enorme']].map(([v, l]) => {
          const actual = isTb ? block?.size : (rolDeEid ? content.sizes?.[rolDeEid] : null)
          const on = (v === null && !actual) || actual === v
          const aplicar = () => {
            if (isTb) updateBlock({ size: v })
            else if (rolDeEid) set({ sizes: { ...(content.sizes || {}), [rolDeEid]: v || undefined } })
          }
          return <button key={l} className={'chip' + (on ? ' on' : '')} onClick={aplicar}>{l}</button>
        })}
      </div>
      {isTb && block ? (
        <>
          <label>Estilo</label>
          <select value={block.style || 'title'} onChange={(e) => updateBlock({ style: e.target.value })}>
            {TEXT_STYLE_OPTS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
          </select>
          {block.style !== 'cta' && (
            <>
              {/* El color va ANTES del marcador a propósito: cuando lo único
                  que había era el marcador, la salida para destacar algo
                  terminaba siendo resaltar la pieza entera. */}
              <label>Color del texto</label>
              <div className="chips">
                {Object.entries(TEXT_COLORS).map(([k, tc]) => (
                  <button key={k} className={'chip' + ((block.color || 'auto') === k ? ' on' : '')} onClick={() => updateBlock({ color: k })}>{tc.label}</button>
                ))}
              </div>
              <label>Resaltado (marcador)</label>
              <div className="chips">
                {Object.entries(HIGHLIGHTS).map(([k, hl]) => (
                  <button key={k} className={'chip' + ((block.highlight || 'none') === k ? ' on' : '')} onClick={() => updateBlock({ highlight: k })}>{hl.label}</button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="hint">El estilo y el tamaño de este texto los define la plantilla (marca bloqueada).</div>
      )}
    </>
  )
}

/* ---------------- Chat (WhatsApp) ---------------- */
function ChatBody({ content, template, set }) {
  const msgs = content.messages || template.defaults?.messages || []
  const update = (i, patch) => set({ messages: msgs.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) })
  const add = (from) => set({ messages: [...msgs, { from, text: 'Nuevo mensaje' }] })
  const remove = (i) => set({ messages: msgs.filter((_, idx) => idx !== i) })
  const move = (i, dir) => { const a = [...msgs]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set({ messages: a }) }
  return (
    <>
      {msgs.map((m, i) => (
        <div key={i} className="obj-card">
          <div className="obj-head">
            <div className="chips">
              <button className={'chip' + (m.from === 'them' ? ' on' : '')} onClick={() => update(i, { from: 'them' })}>Recibido</button>
              <button className={'chip' + (m.from === 'me' ? ' on' : '')} onClick={() => update(i, { from: 'me' })}>Enviado</button>
            </div>
            <span style={{ display: 'flex' }}>
              <button className="obj-row-del" onClick={() => move(i, -1)} title="Subir"><Icon n="up" size={13} /></button>
              <button className="obj-row-del" onClick={() => move(i, 1)} title="Bajar"><Icon n="down" size={13} /></button>
              <button className="obj-row-del" onClick={() => remove(i)} title="Quitar"><Icon n="close" size={13} /></button>
            </span>
          </div>
          <textarea value={m.text} onChange={(e) => update(i, { text: e.target.value })} rows={2} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button className="btn" onClick={() => add('them')}>+ Recibido</button>
        <button className="btn" onClick={() => add('me')}>+ Enviado</button>
      </div>
    </>
  )
}

/* ---------------- More menu (acciones de proyecto) ---------------- */
// Compartir vive en UN solo lugar (el modal). Acá queda lo que no es
// compartir: reusar la pieza y bajar el archivo editable.
function MoreMenu({ onSaveTemplate, onExportFile }) {
  const [open, setOpen] = useState(false)
  const act = (fn) => { setOpen(false); fn && fn() }
  const ref = useCerrar(open, () => setOpen(false))
  return (
    <div className="menu" ref={ref}>
      <button className="btn" onClick={() => setOpen((o) => !o)}>Más <span className={'sec-chev chev-menu' + (open ? ' open' : '')}><Icon n="chevron" size={12} /></span></button>
      {open && (
        <div className="menu-pop">
          <button onClick={() => act(onSaveTemplate)}><span>Guardar como plantilla</span><Icon n="bookmark" size={15} /></button>
          <button onClick={() => act(onExportFile)}><span>Bajar el archivo editable (.json)</span><Icon n="down" size={15} /></button>
        </div>
      )}
    </div>
  )
}

/* ---------------- D3 · Compartir: una sola puerta, por INTENCIÓN ----------------
   Antes había 4 salidas repartidas (menú Más ×3 + el botón del mockup) y
   ninguna decía para qué servía cada una. Acá se elige el objetivo y la app
   resuelve el resto. */
const SHARE_INTENTS = [
  {
    k: 'review', title: 'Para que lo revisen',
    desc: 'Link con la foto incluida. Quien lo abra puede comentar tocando un punto de la pieza y aprobarla.',
    cta: 'Crear link de revisión', best: true,
  },
  {
    k: 'show', title: 'Para mostrar cómo queda',
    desc: 'Link de sólo lectura dentro de un mockup, como se ve publicado. Sin foto: pesa poco y se abre al toque.',
    cta: 'Copiar link de preview',
  },
  {
    k: 'edit', title: 'Para que lo editen',
    desc: 'Baja el archivo del proyecto con todo adentro. Se abre desde Inicio › Abrir un archivo.',
    cta: 'Bajar el archivo',
  },
]

function ShareModal({ onClose, onShare, onShareReview, onExportFile, mockup, setMockup }) {
  const [pick, setPick] = useState('review')
  const ref = useModal(onClose)
  const run = () => {
    if (pick === 'review') onShareReview && onShareReview(mockup)
    else if (pick === 'show') onShare && onShare(mockup)
    else onExportFile && onExportFile()
    onClose()
  }
  const cur = SHARE_INTENTS.find((i) => i.k === pick)
  return (
    <div className="mk-modal-ov" onClick={onClose}>
      <div className="share-modal" ref={ref} role="dialog" aria-modal="true" aria-label="Compartir" onClick={(e) => e.stopPropagation()}>
        <div className="share-head">
          <strong>Compartir</strong>
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>
        <p className="panel-help" style={{ margin: '0 0 12px' }}>¿Para qué lo compartís? Según eso cambia el link.</p>
        <div className="share-opts">
          {SHARE_INTENTS.map((it) => (
            <button key={it.k} className={'share-opt' + (pick === it.k ? ' on' : '')} onClick={() => setPick(it.k)}>
              <span className="so-t">{it.title}{it.best && <span className="so-tag">recomendado</span>}</span>
              <span className="so-d">{it.desc}</span>
            </button>
          ))}
        </div>
        {pick !== 'edit' && (
          <div className="share-mk">
            <label>Mockup</label>
            <div className="chips">
              {MOCKUPS.map((m) => (
                <button key={m.k} className={'chip' + (mockup === m.k ? ' on' : '')} onClick={() => setMockup(m.k)}>{m.label}</button>
              ))}
            </div>
          </div>
        )}
        <div className="share-foot">
          <button className="btn primary" onClick={run}>{cur.cta}</button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Download menu ---------------- */
function DownloadMenu({ template, content, format, slides, sizeLock, busy, setBusy, onToast }) {
  const [open, setOpen] = useState(false)
  const [prog, setProg] = useState(null)     // {hechas, total}
  const isCarousel = slides && slides.length > 0
  const run = async (fn, label) => {
    setOpen(false); setBusy(true); setProg(null); onToast('Generando ' + label + '…')
    try { await fn(); onToast('✓ ' + label + ' descargado') }
    catch (e) {
      console.error(e)
      // decir qué hacer, no sólo que falló
      onToast(/dynamically imported/i.test(e?.message || '')
        ? '⚠ Salió una versión nueva: recargá la página y probá de nuevo'
        : '⚠ No se pudo exportar. Probá con @2x, que pesa menos.')
    }
    finally { setBusy(false); setProg(null) }
  }
  const onProgress = (hechas, total) => setProg({ hechas, total })
  const refMenu = useCerrar(open, () => setOpen(false))
  return (
    <div className="menu" ref={refMenu}>
      <button className="btn primary" disabled={busy} onClick={() => setOpen((o) => !o)}>
        {busy
          ? (prog ? `Slide ${prog.hechas} de ${prog.total}…` : 'Generando…')
          : <><Icon n="down" size={16} /> Descargar</>}
      </button>
      {open && (
        <div className="menu-pop">
          <div className="grp">Recomendado</div>
          <button className="rec" onClick={() => run(() => exportPiece({ template, content, format, kind: 'png', scale: 3, sizeLock }), 'PNG @3x')}>
            <span>PNG — listo para redes</span><span>@3x</span>
          </button>
          <div className="grp">Otras opciones</div>
          <button onClick={() => run(() => exportPiece({ template, content, format, kind: 'png', scale: 2, sizeLock }), 'PNG @2x')}><span>PNG más liviano</span><span>@2x</span></button>
          <button onClick={() => run(() => exportPiece({ template, content, format, kind: 'jpg', scale: 2, sizeLock }), 'JPG')}><span>JPG</span><span>@2x</span></button>
          <button onClick={() => run(() => exportPiece({ template, content, format, kind: 'svg', sizeLock }), 'SVG')}><span>SVG — vectorial</span><span>∞</span></button>
          {isCarousel && (
            <>
              <div className="grp">Carrusel ({slides.length} slides)</div>
              <button onClick={() => run(() => exportCarousel({ slides, format, kind: 'zip', scale: 3, onProgress, sizeLock }), 'ZIP de PNGs')}><span>ZIP de PNGs</span><span>@3x</span></button>
              <button onClick={() => run(() => exportCarousel({ slides, format, kind: 'pdf', scale: 2, onProgress, sizeLock }), 'PDF')}><span>PDF</span><span>multipágina</span></button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
