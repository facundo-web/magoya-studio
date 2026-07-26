import React, { useState, useRef, useEffect } from 'react'
import PiecePreview from './PiecePreview.jsx'
import { TEMPLATES, MAXCHARS } from '../templates/index.js'
import { variantsFor, activeVariantId } from '../templates/variants.js'
import { checkCopy, checkPiece } from '../lib/copyCheck.js'
import MockupPreview, { MOCKUPS } from './MockupPreview.jsx'
import Icon from '../ui/Icon.jsx'
import { FORMATS_BY_ID, formatsByNetwork, CAROUSEL_FORMATS } from '../formats/registry.js'
import { COLOR_SCHEMES, ACCENTS, WORDMARKS, TEXT_STYLES, GRADIENTS, HIGHLIGHTS } from '../brand/brandKit.js'
import { ALL_OBJECTS, ICONS_BY_ID, ICON_CATEGORIES } from '../brand/iconLibrary.js'
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

/* ---------------- Sección colapsable ---------------- */
function Section({ title, help, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={'sec' + (open ? ' open' : '')}>
      <button className="sec-head" onClick={() => setOpen((o) => !o)}>
        <span className="sec-title">{title}</span>
        {!open && summary ? <span className="sec-sum">{summary}</span> : null}
        <span className={'sec-chev' + (open ? ' open' : '')}><Icon n="chevron" size={13} /></span>
      </button>
      {open && (
        <div className="sec-body">
          {help && <p className="panel-help">{help}</p>}
          {children}
        </div>
      )}
    </div>
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
  onChangeContent, onChangeFormat, onSelectSlide, onAddSlide, onDuplicateSlide, onReorderSlides, onConvertToCarousel, onBackToSingle, onChangeSlideTemplate, onDeleteSlide, onToast,
  elements = [], onAddElement, onDeleteElement,
  templates = TEMPLATES, onSaveTemplate, onShare, onShareReview, onExportFile, onUndo, onRedo, canUndo, canRedo,
}) {
  const [busy, setBusy] = useState(false)
  const [selObj, setSelObj] = useState(null)
  const [selText, setSelText] = useState(null) // eid del texto seleccionado
  const [hoverObj, setHoverObj] = useState(null)
  const [editing, setEditing] = useState(null) // edición de texto in-place
  const [showSafe, setShowSafe] = useState(false)
  const [panelW, setPanelW] = useState(() => {
    try { return JSON.parse(localStorage.getItem('magoya_panels_v1')) || { left: 300, right: 320 } } catch { return { left: 300, right: 320 } }
  })
  const startResize = (side, e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = panelW[side]
    const move = (ev) => {
      const dx = ev.clientX - startX
      const w = Math.max(220, Math.min(480, side === 'left' ? startW + dx : startW - dx))
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
    setObjects(objects.filter((_, idx) => idx !== i)); setSelObj(null)
    // misma regla para TODO lo que se borra: aviso con Deshacer
    onToast('Se quitó «' + nombre + '»', true)
  }
  const objDuplicate = (i) => {
    const o = objects[i]
    if (!o) return
    setObjects([...objects, enCascada(objects, { ...JSON.parse(JSON.stringify(o)) })])
    setSelObj(objects.length)
  }
  const objBringFront = (i) => { const a = [...objects]; const [it] = a.splice(i, 1); a.push(it); setObjects(a); setSelObj(a.length - 1) }
  const objSendBack = (i) => { const a = [...objects]; const [it] = a.splice(i, 1); a.unshift(it); setObjects(a); setSelObj(0) }

  // foto: subir → dataURL (compartido entre panel y overlay)
  const onPhotoFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return onToast('Ese archivo no es una imagen')
    const big = file.size > 8 * 1024 * 1024
    const src = await compressImage(file)
    if (big) onToast('Achicamos la foto para que entre — se ve igual de bien')
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
    } else if (o.kind === 'image' && o.frame) { w = refDim * (o.scale || 0.4); h = w * (o.ratio || 0.6) }
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
      // `pos` no existe acá (venía copiado del drop): sin x/y explícitos esto
      // tiraba ReferenceError y NINGUNA forma se podía agregar tocándola.
      setObjects([...objects, enCascada(objects, { kind: 'shape', shape: icon.shape, tint: 'accent', x: 0.5, y: 0.42, scale: 0.34, rotation: 0, shadow: false, opacity: 1,
        ...(icon.shape === 'badge' ? { text: 'NUEVO' } : {}),
        ...(icon.shape === 'callout' ? { text: '¿Y si el dato ya lo tenías?', tint: '#FFFFFF', shadow: true } : {}),
        ...(icon.shape === 'window' ? { scale: 0.62, ratio: 0.62, shadow: true, text: 'panel.magoya.com', front: true } : {}) })])
      setSelObj(objects.length); closePicker(); return
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
      setObjects([...objects, { kind: 'icon', iconId: icon.id, style: isMark ? 'plain' : 'tile', tint: isMark ? 'accent' : undefined, ...pos, scale: icon.category === 'agro' ? 0.16 : isMark ? 0.34 : 0.3, rotation: isMark ? 0 : -8, shadow: true, opacity: 1 }])
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
      if (e.key === 'Escape') { setSelObj(null); setSelText(null); setEditing(null); return }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '0') { e.preventDefault(); setZoom(0); return }
        if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom((z) => Math.min(4, (z || fitZoom()) * 1.2)); return }
        if (e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(0.1, (z || fitZoom()) * 0.83)); return }
      }
      if (selObj == null || !objects[selObj]) return
      const o = objects[selObj]
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); objRemove(selObj); return }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        objDuplicate(selObj)
        return
      }
      const step = e.shiftKey ? 0.05 : 0.01
      const mv = { ArrowLeft: { x: -step }, ArrowRight: { x: step }, ArrowUp: { y: -step }, ArrowDown: { y: step } }[e.key]
      if (mv) {
        e.preventDefault()
        updateObject(selObj, {
          x: Math.min(1, Math.max(0, (o.x ?? 0.5) + (mv.x || 0))),
          y: Math.min(1, Math.max(0, (o.y ?? 0.5) + (mv.y || 0))),
        }, 'nudge')
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

  const onSelectText = (eid) => { setSelText(eid); setSelObj(null) }
  const [guides, setGuides] = useState({ v: false, h: false })
  // Un texto seleccionado no se veía seleccionado EN LA PIEZA: cambiaba el
  // panel de la derecha y en el lienzo no pasaba nada, así que no sabías si
  // le habías pegado al título o al subtítulo.
  const [textBox, setTextBox] = useState(null)
  useEffect(() => {
    if (!selText || !frameRef.current) { setTextBox(null); return }
    const t = frameRef.current.querySelector(`text[data-eid="${CSS.escape(selText)}"]`)
    if (!t) { setTextBox(null); return }
    const fr = frameRef.current.getBoundingClientRect()
    const r = t.getBoundingClientRect()
    const pad = 6
    setTextBox({
      left: r.left - fr.left - pad, top: r.top - fr.top - pad,
      width: r.width + pad * 2, height: r.height + pad * 2,
    })
  }, [selText, content, format.id, panelW.left, panelW.right])
  const startDrag = (e, i) => {
    e.stopPropagation()
    setSelObj(i); setSelText(null); dragRef.current.i = i
    // sin capturar el puntero, arrastrar rápido hacia el borde soltaba el
    // objeto a mitad de camino (en cualquier editor podés salir y volver)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }
  const onFrameMove = (e) => {
    if (textDragRef.current) {
      const d = Math.hypot(e.clientX - textDragRef.current.x, e.clientY - textDragRef.current.y)
      if (d > 12) {
        textDragRef.current = null
        setPanel(template.freeform ? 'text' : 'style'); setSheet(true)
        onToast('Los textos se ubican con la posición del bloque, no arrastrando')
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
    updateObject(dragRef.current.i, pos, 'drag')
  }
  const endDrag = () => { dragRef.current.i = null; textDragRef.current = null; setGuides({ v: false, h: false }) }
  const onFrameDown = (e) => {
    const t = e.target.closest && e.target.closest('text[data-eid]')
    if (t) {
      const eid = t.getAttribute('data-eid')
      // segundo tap/click sobre el texto ya seleccionado → editar (touch-friendly)
      if (selText === eid) { openTextEditor(t) } else { setSelText(eid); setSelObj(null) }
      // el primer reflejo de cualquiera es arrastrar el título; los textos
      // se ubican con el bloque, así que lo decimos en vez de no hacer nada
      textDragRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    // cualquier click que no caiga sobre un objeto o un texto DESELECCIONA:
    // sin esto nunca se ve la pieza limpia, siempre queda un marco encima.
    if (!e.target.closest('.obj-hit') && !e.target.closest('.rs-handle')) { setSelObj(null); setSelText(null) }
  }
  const onStageDown = (e) => {
    if (e.target.closest('.piece-frame') || e.target.closest('.stage-tools') || e.target.closest('.strip')) return
    setSelObj(null); setSelText(null); setEditing(null)
  }

  // ---- editar texto tocándolo sobre la pieza ----
  const getText = (eid) => {
    if (eid.startsWith('role:')) { const k = eid.slice(5); return content[k] ?? template.defaults?.[k] ?? '' }
    if (eid.startsWith('tb:')) { const i = +eid.slice(3); return (content.textBlocks || [])[i]?.text ?? '' }
    return ''
  }
  const setText = (eid, val) => {
    // escribir es un gesto: una palabra entera es un solo Deshacer
    if (eid.startsWith('role:')) set({ [eid.slice(5)]: val }, 'txt:' + eid)
    else if (eid.startsWith('tb:')) { const i = +eid.slice(3); set({ textBlocks: (content.textBlocks || []).map((b, idx) => (idx === i ? { ...b, text: val } : b)) }, 'txt:' + eid) }
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
  useEffect(() => { setSelObj(null); setSelText(null); setEditing(null) }, [activeSlide, template.id])

  const needsPhoto = template.surface === 'photo' && !content.photo?.src
  // Bloque B — variantes: misma plantilla, otra composición
  const variants = React.useMemo(() => variantsFor(template), [template])
  const activeVar = activeVariantId(template, content)
  // si la plantilla no tiene variantes (chat), el panel no existe

  return (
    <div className={'editor' + (selObj != null || selText ? ' has-sel' : '') + (sheet ? ' sheet-open' : '')}>
      <nav className="insert-rail">
        {[
          ['style', 'grid', 'Estilo'],
          ['text', 'text', 'Texto'],
          ['photos', 'photo', 'Fotos'],
          ['elements', 'sparkle', 'Elementos'],
          ['brand', 'brand', 'Marca'],
          ['settings', 'settings', 'Efectos'],
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
              <TextBlocksBody content={content} set={set} onSelectText={onSelectText} selText={selText} />
              <div className="panel-title" style={{ marginTop: 16 }}>Posición del bloque</div>
              <AnchorBody content={content} template={template} set={set} />
            </>
          ) : (
            <>
              <div className="panel-title">Textos</div>
              <p className="panel-help">Tocá un texto (acá o en la pieza) para editarlo a la derecha.</p>
              <ContentBody template={template} content={content} onSelectText={onSelectText} selText={selText} />
              {(content.steps || template.defaults?.steps) && (
                <>
                  <div className="panel-title" style={{ marginTop: 16 }}>Pasos</div>
                  <StepsBody content={content} template={template} set={set} />
                </>
              )}
            </>
          )
        )}

        {panel === 'photos' && (
          <>
            <div className="panel-title">Fotos</div>
            {/* Antes había DOS paneles con la misma biblioteca y dos
                resultados distintos (fondo vs objeto encima): había que
                aprender la distinción para saber a cuál entrar. Ahora es
                uno solo y la pregunta se hace en el momento. */}
            <FotosBody content={content} template={template} set={set}
              inputRef={photoInputRef} onPhotoFile={onPhotoFile}
              objects={objects} setObjects={setObjects} setSelObj={setSelObj}
              elements={elements} onAddElement={onAddElement} onDeleteElement={onDeleteElement} onToast={onToast} />
          </>
        )}

        {panel === 'elements' && (
          <>
            <div className="panel-title">Elementos</div>
            <p className="panel-help">Tocá o arrastrá a la pieza. Logos, trazos, dispositivos y los tuyos.</p>
            <ObjectsBody objects={objects} setObjects={setObjects}
              selObj={selObj} setSelObj={setSelObj} objRemove={objRemove} onToast={onToast}
              elements={elements} onAddElement={onAddElement} onDeleteElement={onDeleteElement}
              alwaysOpen />
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
            <div className="panel-title">Dónde se publica</div>
            <p className="panel-help">Cambiá el tamaño según dónde publiques. La pieza se re-acomoda sola.</p>
            <FormatBody format={format} onChangeFormat={onChangeFormat} />
            <div className="panel-title" style={{ marginTop: 16 }}>Tono de la pieza</div>
            <GradientBody content={content} set={set} />
            <div className="panel-title" style={{ marginTop: 16 }}>Efectos de la pieza</div>
            <Ctl label="Oscurecer los bordes" value={Math.round((content.vignette ?? 0) * 100)} min={0} max={80} onChange={(v) => set({ vignette: v / 100 })} />
            <Ctl label="Oscurecer el fondo" value={Math.round((content.photoDim ?? 0) * 100)} min={0} max={70} onChange={(v) => set({ photoDim: v / 100 })} />
            <Ctl label="Desenfocar el fondo" value={Math.round(content.photoBlur ?? 0)} min={0} max={30} onChange={(v) => set({ photoBlur: v })} />
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
          <DownloadMenu template={template} content={content} format={format} slides={slides} busy={busy} setBusy={setBusy} onToast={onToast} />
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
          >
            <PiecePreview template={template} content={content} format={format} />
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
                  className={'obj-hit' + (selObj === i ? ' sel' : '') + (hoverObj === i ? ' hover' : '')}
                  style={{ left: bx.left + '%', top: bx.top + '%', width: bx.w + '%', height: bx.h + '%', transform: `rotate(${bx.rot}deg)` }}
                  onMouseEnter={() => setHoverObj(i)} onMouseLeave={() => setHoverObj(null)}
                  onPointerDown={(e) => startDrag(e, i)}>
                  {selObj === i && ['nw', 'ne', 'sw', 'se'].map((c) => (
                    <span key={c} className={'rs-handle ' + c} onPointerDown={(e) => startHandleResize(e, i, c)} />
                  ))}
                  {selObj === i && (
                    <span className="rot-handle" title="Girar · con Shift salta de 15 en 15"
                      onPointerDown={(e) => startRotate(e, i)}><Icon n="rotate" size={13} /></span>
                  )}
                </div>
              )
            })}
            {textBox && <div className="text-sel" style={{ left: textBox.left, top: textBox.top, width: textBox.width, height: textBox.height }} />}
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
            {selObj != null && objects[selObj] && (
              <div className="drag-hint">Arrastrá para ubicar el objeto</div>
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
                <PiecePreview template={s.template} content={s.content} format={format} />
                <span className="sn">{i + 1}</span>
              </button>
            ))}
            <button className="add" onClick={() => onAddSlide()} title="Agregar slide en blanco (componer con bloques)">+</button>
            {onDuplicateSlide && <button className="btn" style={{ marginLeft: 8 }} onClick={onDuplicateSlide} title="Duplica esta slide para continuar la historia (ej: el chat que sigue)"><Icon n="copy" size={15} /> Duplicar slide</button>}
            <button className="btn" onClick={() => setChooser('add')}>Desde plantilla</button>
            <button className="btn" onClick={() => setChooser('change')}>Cambiar diseño</button>
            {slides.length > 1 && <button className="btn" onClick={() => onDeleteSlide(activeSlide)}>Borrar slide</button>}
          </div>
        )}

        {chooser && (
          <div className="chooser-ov" onClick={() => setChooser(null)}>
            <div className="chooser" onClick={(e) => e.stopPropagation()}>
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
            </div>
          </div>
        )}
      </div>

      {shareOpen && (
        <ShareModal onClose={() => setShareOpen(false)} onShare={onShare} onShareReview={onShareReview}
          onExportFile={onExportFile} mockup={mockup} setMockup={setMockup} />
      )}

      {mockupOpen && (
        <div className="mk-modal-ov" onClick={() => setMockupOpen(false)}>
          <div className="mk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mk-modal-head">
              <div className="mk-tabs">
                {MOCKUPS.map((m) => (
                  <button key={m.k} className={mockup === m.k ? 'on' : ''} onClick={() => setMockup(m.k)}>{m.label}</button>
                ))}
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
            <div className="mk-stage"><MockupPreview template={template} content={content} format={format} mockup={mockup} dark={mkDark} safeZones={mkSafe} /></div>
          </div>
        </div>
      )}

      <div className="col-resize" onPointerDown={(e) => startResize('right', e)} title="Arrastrá para ajustar el panel" />

      <aside className="inspector" style={{ width: panelW.right }}>
        <button className="sheet-close" onClick={() => { setSelObj(null); setSelText(null) }} aria-label="Cerrar propiedades"><Icon n="down" size={18} /></button>
        {selObj != null && objects[selObj] ? (
          <>
            <div className="insp-kicker">Propiedades del elemento</div>
            <ObjectProps o={objects[selObj]} i={selObj} updateObject={updateObject} objRemove={objRemove} objBringFront={objBringFront} objSendBack={objSendBack} onToast={onToast} goToBg={() => setPanel('photos')} />
          </>
        ) : selText ? (
          <>
            <div className="insp-kicker">Propiedades del texto</div>
            <TextProps eid={selText} content={content} set={set} getText={getText} setText={setText} />
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
function ContentBody({ template, content, onSelectText, selText }) {
  const roles = template.roles || []
  return (
    <>
      <div className="obj-list">
        {roles.map((role) => {
          const eid = `role:${role}`
          const val = content[role] ?? template.defaults?.[role] ?? ''
          return (
            <button key={role} className={'obj-row txt-row' + (selText === eid ? ' sel' : '')} onClick={() => onSelectText(eid)}>
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
function FotosBody({ content, template, set, inputRef, onPhotoFile, objects, setObjects, setSelObj, elements, onAddElement, onDeleteElement, onToast }) {
  const admiteFondo = template.surface === 'photo' || template.freeform
  const [destino, setDestino] = useState(admiteFondo ? 'fondo' : 'encima')
  const misFotos = (elements || []).filter((e) => e.kind === 'photo')

  const ponerFondo = async (src) => {
    const natural = await imageSize(src)
    set({ bg: 'photo', photo: { src, natural, focal: content.photo?.focal || { x: 0.5, y: 0.5 } } })
  }
  const ponerEncima = async (src, elementId, label) => {
    const natural = await imageSize(src)
    setObjects([...objects, enCascada(objects, { kind: 'image', src, elementId, label, natural, x: 0.5, y: 0.5, scale: 0.5, rotation: 0, shadow: false, opacity: 1 })])
    setSelObj(objects.length)
  }
  const usar = (src, elementId, label) => (destino === 'fondo' && admiteFondo ? ponerFondo(src) : ponerEncima(src, elementId, label))
  const subir = async (file) => {
    if (!file || !file.type.startsWith('image/')) return onToast('Ese archivo no es una imagen')
    const src = await compressImage(file, destino === 'fondo' ? 2048 : OBJ_MAX)
    const nice = file.name.replace(/\.[^.]+$/, '')
    let elementId
    if (onAddElement) elementId = onAddElement({ name: nice, src, kind: 'photo' })?.id
    usar(src, elementId, nice)
  }

  return (
    <>
      {admiteFondo && (
        <div className="field">
          <label>¿Dónde va la foto?</label>
          <div className="chips">
            <button className={'chip' + (destino === 'fondo' ? ' on' : '')} onClick={() => setDestino('fondo')}>De fondo</button>
            <button className={'chip' + (destino === 'encima' ? ' on' : '')} onClick={() => setDestino('encima')}>Encima de la pieza</button>
          </div>
        </div>
      )}
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
                <img src={el.src} alt={el.name} onClick={() => usar(el.src, el.id, el.name)} />
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
            onClick={async () => usar(await fetchCompressed(p.url, destino === 'fondo' ? 2048 : OBJ_MAX), undefined, p.label)}>
            <img src={p.url} alt={p.label} loading="lazy" />
          </button>
        ))}
      </div>

      {/* ajustes de la foto de FONDO, sólo si hay una puesta */}
      {content.photo?.src && admiteFondo && (
        <>
          <div className="panel-title" style={{ marginTop: 18 }}>La foto de fondo</div>
          <div className="field">
            <label>Color de la foto</label>
            <div className="chips">
              <button className={'chip' + ((content.treatment || 'bw') === 'bw' ? ' on' : '')} onClick={() => set({ treatment: 'bw' })}>Blanco y negro</button>
              <button className={'chip' + (content.treatment === 'color' ? ' on' : '')} onClick={() => set({ treatment: 'color' })}>Color</button>
            </div>
          </div>
          <label>Encuadre (arrastrá el punto)</label>
          <Pad2D x={content.photo.focal?.x ?? 0.5} y={content.photo.focal?.y ?? 0.5}
            onChange={(f) => set({ photo: { ...content.photo, focal: f } })} />
          <CutoutButton src={content.photo.src} onToast={onToast}
            onDone={(src, natural) => set({ photo: { ...content.photo, src, natural } })} />
        </>
      )}
      {admiteFondo && content.photo?.src && (
        <button className="btn" style={{ marginTop: 10 }} onClick={() => set({ photo: null, bg: 'color' })}>Sacar la foto de fondo</button>
      )}
    </>
  )
}

/* ---------------- Photo ---------------- */

/* ---------------- Quitar fondo (recorte IA, 100% en el navegador) ------------- */
function CutoutButton({ src, onDone, onToast }) {
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const run = async () => {
    setBusy(true); setPct(0)
    onToast && onToast('Quitando el fondo… la primera vez tarda un poco')
    try {
      const out = await removeBackground(src, setPct)
      const natural = await imageSize(out)
      onDone(out, natural)
      onToast && onToast('✓ Fondo quitado')
    } catch (e) {
      console.error(e)
      onToast && onToast('⚠ No se pudo quitar el fondo')
    } finally { setBusy(false) }
  }
  return (
    <button className="btn" style={{ marginTop: 8, width: '100%' }} onClick={run} disabled={busy}
      title="Recorta la persona u objeto y deja el fondo transparente">
      {busy ? `Quitando fondo… ${pct}%` : <><Icon n="scissors" size={15} /> Quitar fondo</>}
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
        <div className="field" style={{ marginTop: 10 }}><label>Intensidad</label>
          <input className="range" type="range" min="0.2" max="1" step="0.05" value={g.opacity ?? 1}
            onChange={(e) => set({ gradient: { ...g, opacity: +e.target.value } })} /></div>
      )}
    </>
  )
}

/* ---------------- Objects: insertar + lista (izquierda) ---------------- */
function ObjectsBody({ objects, setObjects, selObj, setSelObj, objRemove, onToast, elements = [], onAddElement, onDeleteElement, alwaysOpen = false }) {
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
        ...(icon.shape === 'window' ? { scale: 0.62, ratio: 0.62, shadow: true, text: 'panel.magoya.com', front: true } : {}) })])
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
    const src = await compressImage(file, OBJ_MAX)
    let elementId
    const nice = file.name.replace(/\.[^.]+$/, '')
    if (onAddElement) { const el = onAddElement({ name: nice, src }); elementId = el?.id }
    placeImage(src, elementId, nice)
  }
  const iconsInCat = cat === 'custom' ? [] : ALL_OBJECTS.filter((i) => i.category === cat)

  return (
    <>
      {objects.length > 0 && (
        <div className="obj-list">
          {objects.map((o, i) => {
            const oi = (o.kind === 'icon' || o.kind === 'device') ? ICONS_BY_ID[o.iconId || o.deviceId] : null
            return (
              <div key={i} className={'obj-row' + (selObj === i ? ' sel' : '')}>
                <button className="obj-row-name" onClick={() => setSelObj(i)}><span className={'row-dot' + (selObj === i ? ' on' : '')} />{objectName(o, oi)}</button>
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
                      style={(asset || icon.isShape) ? undefined : { background: icon.color }}
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
  return (
    <div className="ictl">
      <div className="ictl-top">
        <label>{label}</label>
        <input className="ictl-num" type="number" min={min} max={max} step={step} value={Math.round(value)}
          onChange={(e) => e.target.value !== '' && onChange(clamp(+e.target.value))} />
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

/* ---------------- Fotos: insertar sobre la pieza (con recorte) ---------------- */
function PhotosBody({ objects, setObjects, setSelObj, elements = [], onAddElement, onDeleteElement, onToast }) {
  const fileRef = useRef(null)
  const misFotos = elements.filter((e) => e.kind === 'photo')

  // `label` = cómo se llama en el inspector; sin esto toda foto decía "Imagen"
  const place = async (src, elementId, label) => {
    const natural = await imageSize(src)
    setObjects([...objects, enCascada(objects, { kind: 'image', src, elementId, label, natural, x: 0.5, y: 0.5, scale: 0.5, rotation: 0, shadow: false, opacity: 1 })])
    setSelObj(objects.length)
  }
  const upload = async (file) => {
    if (!file || !file.type.startsWith('image/')) return onToast('Ese archivo no es una imagen')
    const src = await compressImage(file, OBJ_MAX)
    const nice = file.name.replace(/\.[^.]+$/, '')
    let elementId
    if (onAddElement) elementId = onAddElement({ name: nice, src, kind: 'photo' })?.id
    place(src, elementId, nice)
  }
  const useLib = async (url, label) => {
    place(await fetchCompressed(url), undefined, label)
  }

  return (
    <>
      <div className="dropzone" onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && upload(e.dataTransfer.files[0]) }}>
        Subí una foto o arrastrala acá
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />

      {misFotos.length > 0 && (
        <>
          <label style={{ marginTop: 12 }}>Mis fotos</label>
          <div className="photo-lib">
            {misFotos.map((el) => (
              <div key={el.id} className="photo-lib-item wrap" title={el.name}>
                <img src={el.src} alt={el.name} onClick={() => place(el.src, el.id, el.name)}
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
          <button key={p.slug} className="photo-lib-item" title={p.label} onClick={() => useLib(p.url, p.label)}>
            <img src={p.url} alt={p.label} loading="lazy" />
          </button>
        ))}
      </div>
      <div className="hint">Después de ponerla, usá <b>✂ Quitar fondo</b> en el panel de la derecha para recortar la persona u objeto.</div>
    </>
  )
}

/* ---------------- Object properties (panel derecho / inspector) ---------------- */
function ObjectProps({ o, i, updateObject, objRemove, objBringFront, objSendBack, onToast, goToBg }) {
  const objIcon = (o.kind === 'icon' || o.kind === 'device') ? ICONS_BY_ID[o.iconId || o.deviceId] : null
  const isMark = !!objIcon?.isMark
  const showTint = o.kind === 'icon' && (isMark || o.style === 'plain')
  const devPhotoRef = useRef(null)
  const setDevPhoto = async (src) => {
    const natural = await imageSize(src)
    updateObject(i, { src, natural })
  }
  const onDevFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const src = await blobToCompressed(file)
    setDevPhoto(src)
  }
  const useLibPhoto = async (url) => {
    setDevPhoto(await fetchCompressed(url))
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
              <button key={p.slug} className="photo-lib-item" title={p.label} onClick={() => useLibPhoto(p.url)}>
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
            onDone={(src, natural) => updateObject(i, { src, natural, shadow: false, cutout: true })} />
          {o.cutout && goToBg && (
            <div className="cutout-next">
              Recortado ✓ — ahora ponele un fondo
              <button className="btn" onClick={goToBg}>Elegir fondo →</button>
            </div>
          )}
        </>
      )}
      {o.kind === 'device' && o.src && (
        <CutoutButton src={o.src} onToast={onToast}
          onDone={(src, natural) => updateObject(i, { src, natural })} />
      )}
      {o.kind === 'image' && !o.frame && (
        <>
          <label>Efecto (para fotos con el fondo quitado)</label>
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
      {o.kind === 'shape' && (
        <>
          {o.shape === 'window' && (
            <>
              <label>Captura</label>
              <div className={'dropzone' + (o.src ? ' has' : '')} onClick={() => devPhotoRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && onDevFile(e.dataTransfer.files[0]) }}>
                {o.src ? '✓ Captura cargada — click para cambiar' : 'Subí la captura (entra sola en la ventana)'}
              </div>
              <input ref={devPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && onDevFile(e.target.files[0])} />
              <Ctl label="Proporción" value={Math.round((o.ratio || 0.62) * 100)} min={40} max={120} suffix="%" onChange={(v) => updateObject(i, { ratio: v / 100 }, 'ratio')} />
            </>
          )}
          {(o.shape === 'badge' || o.shape === 'callout' || o.shape === 'window') && (
            <div className="field"><label>{o.shape === 'window' ? 'Barra de la ventana' : 'Texto'}</label>
              <input type="text" value={o.text || ''} onChange={(e) => updateObject(i, { text: e.target.value })} /></div>
          )}
          {(o.shape === 'bars' || o.shape === 'sparkline') && (
            <div className="field"><label>Valores (separados por coma)</label>
              <input type="text" value={(o.values || [3, 5, 4, 7, 9]).join(', ')}
                onChange={(e) => updateObject(i, { values: e.target.value.split(',').map((v) => +v.trim() || 0).filter((v) => v >= 0) })} /></div>
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
      {o.kind === 'icon' && (objIcon?.category === 'agro' || objIcon?.category === 'trazos') && (
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
          <button key={k} className={'posdot' + (Math.abs((o.x ?? 0.5) - px) < 0.02 && Math.abs((o.y ?? 0.5) - py) < 0.02 ? ' on' : '')} onClick={() => updateObject(i, { x: px, y: py })} title="Ubicar acá" />
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
      <label>Reflejar</label>
      <div className="chips" style={{ marginBottom: 10 }}>
        <button className={'chip' + (o.flipX ? ' on' : '')} onClick={() => updateObject(i, { flipX: !o.flipX })} title="Espeja el elemento (útil para que una flecha apunte al otro lado)"><Icon n="flipH" size={14} /> Horizontal</button>
        <button className="chip" onClick={() => updateObject(i, { rotation: ((o.rotation || 0) + 180) % 360 > 180 ? ((o.rotation || 0) + 180) - 360 : (o.rotation || 0) + 180 })} title="Gira 180°"><Icon n="flipV" size={14} /> Vertical</button>
      </div>
      {/* la gente piensa en "cuánto se transparenta", no en "cuánta opacidad" */}
      <Ctl label="Transparencia" value={Math.round((1 - (o.opacity ?? 1)) * 100)} min={0} max={90} step={5} suffix="%"
        onChange={(v) => updateObject(i, { opacity: 1 - v / 100 }, 'op')} />
      <label>Sombra</label>
      <div className="chips">
        <button className={'chip' + (o.shadow !== false ? ' on' : '')} onClick={() => updateObject(i, { shadow: true })}>Con sombra</button>
        <button className={'chip' + (o.shadow === false ? ' on' : '')} onClick={() => updateObject(i, { shadow: false })}>Sin sombra</button>
      </div>
    </>
  )
}

// Nombre exacto de lo que hay seleccionado: antes casi todo decía "Logo".
function objectName(o, icon) {
  if (!o) return 'Elemento'
  if (o.kind === 'shape') return SHAPE_NAMES[o.shape] || 'Forma'
  if (o.kind === 'device') return icon?.label ? `Dispositivo · ${icon.label}` : 'Dispositivo'
  if (o.kind === 'image') {
    if (o.cutout) return o.label ? `Recorte · ${o.label}` : 'Recorte (fondo quitado)'
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

/* ---------------- Brand ---------------- */
function BrandBody({ content, template, set, onlyColors = false, soloLogo = false }) {
  const scheme = content.scheme || template.defaults?.scheme || 'deep'
  const accent = content.accent || template.defaults?.accent || 'emerald'
  const logo = content.logo || template.defaults?.logo || 'cream'
  // en las piezas en blanco con fondo de color, el color vive acá (los
  // colores son marca); antes estaba en un panel "Fondo" aparte
  if (soloLogo) return <LogoBody content={content} template={template} set={set} />
  if (onlyColors) {
    return (
      <>
        <div className="field"><label>Color de fondo</label>
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
      <div className="field"><label>Color de fondo</label>
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
      <div className="field"><label>Logo Magoya</label>
        <LogoSwatches content={content} template={template} set={set} logo={logo} />
      </div>
      <div className="field" style={{ display: 'none' }}>
        <select value={logo} onChange={(e) => set({ logo: e.target.value })}>
          {Object.entries(WORDMARKS).map(([k, w]) => (<option key={k} value={k}>{w.label}</option>))}
        </select>
      </div>
      <LogoPosition content={content} template={template} set={set} />
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


function TextBlocksBody({ content, set, onSelectText, selText }) {
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
            <div key={i} className={'obj-row' + (selText === eid ? ' sel' : '')}>
              <button className="obj-row-name txt-row" onClick={() => onSelectText && onSelectText(eid)}>
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

/* ---------------- Text properties (panel derecho / inspector) ---------------- */
function TextProps({ eid, content, set, getText, setText }) {
  const isTb = eid.startsWith('tb:')
  const idx = isTb ? +eid.slice(3) : -1
  const block = isTb ? (content.textBlocks || [])[idx] : null
  const val = getText(eid)
  const updateBlock = (patch) => set({ textBlocks: (content.textBlocks || []).map((b, i) => (i === idx ? { ...b, ...patch } : b)) })
  return (
    <>
      <div className="insp-head"><span className="insp-name">Texto</span></div>
      <label>Contenido</label>
      <textarea value={val} onChange={(e) => setText(eid, e.target.value)} rows={2} />
      {(() => {
        const role = isTb ? (block?.style || 'title') : eid.slice(5)
        const max = MAXCHARS[role]
        if (!max) return null
        const n = String(val || '').length
        return <div className={'charcount' + (n > max ? ' over' : '')}>{n}/{max} {n > max ? '· se va a achicar' : ''}</div>
      })()}
      {/* F3 · reglas editoriales: avisa, no bloquea */}
      {(() => {
        const role = isTb ? (block?.style || 'title') : eid.slice(5)
        const notes = checkCopy(role, val, content)
        if (!notes.length) return null
        return <ul className="copy-notes">{notes.map((m, i) => <li key={i}>{m}</li>)}</ul>
      })()}
      {isTb && block ? (
        <>
          <label>Estilo</label>
          <select value={block.style || 'title'} onChange={(e) => updateBlock({ style: e.target.value })}>
            {TEXT_STYLE_OPTS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
          </select>
          {block.style !== 'cta' && (
            <>
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
  return (
    <div className="menu">
      <button className="btn" onClick={() => setOpen((o) => !o)}>Más <span className={'sec-chev chev-menu' + (open ? ' open' : '')}><Icon n="chevron" size={12} /></span></button>
      {open && (
        <div className="menu-pop" onMouseLeave={() => setOpen(false)}>
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
  const run = () => {
    if (pick === 'review') onShareReview && onShareReview(mockup)
    else if (pick === 'show') onShare && onShare(mockup)
    else onExportFile && onExportFile()
    onClose()
  }
  const cur = SHARE_INTENTS.find((i) => i.k === pick)
  return (
    <div className="mk-modal-ov" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
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
function DownloadMenu({ template, content, format, slides, busy, setBusy, onToast }) {
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
  return (
    <div className="menu">
      <button className="btn primary" disabled={busy} onClick={() => setOpen((o) => !o)}>
        {busy
          ? (prog ? `Slide ${prog.hechas} de ${prog.total}…` : 'Generando…')
          : <><Icon n="down" size={16} /> Descargar</>}
      </button>
      {open && (
        <div className="menu-pop" onMouseLeave={() => setOpen(false)}>
          <div className="grp">Recomendado</div>
          <button className="rec" onClick={() => run(() => exportPiece({ template, content, format, kind: 'png', scale: 3 }), 'PNG @3x')}>
            <span>PNG — listo para redes</span><span>@3x</span>
          </button>
          <div className="grp">Otras opciones</div>
          <button onClick={() => run(() => exportPiece({ template, content, format, kind: 'png', scale: 2 }), 'PNG @2x')}><span>PNG más liviano</span><span>@2x</span></button>
          <button onClick={() => run(() => exportPiece({ template, content, format, kind: 'jpg', scale: 2 }), 'JPG')}><span>JPG</span><span>@2x</span></button>
          <button onClick={() => run(() => exportPiece({ template, content, format, kind: 'svg' }), 'SVG')}><span>SVG — vectorial</span><span>∞</span></button>
          {isCarousel && (
            <>
              <div className="grp">Carrusel ({slides.length} slides)</div>
              <button onClick={() => run(() => exportCarousel({ slides, format, kind: 'zip', scale: 3, onProgress }), 'ZIP de PNGs')}><span>ZIP de PNGs</span><span>@3x</span></button>
              <button onClick={() => run(() => exportCarousel({ slides, format, kind: 'pdf', scale: 2, onProgress }), 'PDF')}><span>PDF</span><span>multipágina</span></button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
