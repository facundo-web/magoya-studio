import React, { useState, useRef, useEffect } from 'react'
import PiecePreview from './PiecePreview.jsx'
import { TEMPLATES } from '../templates/index.js'
import { FORMATS_BY_ID, formatsByNetwork, CAROUSEL_FORMATS } from '../formats/registry.js'
import { COLOR_SCHEMES, ACCENTS, WORDMARKS, CLIENT_LOGOS, TEXT_STYLES, GRADIENTS, HIGHLIGHTS } from '../brand/brandKit.js'
import { ALL_OBJECTS, ICONS_BY_ID, ICON_CATEGORIES } from '../brand/iconLibrary.js'

// colores para teñir logos "sin fondo" y marcas
const TINTS = [
  { k: 'accent', label: 'Acento', value: 'accent', sw: '#00DE68' },
  { k: 'ink', label: 'Negro', value: '#0D0C0C', sw: '#0D0C0C' },
  { k: 'white', label: 'Blanco', value: '#FFFFFF', sw: '#FFFFFF' },
  { k: 'emerald', label: 'Verde', value: '#00DE68', sw: '#00DE68' },
  { k: 'blue', label: 'Azul', value: '#2E7DD1', sw: '#2E7DD1' },
  { k: 'yellow', label: 'Amarillo', value: '#F2C14E', sw: '#F2C14E' },
]
import { imageSize, getAsset } from '../engine/assets.js'
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
  onChangeContent, onChangeFormat, onSelectSlide, onAddSlide, onChangeSlideTemplate, onDeleteSlide, onToast,
  elements = [], onAddElement, onDeleteElement,
  templates = TEMPLATES, onSaveTemplate,
}) {
  const [busy, setBusy] = useState(false)
  const [selObj, setSelObj] = useState(null)
  const [showSafe, setShowSafe] = useState(false)
  const [chooser, setChooser] = useState(null) // null | 'add' | 'change'
  const frameRef = useRef(null)
  const photoInputRef = useRef(null)
  const dragging = useRef(false)

  const isCarousel = slides && slides.length > 0
  const canCarousel = CAROUSEL_FORMATS.includes(format.id)

  const set = (patch) => onChangeContent({ ...content, ...patch })
  const objects = content.objects || []
  const setObjects = (next) => set({ objects: next })
  const updateObject = (i, patch) => setObjects(objects.map((o, idx) => (idx === i ? { ...o, ...patch } : o)))

  // foto: subir → dataURL (compartido entre panel y overlay)
  const onPhotoFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return onToast('Ese archivo no es una imagen')
    const src = await new Promise((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result)
      r.readAsDataURL(file)
    })
    const natural = await imageSize(src)
    set({ photo: { src, natural, focal: content.photo?.focal || { x: 0.5, y: 0.5 } } })
  }

  // arrastrar el objeto seleccionado sobre la pieza
  const posFromEvent = (e) => {
    const r = frameRef.current.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }
  const onFrameDown = (e) => {
    if (selObj == null || !objects[selObj]) return
    dragging.current = true
    updateObject(selObj, posFromEvent(e))
  }
  const onFrameMove = (e) => {
    if (!dragging.current) return
    updateObject(selObj, posFromEvent(e))
  }
  const endDrag = () => (dragging.current = false)

  const needsPhoto = template.surface === 'photo' && !content.photo?.src

  return (
    <div className="editor">
      <div className="sidebar">
        <div className="side-head">
          <div className="sh-name">{template.name}</div>
          {template.purpose && <div className="sh-purpose">{template.purpose}</div>}
          <div className="sh-dest">Para <b>{format.network} · {format.label}</b> · {format.w}×{format.h}</div>
        </div>

        <Section title="Formato / red" defaultOpen summary={`${format.network} · ${format.label}`}
          help="Cambiá el tamaño según dónde publiques. La pieza se re-acomoda sola.">
          <FormatBody format={format} onChangeFormat={onChangeFormat} />
        </Section>

        {template.freeform ? (
          <>
            <Section title="Fondo" defaultOpen summary={(content.bg || 'color') === 'photo' ? 'foto' : 'color'}
              help="Elegí el fondo: un color de marca o una foto.">
              <BgBody content={content} set={set} inputRef={photoInputRef} onPhotoFile={onPhotoFile} />
            </Section>
            <Section title="Textos" defaultOpen summary={`${(content.textBlocks || []).length}`}
              help="Sumá los textos que quieras. Cada uno con su estilo de marca.">
              <TextBlocksBody content={content} set={set} />
            </Section>
            <Section title="Posición del texto" summary={content.anchor || template.anchor}>
              <AnchorBody content={content} template={template} set={set} />
            </Section>
          </>
        ) : (
          <Section title="Contenido" defaultOpen help="Editá los textos de la pieza.">
            <ContentBody template={template} content={content} set={set} />
          </Section>
        )}

        {!template.freeform && template.surface === 'photo' && (
          <Section title="Foto" defaultOpen summary={content.photo?.src ? '✓ cargada' : 'falta'}
            help="Subí una foto. Sale en B&N (regla de marca) por defecto.">
            <PhotoBody content={content} set={set} inputRef={photoInputRef} onPhotoFile={onPhotoFile} />
          </Section>
        )}

        <Section title="Degradé" summary={content.gradient?.preset ? (GRADIENTS[content.gradient.preset]?.label || 'sí') : 'no'}
          help="Un degradé encima del fondo para dar clima y legibilidad.">
          <GradientBody content={content} set={set} />
        </Section>

        <Section title="Objetos · logos & profundidad" summary={objects.length ? `${objects.length}` : 'ninguno'}
          help="Sumá logos (IA / redes) o tu PNG. Arrastralos en la pieza y con Profundidad traelos al frente o atrás del texto.">
          <ObjectsBody objects={objects} setObjects={setObjects} updateObject={updateObject}
            selObj={selObj} setSelObj={setSelObj} onToast={onToast}
            elements={elements} onAddElement={onAddElement} onDeleteElement={onDeleteElement} />
        </Section>

        <Section title={template.freeform ? 'Logo' : 'Marca'} summary={template.freeform ? (content.showLogo === false ? 'oculto' : 'visible') : 'colores y logos'}
          help={template.freeform ? 'Mostrá u ocultá el logo de Magoya.' : 'Colores, acento y logos — todo dentro de la marca.'}>
          {template.freeform ? <LogoBody content={content} template={template} set={set} /> : <BrandBody content={content} template={template} set={set} />}
        </Section>
      </div>

      <div className="stage">
        <div className="stage-tools">
          <span style={{ fontSize: 13, color: '#5C6B61' }}>{format.network} · {format.label} · {format.w}×{format.h}</span>
          <label className="safe-toggle"><input type="checkbox" checked={showSafe} onChange={(e) => setShowSafe(e.target.checked)} /> Ver zona segura</label>
          <div style={{ flex: 1 }} />
          {canCarousel && !isCarousel && <button className="btn" onClick={() => setChooser('add')}>+ Convertir en carrusel</button>}
          {onSaveTemplate && <button className="btn" title="Guardar esta pieza como tu plantilla reutilizable" onClick={() => onSaveTemplate()}>☆ Guardar como plantilla</button>}
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
          >
            <PiecePreview template={template} content={content} format={format} />
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
            <button className="btn" style={{ marginLeft: 8 }} onClick={() => setChooser('add')}>Desde plantilla</button>
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

/* ---------------- Content ---------------- */
function ContentBody({ template, content, set }) {
  const roles = template.roles || []
  return (
    <>
      {roles.map((role) => {
        const long = ['title', 'quote', 'subtitle', 'body', 'metricLabel'].includes(role)
        const val = content[role] ?? template.defaults?.[role] ?? ''
        return (
          <div className="field" key={role}>
            <label>{ROLE_LABELS[role] || role}</label>
            {long ? (
              <textarea value={val} onChange={(e) => set({ [role]: e.target.value })} rows={role === 'title' || role === 'quote' ? 2 : 1} />
            ) : (
              <input type="text" value={val} onChange={(e) => set({ [role]: e.target.value })} />
            )}
          </div>
        )
      })}
    </>
  )
}

/* ---------------- Photo ---------------- */
function PhotoBody({ content, set, inputRef, onPhotoFile }) {
  const photo = content.photo
  const treatment = content.treatment || 'bw'
  return (
    <>
      <div className={'dropzone' + (photo?.src ? ' has' : '')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && onPhotoFile(e.dataTransfer.files[0]) }}>
        {photo?.src ? '✓ Foto cargada — click para cambiar' : 'Arrastrá una foto o hacé click'}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && onPhotoFile(e.target.files[0])} />

      <div className="field" style={{ marginTop: 12 }}>
        <label>Tratamiento</label>
        <div className="chips">
          <button className={'chip' + (treatment === 'bw' ? ' on' : '')} onClick={() => set({ treatment: 'bw' })}>B&N (marca)</button>
          <button className={'chip' + (treatment === 'color' ? ' on' : '')} onClick={() => set({ treatment: 'color' })}>Color</button>
        </div>
      </div>

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

/* ---------------- Objects ---------------- */
function ObjectsBody({ objects, setObjects, updateObject, selObj, setSelObj, onToast, elements = [], onAddElement, onDeleteElement }) {
  const [picking, setPicking] = useState(false)
  const [cat, setCat] = useState('ai')
  const fileRef = useRef(null)

  const CATS = { ...ICON_CATEGORIES, custom: 'Mis elementos' }

  const placeImage = async (src, elementId) => {
    const natural = await imageSize(src)
    setObjects([...objects, { kind: 'image', src, elementId, natural, x: 0.72, y: 0.42, scale: 0.34, rotation: 0, shadow: true, opacity: 1 }])
    setSelObj(objects.length)
  }
  const addIcon = (icon) => {
    // el logo de Magoya se coloca como imagen (mantiene su color y proporción)
    if (icon.category === 'magoya') {
      placeImage(getAsset(icon.url) || icon.url)
      setPicking(false)
      return
    }
    const isMark = icon.category === 'marks'
    setObjects([...objects, {
      kind: 'icon', iconId: icon.id,
      style: isMark ? 'plain' : 'tile',
      tint: isMark ? 'accent' : undefined,
      x: 0.72, y: 0.42, scale: isMark ? 0.34 : 0.3, rotation: isMark ? 0 : -8, shadow: true, opacity: 1,
    }])
    setSelObj(objects.length)
    setPicking(false)
  }
  // subir = guardar en la biblioteca (reutilizable) + colocar
  const addImage = async (file) => {
    if (!file || !file.type.startsWith('image/')) return onToast('No es una imagen')
    const src = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file) })
    let elementId
    if (onAddElement) {
      const el = onAddElement({ name: file.name.replace(/\.[^.]+$/, ''), src })
      elementId = el?.id
    }
    placeImage(src, elementId)
  }
  const remove = (i) => { setObjects(objects.filter((_, idx) => idx !== i)); setSelObj(null) }
  const bringFront = (i) => { const a = [...objects]; const [it] = a.splice(i, 1); a.push(it); setObjects(a); setSelObj(a.length - 1) }
  const sendBack = (i) => { const a = [...objects]; const [it] = a.splice(i, 1); a.unshift(it); setObjects(a); setSelObj(0) }
  const iconsInCat = cat === 'custom' ? [] : ALL_OBJECTS.filter((i) => i.category === cat)

  return (
    <>
      {objects.map((o, i) => {
        const objIcon = o.kind === 'icon' ? ICONS_BY_ID[o.iconId] : null
        const isMark = objIcon?.category === 'marks'
        const showTint = o.kind === 'icon' && (isMark || o.style === 'plain')
        return (
        <div key={i} className={'obj-card' + (selObj === i ? ' sel' : '')}>
          <div className="obj-head">
            <button className="obj-name" onClick={() => setSelObj(selObj === i ? null : i)}>
              {selObj === i ? '◉ ' : '○ '}{o.kind === 'image' ? 'PNG subido' : (objIcon?.label || 'Logo')}
            </button>
            <button className="btn" style={{ padding: '2px 8px' }} onClick={() => remove(i)}>✕</button>
          </div>
          {o.kind === 'icon' && !isMark && (
            <div className="chips" style={{ marginBottom: 8 }}>
              <button className={'chip' + (o.style !== 'plain' ? ' on' : '')} onClick={() => updateObject(i, { style: 'tile' })}>Con fondo (app-icon)</button>
              <button className={'chip' + (o.style === 'plain' ? ' on' : '')} onClick={() => updateObject(i, { style: 'plain' })}>Sin fondo</button>
            </div>
          )}
          {o.kind === 'image' && (
            <>
              <div className="chips" style={{ marginBottom: 8 }}>
                <button className={'chip' + (!o.frame ? ' on' : '')} onClick={() => updateObject(i, { frame: false })}>Imagen libre</button>
                <button className={'chip' + (o.frame ? ' on' : '')} onClick={() => updateObject(i, { frame: true, ratio: o.ratio || 0.62 })} title="Recortá la imagen en un marco, ej: dentro de una pantalla">Recorte / pantalla</button>
              </div>
              {o.frame && (
                <>
                  <label style={{ fontSize: 11, color: '#4A554D' }}>Proporción (ancho/alto)</label>
                  <input className="range" type="range" min="0.3" max="1.8" step="0.02" value={o.ratio || 0.62} onChange={(e) => updateObject(i, { ratio: +e.target.value })} />
                  <label style={{ fontSize: 11, color: '#4A554D' }}>Radio de esquinas</label>
                  <input className="range" type="range" min="0" max="0.3" step="0.01" value={o.radius || 0} onChange={(e) => updateObject(i, { radius: +e.target.value })} />
                  <label style={{ fontSize: 11, color: '#4A554D' }}>Zoom de la imagen</label>
                  <input className="range" type="range" min="1" max="3" step="0.05" value={o.zoom || 1} onChange={(e) => updateObject(i, { zoom: +e.target.value })} />
                  <label style={{ fontSize: 11, color: '#4A554D' }}>Encuadre X / Y</label>
                  <input className="range" type="range" min="0" max="1" step="0.01" value={o.focal?.x ?? 0.5} onChange={(e) => updateObject(i, { focal: { ...(o.focal || { x: 0.5, y: 0.5 }), x: +e.target.value } })} />
                  <input className="range" type="range" min="0" max="1" step="0.01" value={o.focal?.y ?? 0.5} onChange={(e) => updateObject(i, { focal: { ...(o.focal || { x: 0.5, y: 0.5 }), y: +e.target.value } })} />
                </>
              )}
            </>
          )}
          {showTint && (
            <>
              <label style={{ fontSize: 11, color: '#4A554D' }}>Color</label>
              <div className="swatches" style={{ marginBottom: 8 }}>
                {TINTS.map((t) => (
                  <button key={t.k} className={'sw' + ((o.tint || 'accent') === t.value ? ' on' : '')} title={t.label}
                    style={{ background: t.sw }} onClick={() => updateObject(i, { tint: t.value })} />
                ))}
              </div>
            </>
          )}
          <label style={{ fontSize: 11, color: '#4A554D' }}>Profundidad</label>
          <div className="chips" style={{ marginBottom: 6 }}>
            <button className={'chip' + (!o.front ? ' on' : '')} onClick={() => updateObject(i, { front: false })}>Detrás del texto</button>
            <button className={'chip' + (o.front ? ' on' : '')} onClick={() => updateObject(i, { front: true })}>Delante del texto</button>
          </div>
          <div className="chips" style={{ marginBottom: 10 }}>
            <button className="chip" onClick={() => bringFront(i)}>↑ Traer al frente</button>
            <button className="chip" onClick={() => sendBack(i)}>↓ Enviar al fondo</button>
          </div>
          <label style={{ fontSize: 11, color: '#4A554D' }}>Posición</label>
          <div className="posgrid">
            {POS_GRID.map(([px, py], k) => (
              <button key={k} className={'posdot' + (Math.abs((o.x ?? 0.5) - px) < 0.02 && Math.abs((o.y ?? 0.5) - py) < 0.02 ? ' on' : '')}
                onClick={() => updateObject(i, { x: px, y: py })} title="Ubicar acá" />
            ))}
          </div>
          <label style={{ fontSize: 11, color: '#4A554D' }}>Tamaño</label>
          <input className="range" type="range" min="0.08" max="0.7" step="0.01" value={o.scale} onChange={(e) => updateObject(i, { scale: +e.target.value })} />
          <label style={{ fontSize: 11, color: '#4A554D' }}>Rotación</label>
          <input className="range" type="range" min="-45" max="45" step="1" value={o.rotation} onChange={(e) => updateObject(i, { rotation: +e.target.value })} />
          <label style={{ fontSize: 11, color: '#4A554D' }}>Opacidad (para fondos tenues)</label>
          <input className="range" type="range" min="0.1" max="1" step="0.05" value={o.opacity ?? 1} onChange={(e) => updateObject(i, { opacity: +e.target.value })} />
          <label style={{ fontSize: 11, color: '#4A554D' }}>Sombra (profundidad)</label>
          <div className="chips">
            <button className={'chip' + (o.shadow !== false ? ' on' : '')} onClick={() => updateObject(i, { shadow: true })}>Con sombra</button>
            <button className={'chip' + (o.shadow === false ? ' on' : '')} onClick={() => updateObject(i, { shadow: false })}>Sin sombra</button>
          </div>
        </div>
        )
      })}

      <div style={{ display: 'flex', gap: 6, marginTop: objects.length ? 8 : 0 }}>
        <button className="btn" onClick={() => setPicking((v) => !v)}>+ Logo</button>
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
                <button className="icon-pick upload" title="Subir un elemento" onClick={() => fileRef.current?.click()}>
                  <span>＋</span>
                </button>
                {elements.map((el) => (
                  <div key={el.id} className="icon-pick custom" title={el.name}>
                    <img src={el.src} alt={el.name} onClick={() => placeImage(el.src, el.id)} />
                    <button className="el-del" title="Quitar de la biblioteca"
                      onClick={(e) => { e.stopPropagation(); onDeleteElement && onDeleteElement(el.id) }}>✕</button>
                  </div>
                ))}
              </div>
              {elements.length === 0 && <div className="hint">Subí logos o elementos (PNG/SVG). Quedan guardados acá para reusar siempre.</div>}
            </>
          ) : (
            <>
              <div className="icon-grid">
                {iconsInCat.map((icon) => (
                  <button key={icon.id} title={icon.label} onClick={() => addIcon(icon)} className="icon-pick" style={{ background: icon.color }}>
                    <img src={icon.url} alt={icon.label} />
                  </button>
                ))}
              </div>
              <div className="hint">¿Falta un logo? Subí el tuyo en <b>Mis elementos</b> — queda guardado para reusar.</div>
            </>
          )}
        </div>
      )}
    </>
  )
}

/* ---------------- Brand ---------------- */
function BrandBody({ content, template, set }) {
  const scheme = content.scheme || template.defaults?.scheme || 'deep'
  const accent = content.accent || template.defaults?.accent || 'emerald'
  const logo = content.logo || template.defaults?.logo || 'cream'
  const clientLogo = content.clientLogo || template.defaults?.clientLogo || 'none'
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
      <div className="field"><label>Logo de cliente</label>
        <select value={clientLogo} onChange={(e) => set({ clientLogo: e.target.value })}>
          {Object.entries(CLIENT_LOGOS).map(([k, l]) => (<option key={k} value={k}>{l.label}</option>))}
        </select>
      </div>
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

function BgBody({ content, set, inputRef, onPhotoFile }) {
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
        <PhotoBody content={content} set={set} inputRef={inputRef} onPhotoFile={onPhotoFile} />
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

function TextBlocksBody({ content, set }) {
  const blocks = content.textBlocks || []
  const update = (i, patch) => set({ textBlocks: blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) })
  const add = () => set({ textBlocks: [...blocks, { style: 'title', text: 'Nuevo texto' }] })
  const remove = (i) => set({ textBlocks: blocks.filter((_, idx) => idx !== i) })
  const move = (i, dir) => { const a = [...blocks]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set({ textBlocks: a }) }
  return (
    <>
      {blocks.map((b, i) => (
        <div key={i} className="obj-card">
          <div className="obj-head">
            <select value={b.style} onChange={(e) => update(i, { style: e.target.value })} style={{ fontSize: 12, padding: '4px 6px', flex: 1 }}>
              {TEXT_STYLE_OPTS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
            </select>
            <span style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
              <button className="btn" style={{ padding: '2px 6px' }} onClick={() => move(i, -1)}>↑</button>
              <button className="btn" style={{ padding: '2px 6px' }} onClick={() => move(i, 1)}>↓</button>
              <button className="btn" style={{ padding: '2px 8px' }} onClick={() => remove(i)}>✕</button>
            </span>
          </div>
          <textarea value={b.text} onChange={(e) => update(i, { text: e.target.value })} rows={2} />
          {b.style !== 'cta' && (
            <div style={{ marginTop: 6 }}>
              <label style={{ fontSize: 11, color: '#4A554D' }}>Resaltado (marcador)</label>
              <div className="chips">
                {Object.entries(HIGHLIGHTS).map(([k, hl]) => (
                  <button key={k} className={'chip' + ((b.highlight || 'none') === k ? ' on' : '')} onClick={() => update(i, { highlight: k })}>{hl.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      <button className="btn" onClick={add}>+ Agregar texto</button>
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
  const clientLogo = content.clientLogo || 'none'
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
          <div className="field"><label>Logo de cliente</label>
            <select value={clientLogo} onChange={(e) => set({ clientLogo: e.target.value })}>
              {Object.entries(CLIENT_LOGOS).map(([k, l]) => (<option key={k} value={k}>{l.label}</option>))}
            </select>
          </div>
        </>
      )}
    </>
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
