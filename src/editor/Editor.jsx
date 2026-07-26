import React, { useState, useRef, useEffect } from 'react'
import PiecePreview from './PiecePreview.jsx'
import { TEMPLATES, MAXCHARS } from '../templates/index.js'
import MockupPreview, { MOCKUPS } from './MockupPreview.jsx'
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
import { exportPiece, exportCarousel } from '../engine/export.js'

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
const SHAPE_NAMES = { arrow: 'Flecha gruesa', handArrow: 'Flecha a mano', sparkle: 'Destello', badge: 'Etiqueta', bars: 'Barras', sparkline: 'Curva', callout: 'Bocadillo' }

const POS_GRID = [
  [0.22, 0.2], [0.5, 0.2], [0.78, 0.2],
  [0.22, 0.5], [0.5, 0.5], [0.78, 0.5],
  [0.22, 0.8], [0.5, 0.8], [0.78, 0.8],
]

/* ---------------- Sección colapsable ---------------- */
function Section({ title, help, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={'sec' + (open ? ' open' : '')}>
      <button className="sec-head" onClick={() => setOpen((o) => !o)}>
        <span className="sec-title">{title}</span>
        {!open && summary ? <span className="sec-sum">{summary}</span> : null}
        <span className="sec-chev">{open ? '▾' : '▸'}</span>
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

export default function Editor({
  template, format, content, slides, activeSlide,
  onChangeContent, onChangeFormat, onSelectSlide, onAddSlide, onDuplicateSlide, onConvertToCarousel, onBackToSingle, onChangeSlideTemplate, onDeleteSlide, onToast,
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
  const [mockup, setMockup] = useState('phone')
  const [mkDark, setMkDark] = useState(false)
  const [panel, setPanel] = useState('text') // rail de inserción: un panel a la vez
  const frameRef = useRef(null)
  const photoInputRef = useRef(null)
  const dragRef = useRef({ i: null })

  const isCarousel = slides && slides.length > 0
  const canCarousel = CAROUSEL_FORMATS.includes(format.id)

  const set = (patch) => onChangeContent({ ...content, ...patch })
  const objects = content.objects || []
  const setObjects = (next) => set({ objects: next })
  const updateObject = (i, patch) => setObjects(objects.map((o, idx) => (idx === i ? { ...o, ...patch } : o)))
  const objRemove = (i) => { setObjects(objects.filter((_, idx) => idx !== i)); setSelObj(null) }
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
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }
  // caja aprox del objeto en % de la pieza (para el área de selección)
  const refDim = Math.min(format.w, format.h)
  const objBox = (o) => {
    let w, h
    if (o.kind === 'device') {
      const dev = ICONS_BY_ID[o.deviceId]
      w = refDim * (o.scale || 0.5); h = w / (dev?.screen?.ratio || 1)
    } else if (o.kind === 'image' && o.frame) { w = refDim * (o.scale || 0.4); h = w * (o.ratio || 0.6) }
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
      setObjects([...objects, { kind: 'shape', shape: icon.shape, tint: 'accent', ...pos, scale: 0.3, rotation: 0, shadow: false, opacity: 1,
        ...(icon.shape === 'badge' ? { text: 'NUEVO' } : {}) }])
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
      setObjects([...objects, { kind: 'icon', iconId: icon.id, style: isMark ? 'plain' : 'tile', tint: isMark ? 'accent' : undefined, ...pos, scale: isMark ? 0.34 : 0.3, rotation: isMark ? 0 : -8, shadow: true, opacity: 1 }])
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
      if (selObj == null || !objects[selObj]) return
      const o = objects[selObj]
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); objRemove(selObj); return }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setObjects([...objects, { ...o, x: Math.min(1, (o.x ?? 0.5) + 0.05), y: Math.min(1, (o.y ?? 0.5) + 0.05) }])
        setSelObj(objects.length)
        return
      }
      const step = e.shiftKey ? 0.05 : 0.01
      const mv = { ArrowLeft: { x: -step }, ArrowRight: { x: step }, ArrowUp: { y: -step }, ArrowDown: { y: step } }[e.key]
      if (mv) {
        e.preventDefault()
        updateObject(selObj, {
          x: Math.min(1, Math.max(0, (o.x ?? 0.5) + (mv.x || 0))),
          y: Math.min(1, Math.max(0, (o.y ?? 0.5) + (mv.y || 0))),
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // handles de resize: arrastrás una esquina y cambia la escala
  const startHandleResize = (e, i) => {
    e.stopPropagation()
    e.preventDefault()
    const o = objects[i]
    if (!o) return
    const fr = frameRef.current.getBoundingClientRect()
    const cx = fr.left + fr.width * (o.x ?? 0.5)
    const cy = fr.top + fr.height * (o.y ?? 0.5)
    const d0 = Math.hypot(e.clientX - cx, e.clientY - cy)
    const s0 = o.scale || 0.3
    const move = (ev) => {
      const d = Math.hypot(ev.clientX - cx, ev.clientY - cy)
      updateObject(i, { scale: Math.min(1.2, Math.max(0.05, s0 * (d / Math.max(d0, 1)))) })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onSelectText = (eid) => { setSelText(eid); setSelObj(null) }
  const [guides, setGuides] = useState({ v: false, h: false })
  const startDrag = (e, i) => { e.stopPropagation(); setSelObj(i); setSelText(null); dragRef.current.i = i }
  const onFrameMove = (e) => {
    if (dragRef.current.i == null) return
    let pos = posFromEvent(e)
    // snapping al centro (guías)
    const snapV = Math.abs(pos.x - 0.5) < 0.02
    const snapH = Math.abs(pos.y - 0.5) < 0.02
    if (snapV) pos.x = 0.5
    if (snapH) pos.y = 0.5
    setGuides({ v: snapV, h: snapH })
    updateObject(dragRef.current.i, pos)
  }
  const endDrag = () => { dragRef.current.i = null; setGuides({ v: false, h: false }) }
  const onFrameDown = (e) => {
    const t = e.target.closest && e.target.closest('text[data-eid]')
    if (t) {
      const eid = t.getAttribute('data-eid')
      // segundo tap/click sobre el texto ya seleccionado → editar (touch-friendly)
      if (selText === eid) { openTextEditor(t) } else { setSelText(eid); setSelObj(null) }
      return
    }
    if (e.target === frameRef.current || e.target.tagName === 'svg' || e.target.tagName === 'IMAGE') { setSelObj(null); setSelText(null) }
  }

  // ---- editar texto tocándolo sobre la pieza ----
  const getText = (eid) => {
    if (eid.startsWith('role:')) { const k = eid.slice(5); return content[k] ?? template.defaults?.[k] ?? '' }
    if (eid.startsWith('tb:')) { const i = +eid.slice(3); return (content.textBlocks || [])[i]?.text ?? '' }
    return ''
  }
  const setText = (eid, val) => {
    if (eid.startsWith('role:')) set({ [eid.slice(5)]: val })
    else if (eid.startsWith('tb:')) { const i = +eid.slice(3); set({ textBlocks: (content.textBlocks || []).map((b, idx) => (idx === i ? { ...b, text: val } : b)) }) }
  }
  const openTextEditor = (t) => {
    const eid = t.getAttribute('data-eid')
    const fr = frameRef.current.getBoundingClientRect()
    const r = t.getBoundingClientRect()
    const scale = fr.width / format.w
    const fontPx = parseFloat(getComputedStyle(t).fontSize) * scale || 18
    setEditing({
      eid, value: getText(eid),
      left: r.left - fr.left, top: r.top - fr.top,
      width: Math.max(r.width + fontPx, 90), fontPx,
      align: (t.getAttribute('text-anchor') === 'middle') ? 'center' : 'left',
    })
  }
  const onFrameDblClick = (e) => {
    const t = e.target.closest && e.target.closest('text[data-eid]')
    if (t) openTextEditor(t)
  }

  const needsPhoto = template.surface === 'photo' && !content.photo?.src

  return (
    <div className={'editor' + (selObj != null || selText ? ' has-sel' : '')}>
      <nav className="insert-rail">
        {[
          ['text', 'T', 'Texto'],
          ['bg', '▣', 'Fondo'],
          ['photos', '▤', 'Fotos'],
          ['elements', '✳', 'Elementos'],
          ['brand', 'M', 'Marca'],
          ['settings', '⚙', 'Ajustes'],
        ].map(([k, ico, label]) => (
          <button key={k} className={'rail-btn' + (panel === k ? ' on' : '')} onClick={() => setPanel(k)} title={label}>
            <span className="rail-ico">{ico}</span>
            <span className="rail-label">{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar" style={{ width: panelW.left }}>
        <div className="side-head">
          <div className="sh-name">{template.name}</div>
          {template.purpose && <div className="sh-purpose">{template.purpose}</div>}
          <div className="sh-dest">Para <b>{format.network} · {format.label}</b> · {format.w}×{format.h}</div>
        </div>

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

        {panel === 'bg' && (
          template.freeform ? (
            <>
              <div className="panel-title">Fondo</div>
              <BgBody content={content} set={set} inputRef={photoInputRef} onPhotoFile={onPhotoFile} onToast={onToast} />
            </>
          ) : template.surface === 'photo' ? (
            <>
              <div className="panel-title">Foto de fondo</div>
              <p className="panel-help">Subí una foto o elegí de la biblioteca. Sale en B&N (regla de marca).</p>
              <PhotoBody content={content} set={set} inputRef={photoInputRef} onPhotoFile={onPhotoFile} onToast={onToast} />
            </>
          ) : (
            <>
              <div className="panel-title">Fondo</div>
              <p className="panel-help">Esta plantilla usa un color de marca como fondo.</p>
              <BrandBody content={content} template={template} set={set} onlyColors />
            </>
          )
        )}

        {panel === 'photos' && (
          <>
            <div className="panel-title">Fotos</div>
            <p className="panel-help">Poné una foto sobre la pieza. Podés quitarle el fondo para recortar la persona u objeto.</p>
            <PhotosBody objects={objects} setObjects={setObjects} setSelObj={setSelObj}
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
            {template.freeform ? <LogoBody content={content} template={template} set={set} /> : <BrandBody content={content} template={template} set={set} />}
          </>
        )}

        {panel === 'settings' && (
          <>
            <div className="panel-title">Formato / red</div>
            <p className="panel-help">Cambiá el tamaño según dónde publiques. La pieza se re-acomoda sola.</p>
            <FormatBody format={format} onChangeFormat={onChangeFormat} />
            <div className="panel-title" style={{ marginTop: 16 }}>Clima (degradé)</div>
            <GradientBody content={content} set={set} />
            <div className="panel-title" style={{ marginTop: 16 }}>Efectos de la pieza</div>
            <Ctl label="Viñeta (oscurece bordes)" value={Math.round((content.vignette ?? 0) * 100)} min={0} max={80} onChange={(v) => set({ vignette: v / 100 })} />
            <Ctl label="Oscurecer la foto" value={Math.round((content.photoDim ?? 0) * 100)} min={0} max={70} onChange={(v) => set({ photoDim: v / 100 })} />
            <Ctl label="Desenfocar la foto" value={Math.round(content.photoBlur ?? 0)} min={0} max={30} onChange={(v) => set({ photoBlur: v })} />
          </>
        )}
      </div>

      <div className="col-resize" onPointerDown={(e) => startResize('left', e)} title="Arrastrá para ajustar el panel" />

      <div className="stage">
        <div className="stage-tools">
          <span style={{ fontSize: 13, color: '#5C6B61' }}>{format.network} · {format.label} · {format.w}×{format.h}</span>
          {onUndo && (
            <span className="undo-group">
              <button className="btn icon-btn" onClick={onUndo} disabled={!canUndo} title="Deshacer (⌘Z)">↶</button>
              <button className="btn icon-btn" onClick={onRedo} disabled={!canRedo} title="Rehacer (⇧⌘Z)">↷</button>
            </span>
          )}
          <label className="safe-toggle"><input type="checkbox" checked={showSafe} onChange={(e) => setShowSafe(e.target.checked)} /> Ver zona segura</label>
          <div style={{ flex: 1 }} />
          {canCarousel && !isCarousel && <button className="btn" onClick={onConvertToCarousel}>+ Convertir en carrusel</button>}
          {isCarousel && (
            <span className="mode-pill">▦ Carrusel · {slides.length} {slides.length === 1 ? 'slide' : 'slides'}
              {slides.length === 1 && onBackToSingle && <button className="linklike" onClick={onBackToSingle}>Volver a pieza simple</button>}
            </span>
          )}
          <button className="btn" onClick={() => setMockupOpen(true)}>👁 Ver en mockup</button>
          <MoreMenu onSaveTemplate={onSaveTemplate} onShare={onShare} onShareReview={onShareReview ? () => onShareReview(mockup) : undefined} onExportFile={onExportFile} />
          <DownloadMenu template={template} content={content} format={format} slides={slides} busy={busy} setBusy={setBusy} onToast={onToast} />
        </div>

        <div className="stage-canvas">
          <div
            className={'piece-frame' + (selObj != null ? ' dragging-ready' : '')}
            ref={frameRef}
            onPointerDown={onFrameDown}
            onPointerMove={onFrameMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
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
                onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); setEditing(null) } }}
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
                    <span key={c} className={'rs-handle ' + c} onPointerDown={(e) => startHandleResize(e, i)} />
                  ))}
                </div>
              )
            })}
            {guides.v && <div className="guide-v" />}
            {guides.h && <div className="guide-h" />}
            {showSafe && (
              <div className="safe-ov" style={{
                top: `${format.safe.top * 100}%`, bottom: `${format.safe.bottom * 100}%`,
                left: `${format.safe.left * 100}%`, right: `${format.safe.right * 100}%`,
              }} />
            )}
            {needsPhoto && (
              <button className="photo-cta" onClick={() => photoInputRef.current?.click()}>
                <span className="pc-ic">＋</span>
                <span>Subí una foto para empezar</span>
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
              <button key={i} className={'slide-thumb' + (i === activeSlide ? ' on' : '')} onClick={() => onSelectSlide(i)} title={`Slide ${i + 1}`}>
                <PiecePreview template={s.template} content={s.content} format={format} />
              </button>
            ))}
            <button className="add" onClick={() => onAddSlide()} title="Agregar slide en blanco (componer con bloques)">+</button>
            {onDuplicateSlide && <button className="btn" style={{ marginLeft: 8 }} onClick={onDuplicateSlide} title="Duplica esta slide para continuar la historia (ej: el chat que sigue)">⧉ Duplicar slide</button>}
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
                {templates.map((t) => (
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
                <label className="dk-toggle"><input type="checkbox" checked={mkDark} onChange={(e) => setMkDark(e.target.checked)} /> Modo oscuro</label>
                {onShare && <button className="btn" onClick={() => onShare(mockup)} title="Copiá un link para que revisen cómo queda">Copiar link de preview</button>}
                <button className="btn" onClick={() => setMockupOpen(false)}>Cerrar</button>
              </div>
            </div>
            <div className="mk-stage"><MockupPreview template={template} content={content} format={format} mockup={mockup} dark={mkDark} /></div>
          </div>
        </div>
      )}

      <div className="col-resize" onPointerDown={(e) => startResize('right', e)} title="Arrastrá para ajustar el panel" />

      <aside className="inspector" style={{ width: panelW.right }}>
        {selObj != null && objects[selObj] ? (
          <>
            <div className="insp-kicker">Propiedades del elemento</div>
            <ObjectProps o={objects[selObj]} i={selObj} updateObject={updateObject} objRemove={objRemove} objBringFront={objBringFront} objSendBack={objSendBack} onToast={onToast} goToBg={() => setPanel('bg')} />
          </>
        ) : selText ? (
          <>
            <div className="insp-kicker">Propiedades del texto</div>
            <TextProps eid={selText} content={content} set={set} getText={getText} setText={setText} />
          </>
        ) : (
          <div className="insp-empty">
            <div className="insp-empty-ic">☞</div>
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
      <div className="hint">Tocá un texto (acá o en la pieza) → lo editás a la derecha.</div>
    </>
  )
}

/* ---------------- Photo ---------------- */
function PhotoBody({ content, set, inputRef, onPhotoFile, onToast }) {
  const photo = content.photo
  const treatment = content.treatment || 'bw'
  // foto de la biblioteca → dataURL (para que exporte bien) + dims naturales
  const useLibraryPhoto = async (url) => {
    const res = await fetch(url)
    const blob = await res.blob()
    const src = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
    const natural = await imageSize(src)
    set({ photo: { src, natural, focal: content.photo?.focal || { x: 0.5, y: 0.5 } } })
  }
  return (
    <>
      <div className={'dropzone' + (photo?.src ? ' has' : '')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && onPhotoFile(e.dataTransfer.files[0]) }}>
        {photo?.src ? '✓ Foto cargada — click para cambiar' : 'Arrastrá una foto o hacé click'}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && onPhotoFile(e.target.files[0])} />

      <label style={{ fontSize: 11, color: '#4A554D', marginTop: 10, display: 'block' }}>Biblioteca Magoya</label>
      <div className="photo-lib">
        {PHOTOS.map((p) => (
          <button key={p.slug} className="photo-lib-item" title={p.label} onClick={() => useLibraryPhoto(p.url)}>
            <img src={p.url} alt={p.label} loading="lazy" />
          </button>
        ))}
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Tratamiento</label>
        <div className="chips">
          <button className={'chip' + (treatment === 'bw' ? ' on' : '')} onClick={() => set({ treatment: 'bw' })}>B&N (marca)</button>
          <button className={'chip' + (treatment === 'color' ? ' on' : '')} onClick={() => set({ treatment: 'color' })}>Color</button>
        </div>
      </div>
      {photo?.src && <CutoutButton src={photo.src} onDone={(src, natural) => set({ photo: { ...photo, src, natural } })} onToast={onToast} />}

      {photo?.src && (
        <>
          <div className="field"><label>Encuadre horizontal</label>
            <input className="range" type="range" min="0" max="1" step="0.01" value={photo.focal?.x ?? 0.5}
              onChange={(e) => set({ photo: { ...photo, focal: { ...photo.focal, x: +e.target.value } } })} /></div>
          <div className="field"><label>Encuadre vertical</label>
            <input className="range" type="range" min="0" max="1" step="0.01" value={photo.focal?.y ?? 0.5}
              onChange={(e) => set({ photo: { ...photo, focal: { ...photo.focal, y: +e.target.value } } })} /></div>
        </>
      )}
    </>
  )
}

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
      {busy ? `Quitando fondo… ${pct}%` : '✂ Quitar fondo'}
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

  const placeImage = async (src, elementId) => {
    const natural = await imageSize(src)
    setObjects([...objects, { kind: 'image', src, elementId, natural, x: 0.72, y: 0.42, scale: 0.34, rotation: 0, shadow: true, opacity: 1 }])
    setSelObj(objects.length)
  }
  const addIcon = (icon) => {
    // dispositivo: objeto con PANTALLA (la foto va adentro automáticamente)
    if (icon.isShape) {
      setObjects([...objects, { kind: 'shape', shape: icon.shape, tint: 'accent', ...pos, scale: 0.3, rotation: 0, shadow: false, opacity: 1,
        ...(icon.shape === 'badge' ? { text: 'NUEVO' } : {}) }])
      setSelObj(objects.length); return
    }
    if (icon.isDevice) {
      setObjects([...objects, { kind: 'device', deviceId: icon.id, x: 0.5, y: 0.5, scale: 0.55, rotation: 0, shadow: true, opacity: 1, focal: { x: 0.5, y: 0.5 }, zoom: 1 }])
      setSelObj(objects.length)
      setPicking(false)
      return
    }
    if (icon.category === 'magoya' && !icon.isMark) { placeImage(getAsset(icon.url) || icon.url); setPicking(false); return }
    const isMark = !!icon.isMark
    setObjects([...objects, { kind: 'icon', iconId: icon.id, style: isMark ? 'plain' : 'tile', tint: isMark ? 'accent' : undefined, x: 0.72, y: 0.42, scale: isMark ? 0.34 : 0.3, rotation: 0, shadow: false, opacity: 1 }])
    setSelObj(objects.length)
    setPicking(false)
  }
  const addImage = async (file) => {
    if (!file || !file.type.startsWith('image/')) return onToast('No es una imagen')
    const src = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file) })
    let elementId
    if (onAddElement) { const el = onAddElement({ name: file.name.replace(/\.[^.]+$/, ''), src }); elementId = el?.id }
    placeImage(src, elementId)
  }
  const iconsInCat = cat === 'custom' ? [] : ALL_OBJECTS.filter((i) => i.category === cat)

  return (
    <>
      {objects.length > 0 && (
        <div className="obj-list">
          {objects.map((o, i) => {
            const oi = o.kind === 'icon' ? ICONS_BY_ID[o.iconId] : null
            return (
              <div key={i} className={'obj-row' + (selObj === i ? ' sel' : '')}>
                <button className="obj-row-name" onClick={() => setSelObj(i)}>{selObj === i ? '◉ ' : '○ '}{o.kind === 'image' ? 'PNG / foto' : (oi?.label || 'Logo')}</button>
                <button className="obj-row-del" onClick={() => objRemove(i)} title="Quitar">✕</button>
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
                <button className="icon-pick upload" title="Subir un elemento" onClick={() => fileRef.current?.click()}><span>＋</span></button>
                {elements.filter((e) => e.kind !== 'photo').map((el) => (
                  <div key={el.id} className="icon-pick custom" title={el.name + ' — tocá o arrastrá a la pieza'}
                    draggable onDragStart={(e) => e.dataTransfer.setData('application/x-magoya', JSON.stringify({ type: 'element', id: el.id }))}>
                    <img src={el.src} alt={el.name} onClick={() => placeImage(el.src, el.id)} />
                    <button className="el-del" title="Quitar de la biblioteca" onClick={(e) => { e.stopPropagation(); onDeleteElement && onDeleteElement(el.id) }}>✕</button>
                  </div>
                ))}
              </div>
              {elements.filter((e) => e.kind !== 'photo').length === 0 && <div className="hint">Subí logos o elementos (PNG/SVG). Las fotos van en el panel <b>Fotos</b>.</div>}
            </>
          ) : (
            <>
              <div className="icon-grid">
                {iconsInCat.map((icon) => {
                  const asset = icon.isDevice || icon.category === 'magoya'
                  return (
                    <button key={icon.id} title={icon.label + ' — tocá o arrastrá a la pieza'} onClick={() => addIcon(icon)}
                      className={'icon-pick' + (asset ? ' asset' : '') + (icon.isShape ? ' shape' : '')}
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

  const place = async (src, elementId) => {
    const natural = await imageSize(src)
    setObjects([...objects, { kind: 'image', src, elementId, natural, x: 0.5, y: 0.5, scale: 0.5, rotation: 0, shadow: false, opacity: 1 }])
    setSelObj(objects.length)
  }
  const upload = async (file) => {
    if (!file || !file.type.startsWith('image/')) return onToast('Ese archivo no es una imagen')
    const src = await compressImage(file)
    let elementId
    if (onAddElement) elementId = onAddElement({ name: file.name.replace(/\.[^.]+$/, ''), src, kind: 'photo' })?.id
    place(src, elementId)
  }
  const useLib = async (url) => {
    const blob = await (await fetch(url)).blob()
    const src = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
    place(src)
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
                <img src={el.src} alt={el.name} onClick={() => place(el.src, el.id)}
                  draggable onDragStart={(e) => e.dataTransfer.setData('application/x-magoya', JSON.stringify({ type: 'element', id: el.id }))} />
                <button className="el-del" title="Quitar de mis fotos" onClick={(e) => { e.stopPropagation(); onDeleteElement && onDeleteElement(el.id) }}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      <label style={{ marginTop: 12 }}>Biblioteca Magoya</label>
      <div className="photo-lib">
        {PHOTOS.map((p) => (
          <button key={p.slug} className="photo-lib-item" title={p.label} onClick={() => useLib(p.url)}>
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
    const src = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file) })
    setDevPhoto(src)
  }
  const useLibPhoto = async (url) => {
    const res = await fetch(url); const blob = await res.blob()
    const src = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
    setDevPhoto(src)
  }
  return (
    <>
      <div className="insp-head">
        <span className="insp-name">{o.kind === 'shape' ? (SHAPE_NAMES[o.shape] || 'Forma') : o.kind === 'device' ? (objIcon?.label || 'Dispositivo') : o.kind === 'image' ? 'PNG / foto' : (objIcon?.label || 'Logo')}</span>
        <button className="btn" style={{ padding: '2px 8px' }} onClick={() => objRemove(i)}>Quitar</button>
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
          <button className={'chip' + (o.style !== 'plain' ? ' on' : '')} onClick={() => updateObject(i, { style: 'tile' })}>Con fondo (app-icon)</button>
          <button className={'chip' + (o.style === 'plain' ? ' on' : '')} onClick={() => updateObject(i, { style: 'plain' })}>Sin fondo</button>
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
          <label>Efecto (para recortes)</label>
          <div className="chips" style={{ marginBottom: 8 }}>
            {[['none', 'Ninguno'], ['outline', 'Contorno'], ['glow', 'Glow'], ['hard', 'Sombra dura']].map(([k, l]) => (
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
            <button className={'chip' + (!o.frame ? ' on' : '')} onClick={() => updateObject(i, { frame: false })}>Imagen libre</button>
            <button className={'chip' + (o.frame ? ' on' : '')} onClick={() => updateObject(i, { frame: true, ratio: o.ratio || 0.62 })} title="Recortá la imagen en un marco, ej: dentro de una pantalla">Recorte / pantalla</button>
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
          {(o.shape === 'badge' || o.shape === 'callout') && (
            <div className="field"><label>Texto</label>
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
        </>
      )}
      <label>Profundidad</label>
      <div className="chips" style={{ marginBottom: 6 }}>
        <button className={'chip' + (!o.front ? ' on' : '')} onClick={() => updateObject(i, { front: false })}>Detrás del texto</button>
        <button className={'chip' + (o.front ? ' on' : '')} onClick={() => updateObject(i, { front: true })}>Delante del texto</button>
      </div>
      <div className="chips" style={{ marginBottom: 10 }}>
        <button className="chip" onClick={() => objBringFront(i)}>↑ Traer al frente</button>
        <button className="chip" onClick={() => objSendBack(i)}>↓ Enviar al fondo</button>
      </div>
      <label>Posición</label>
      <div className="posgrid">
        {POS_GRID.map(([px, py], k) => (
          <button key={k} className={'posdot' + (Math.abs((o.x ?? 0.5) - px) < 0.02 && Math.abs((o.y ?? 0.5) - py) < 0.02 ? ' on' : '')} onClick={() => updateObject(i, { x: px, y: py })} title="Ubicar acá" />
        ))}
      </div>
      <Ctl label="Tamaño" value={Math.round((o.scale ?? 0.3) * 100)} min={5} max={120} suffix="%" onChange={(v) => updateObject(i, { scale: v / 100 })} />
      <div className="ictl">
        <div className="ictl-top">
          <label>Rotación</label>
          <input className="ictl-num" type="number" min={-45} max={45} value={Math.round(o.rotation || 0)}
            onChange={(e) => e.target.value !== '' && updateObject(i, { rotation: Math.min(45, Math.max(-45, +e.target.value)) })} />
        </div>
        <div className="chips" style={{ marginTop: 6 }}>
          {[-15, 0, 15].map((d) => (
            <button key={d} className={'chip' + ((o.rotation || 0) === d ? ' on' : '')} onClick={() => updateObject(i, { rotation: d })}>{d > 0 ? `+${d}°` : `${d}°`}</button>
          ))}
        </div>
      </div>
      <Ctl label="Opacidad" value={Math.round((o.opacity ?? 1) * 100)} min={10} max={100} step={5} suffix="%" onChange={(v) => updateObject(i, { opacity: v / 100 })} />
      <label>Sombra (profundidad)</label>
      <div className="chips">
        <button className={'chip' + (o.shadow !== false ? ' on' : '')} onClick={() => updateObject(i, { shadow: true })}>Con sombra</button>
        <button className={'chip' + (o.shadow === false ? ' on' : '')} onClick={() => updateObject(i, { shadow: false })}>Sin sombra</button>
      </div>
    </>
  )
}

/* ---------------- Brand ---------------- */
function BrandBody({ content, template, set, onlyColors = false }) {
  const scheme = content.scheme || template.defaults?.scheme || 'deep'
  const accent = content.accent || template.defaults?.accent || 'emerald'
  const logo = content.logo || template.defaults?.logo || 'cream'
  if (onlyColors) {
    return (
      <>
        <div className="field"><label>Color de fondo</label>
          <div className="swatches">
            {Object.entries(COLOR_SCHEMES).map(([k, s]) => (
              <button key={k} className={'sw' + (scheme === k ? ' on' : '')} title={s.label} style={{ background: s.surface }} onClick={() => set({ scheme: k })} />
            ))}
          </div>
        </div>
        <div className="field"><label>Acento</label>
          <div className="swatches">
            {Object.entries(ACCENTS).map(([k, a]) => (
              <button key={k} className={'sw' + (accent === k ? ' on' : '')} title={a.label} style={{ background: a.value }} onClick={() => set({ accent: k })} />
            ))}
          </div>
        </div>
      </>
    )
  }
  return (
    <>
      <div className="field"><label>Esquema de color</label>
        <div className="swatches">
          {Object.entries(COLOR_SCHEMES).map(([k, s]) => (
            <button key={k} className={'sw' + (scheme === k ? ' on' : '')} title={s.label} style={{ background: s.surface }} onClick={() => set({ scheme: k })} />
          ))}
        </div>
      </div>
      <div className="field"><label>Acento</label>
        <div className="swatches">
          {Object.entries(ACCENTS).map(([k, a]) => (
            <button key={k} className={'sw' + (accent === k ? ' on' : '')} title={a.label} style={{ background: a.value }} onClick={() => set({ accent: k })} />
          ))}
        </div>
      </div>
      <div className="field"><label>Logo Magoya</label>
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

function BgBody({ content, set, inputRef, onPhotoFile, onToast }) {
  const bg = content.bg || 'color'
  const scheme = content.scheme || 'ink'
  const accent = content.accent || 'emerald'
  return (
    <>
      <div className="chips" style={{ marginBottom: 10 }}>
        <button className={'chip' + (bg === 'color' ? ' on' : '')} onClick={() => set({ bg: 'color' })}>Color</button>
        <button className={'chip' + (bg === 'photo' ? ' on' : '')} onClick={() => set({ bg: 'photo' })}>Foto</button>
      </div>
      {bg === 'color' ? (
        <div className="field"><label>Color de fondo</label>
          <div className="swatches">
            {Object.entries(COLOR_SCHEMES).map(([k, s]) => (
              <button key={k} className={'sw' + (scheme === k ? ' on' : '')} title={s.label} style={{ background: s.surface }} onClick={() => set({ scheme: k })} />
            ))}
          </div>
        </div>
      ) : (
        <PhotoBody content={content} set={set} inputRef={inputRef} onPhotoFile={onPhotoFile} onToast={onToast} />
      )}
      <div className="field"><label>Acento</label>
        <div className="swatches">
          {Object.entries(ACCENTS).map(([k, a]) => (
            <button key={k} className={'sw' + (accent === k ? ' on' : '')} title={a.label} style={{ background: a.value }} onClick={() => set({ accent: k })} />
          ))}
        </div>
      </div>
    </>
  )
}

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
                <button className="obj-row-del" onClick={() => move(i, -1)} title="Subir">↑</button>
                <button className="obj-row-del" onClick={() => move(i, 1)} title="Bajar">↓</button>
                <button className="obj-row-del" onClick={() => remove(i)} title="Quitar">✕</button>
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
              <button className="obj-row-del" onClick={() => move(i, -1)} title="Subir">↑</button>
              <button className="obj-row-del" onClick={() => move(i, 1)} title="Bajar">↓</button>
              <button className="obj-row-del" onClick={() => remove(i)} title="Quitar">✕</button>
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
function MoreMenu({ onSaveTemplate, onShare, onShareReview, onExportFile }) {
  const [open, setOpen] = useState(false)
  const act = (fn) => { setOpen(false); fn && fn() }
  return (
    <div className="menu">
      <button className="btn" onClick={() => setOpen((o) => !o)}>Más ▾</button>
      {open && (
        <div className="menu-pop" onMouseLeave={() => setOpen(false)}>
          <div className="grp">Compartir</div>
          {onShareReview && <button className="rec" onClick={() => act(onShareReview)}><span>Compartir para revisión (foto + comentarios)</span><span>☁</span></button>}
          <button onClick={() => act(onShare)}><span>Copiar link liviano (sin foto)</span><span>↗</span></button>
          <button onClick={() => act(onExportFile)}><span>Exportar proyecto (.json)</span><span>↓</span></button>
          <div className="grp">Reusar</div>
          <button onClick={() => act(onSaveTemplate)}><span>Guardar como plantilla</span><span>☆</span></button>
        </div>
      )}
    </div>
  )
}

/* ---------------- Download menu ---------------- */
function DownloadMenu({ template, content, format, slides, busy, setBusy, onToast }) {
  const [open, setOpen] = useState(false)
  const isCarousel = slides && slides.length > 0
  const run = async (fn, label) => {
    setOpen(false); setBusy(true); onToast('Generando ' + label + '…')
    try { await fn(); onToast('✓ ' + label + ' descargado') }
    catch (e) { console.error(e); onToast('⚠ Error al exportar') }
    finally { setBusy(false) }
  }
  return (
    <div className="menu">
      <button className="btn primary" disabled={busy} onClick={() => setOpen((o) => !o)}>↓ Descargar</button>
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
              <button onClick={() => run(() => exportCarousel({ slides, format, kind: 'zip', scale: 3 }), 'ZIP de PNGs')}><span>ZIP de PNGs</span><span>@3x</span></button>
              <button onClick={() => run(() => exportCarousel({ slides, format, kind: 'pdf', scale: 2 }), 'PDF')}><span>PDF</span><span>multipágina</span></button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
